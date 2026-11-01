<?php
/**
 * Fresh-install assertions for the ZIP a release tag is about to publish.
 *
 * Every other check in this repository runs against a build tree or an archive
 * it unpacked itself. This one runs against what a site actually receives: the
 * finished archive is handed to a clean WordPress in Playground, installed,
 * activated, and then asked the questions a first install has to survive — does
 * the plugin file exist where WordPress looks for it, does the version it
 * carries match the readme, does its menu appear, does the settings screen
 * render its mount node, and does none of the review findings come back.
 *
 * It runs inside Playground through a Blueprint `runPHP` step, so it is plain
 * PHP with no test framework: a failure is thrown, which ends the step with a
 * non-zero status and fails the workflow rather than printing a warning into a
 * green run. Everything it measured is written to `result.json` beside it, and
 * echoed, so a passing run still says what it saw.
 *
 * Run it through `tests/integration/playground-fresh-install.sh`, locally or in
 * the release workflow; it is not meant to be loaded from a normal WordPress
 * request.
 *
 * @package Title_Sparks
 */

defined( 'ABSPATH' ) || require '/wordpress/wp-load.php';

$titlesparks_measured = array();
$titlesparks_failures = array();

/**
 * Record one measurement and fail when it is not what a first install needs.
 *
 * @param array  $measured Measurements so far, by name.
 * @param array  $failures Failures so far.
 * @param string $name     What was measured.
 * @param mixed  $actual   What was found.
 * @param mixed  $expected What it has to be.
 * @return void
 */
function titlesparks_playground_check( array &$measured, array &$failures, $name, $actual, $expected ) {
	$measured[ $name ] = $actual;

	if ( $actual !== $expected ) {
		$failures[] = sprintf(
			'%s: expected %s, found %s',
			$name,
			is_scalar( $expected ) ? var_export( $expected, true ) : gettype( $expected ),
			is_scalar( $actual ) ? var_export( $actual, true ) : gettype( $actual )
		);
	}
}

$plugin  = 'titlesparks/titlesparks.php';
$dir     = WP_PLUGIN_DIR . '/titlesparks';
$headers = get_plugin_data( $dir . '/titlesparks.php', false, false );
$readme  = (string) file_get_contents( $dir . '/readme.txt' );
$css     = (string) file_get_contents( $dir . '/assets/css/admin-skeleton.css' );

// The archive unpacked where WordPress expects a plugin, and WordPress agrees
// it is active rather than merely present.
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'plugin_file', file_exists( $dir . '/titlesparks.php' ), true );

$folders = array_values(
	array_filter(
		(array) scandir( $dir ),
		static function ( $name ) use ( $dir ) {
			return '.' !== $name && '..' !== $name && is_dir( $dir . '/' . $name );
		}
	)
);
sort( $folders );

titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'shipped_folders', implode( ',', $folders ), 'assets,build-admin,build-block,build-frontend,includes,languages' );
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'active', is_plugin_active( $plugin ), true );

// One version, in the three places it is written: the plugin header, the
// constant the code reads, and the readme's stable tag. The header is the
// reference — the release workflow is what compares it to the requested
// version — so this checks the archive agrees with itself.
$version = isset( $headers['Version'] ) ? (string) $headers['Version'] : '';

preg_match( '/^Stable tag:\s*(.+)$/m', $readme, $stable );

$titlesparks_measured['header_version'] = $version;
$titlesparks_measured['constant_version'] = TITLE_SPARKS_VERSION;
$titlesparks_measured['readme_stable_tag'] = isset( $stable[1] ) ? trim( $stable[1] ) : 'none';

if ( 1 !== preg_match( '/^\d+\.\d+\.\d+$/', $version ) ) {
	$titlesparks_failures[] = 'header_version: ' . var_export( $version, true ) . ' is not a x.y.z version';
}

titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'constant_matches_header', TITLE_SPARKS_VERSION, $version );
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'stable_tag_matches_header', isset( $stable[1] ) ? trim( $stable[1] ) : 'none', $version );
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'text_domain', isset( $headers['TextDomain'] ) ? $headers['TextDomain'] : 'none', 'titlesparks' );

// The two readme entries the directory review asked for, checked in the copy
// that ships rather than in the repository's.
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'readme_upgrade_notice', false !== strpos( $readme, '== Upgrade Notice ==' ), true );
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'readme_source_faq', false !== strpos( $readme, 'Where can I find the source code?' ), true );

// The review findings, pinned on the archive rather than on the sources: no
// rule that hides another plugin's notice, and no notice-handling machinery.
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'notice_hiding_css', false !== strpos( $css, 'titlesparks-show-notices' ), false );
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'notice_selector_in_css', 1 === preg_match( '/\.(?:notice|updated|error|update-nag)\b/', $css ), false );
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'rest_namespace', TITLE_SPARKS_REST_NAMESPACE, 'titlesparks/v1' );

// The admin screen: registered on the menu, and rendering its own markup.
require_once ABSPATH . 'wp-admin/includes/admin.php';

wp_set_current_user( 1 );
do_action( 'admin_menu' );

$slugs = array();
foreach ( (array) $GLOBALS['menu'] as $item ) {
	if ( isset( $item[2] ) ) {
		$slugs[] = $item[2];
	}
}

titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'menu_slug', in_array( 'titlesparks', $slugs, true ), true );

if ( function_exists( 'set_current_screen' ) ) {
	set_current_screen( 'toplevel_page_titlesparks' );
}

ob_start();
( new \Title_Sparks\Admin\Settings_Page() )->render();
$html = (string) ob_get_clean();

titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'mount_node', false !== strpos( $html, 'id="titlesparks-admin-root"' ), true );
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'skeleton', false !== strpos( $html, 'titlesparks-skeleton' ), true );
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'app_scope', false !== strpos( $html, 'class="titlesparks-app"' ), true );

// Guideline 11 and the enqueue finding, seen in the rendered screen: the page
// prints no notice control of its own and no asset markup of its own.
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'notice_toggle_button', false !== strpos( $html, 'admin-messages' ), false );
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'printed_style_tag', false !== stripos( $html, '<style' ), false );
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'printed_script_tag', false !== stripos( $html, '<script' ), false );
titlesparks_playground_check( $titlesparks_measured, $titlesparks_failures, 'render_bytes', strlen( $html ) > 1000, true );

$titlesparks_report = array(
	'measured' => $titlesparks_measured,
	'failures' => $titlesparks_failures,
	'result'   => $titlesparks_failures ? 'FAIL' : 'PASS',
);

// Written beside this script, so the runner can print it, and echoed for the
// case where the step's stdout is shown directly.
@file_put_contents( __DIR__ . '/result.json', wp_json_encode( $titlesparks_report, JSON_PRETTY_PRINT ) );

echo 'TITLESPARKS-PLAYGROUND=' . wp_json_encode( $titlesparks_report ) . "\n";

if ( $titlesparks_failures ) {
	// A thrown error ends the Blueprint step with a non-zero status, which is
	// what makes the workflow red instead of printing a warning into a pass.
	throw new RuntimeException( 'TitleSparks did not survive a clean install: ' . implode( '; ', $titlesparks_failures ) );
}
