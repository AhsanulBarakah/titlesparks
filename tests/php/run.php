<?php
/**
 * Run the PHP assertion scripts against a WordPress install.
 *
 * The suites in this directory are not a test framework: each one is a function
 * that loads a real WordPress, asserts against the stored option, the REST
 * routes and the scan, and restores everything it changed on the way out. They
 * need a site to run against, so this runner takes the WordPress root — the
 * directory holding `wp-load.php`, which is `.test-site` for the site
 * `tests/integration/setup-test-site.sh` installs:
 *
 *     php tests/php/run.php .test-site
 *     WP_ROOT=/path/to/wordpress php tests/php/run.php
 *
 * The plugin under test is the one installed in that WordPress, active or not:
 * `wp-load.php` is what loads it. Every suite runs even when an earlier one
 * fails, so one run reports every failure, and the exit status is 1 if any did.
 *
 * @package Title_Sparks
 */

$root = isset( $argv[1] ) ? $argv[1] : getenv( 'WP_ROOT' );

if ( ! is_string( $root ) || '' === $root ) {
	fwrite( STDERR, "Pass the WordPress root, or set WP_ROOT.\n" );
	exit( 2 );
}

$root = rtrim( $root, '/\\' );

if ( ! is_readable( $root . '/wp-load.php' ) ) {
	fwrite( STDERR, "No wp-load.php in {$root}.\n" );
	exit( 2 );
}

require $root . '/wp-load.php';

$suites = array(
	'test-settings-store.php'             => 'titlesparks_test_settings_store',
	'test-settings-homepage-sections.php' => 'titlesparks_test_homepage_sections',
	'test-settings-scan-samples.php'      => 'titlesparks_test_scan_samples',
	'test-security-anchor.php'            => 'titlesparks_test_security_anchor',
	'test-no-inline-assets.php'          => 'titlesparks_test_no_inline_assets',
	'test-admin-notices.php'              => 'titlesparks_test_admin_notices',
	'test-asset-library-stills.php'       => 'titlesparks_test_asset_library_stills',
	'test-rest-hostile-requests.php'      => 'titlesparks_test_rest_hostile_requests',
	'test-uninstall-and-scan-cache.php'   => 'titlesparks_test_uninstall_and_scan_cache',
);

$failed = 0;

foreach ( $suites as $file => $function ) {
	require __DIR__ . '/' . $file;

	try {
		$function();

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI summary of a suite name.
		printf( "PASS %s\n", $file );
	} catch ( Throwable $error ) {
		$failed++;

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI report of the assertion that failed.
		printf( "FAIL %s: %s\n", $file, $error->getMessage() );
	}
}

printf( "%d of %d suites passed\n", count( $suites ) - $failed, count( $suites ) );

exit( $failed > 0 ? 1 : 0 );
