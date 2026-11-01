<?php
/**
 * Packaging tests: no hand-printed assets, and a documented source location.
 *
 * Two WordPress.org review findings are pinned here, because both are the kind
 * of thing that quietly comes back with a later edit.
 *
 * - The settings screen printed its own `<style>` elements: one for the menu
 *   icon, one for the placeholder the dashboard mounts over. The directory
 *   asks for `wp_enqueue_style()` / `wp_add_inline_style()` instead, so the
 *   styles a site serves are visible to a caching or CSP plugin and can be
 *   dequeued or altered like any other. The scan below fails if any shipped
 *   PHP file starts printing asset markup again, and the menu rule is checked
 *   where it now lives: in the style data WordPress prints.
 * - The compiled bundles in `build-*` have no readable counterpart inside the
 *   ZIP (they are build output), so the readme has to say where the source is
 *   and how to rebuild it. A missing link is a Guideline 4 finding.
 *
 * Run after loading WordPress, for example:
 * php -r 'require "path/to/wp-load.php"; require "tests/php/test-no-inline-assets.php"; titlesparks_test_no_inline_assets();'
 *
 * @package Title_Sparks
 */

defined( 'ABSPATH' ) || exit;

/**
 * Run the packaging tests against a bootstrapped WordPress install.
 *
 * @return void
 */
function titlesparks_test_no_inline_assets() {
	$assertions = 0;
	$assert     = static function ( $condition, $message ) use ( &$assertions ) {
		++$assertions;

		if ( ! $condition ) {
			throw new RuntimeException( esc_html( $message ) );
		}
	};

	$root = dirname( __DIR__, 2 );

	// Everything the ZIP ships as PHP: the two entry files and `includes/`.
	$files = array( $root . '/titlesparks.php', $root . '/uninstall.php' );

	$walker = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator( $root . '/includes', FilesystemIterator::SKIP_DOTS )
	);

	foreach ( $walker as $file ) {
		if ( $file->isFile() && 'php' === $file->getExtension() ) {
			$files[] = $file->getPathname();
		}
	}

	foreach ( $files as $file ) {
		$source = file_get_contents( $file );
		$name   = str_replace( $root . '/', '', $file );

		$assert(
			false === stripos( $source, '<style' ),
			$name . ' prints a <style> element; enqueue a stylesheet or use wp_add_inline_style() instead.'
		);
		$assert(
			false === stripos( $source, '<script src' ),
			$name . ' prints a <script src> element; enqueue the script instead.'
		);
		$assert(
			false === stripos( $source, 'rel="stylesheet"' ),
			$name . ' prints a stylesheet link; enqueue the stylesheet instead.'
		);
	}

	// The menu icon's rule moved into the enqueue API. Reading the style data
	// back is what proves the rule still reaches the page, rather than only
	// that the markup is gone.
	$page = new \Title_Sparks\Admin\Settings_Page();

	$page->enqueue_inline_styles();

	$inline = wp_styles()->get_data( 'titlesparks-admin-menu', 'after' );

	$assert(
		is_array( $inline ) && ! empty( $inline ),
		'The menu icon rule is no longer attached to an enqueued stylesheet, so the admin menu draws the artwork at its intrinsic size.'
	);
	$assert(
		false !== strpos( implode( '', (array) $inline ), 'wp-menu-image' ),
		'The inline menu rule no longer sizes the menu image.'
	);

	// The build instructions live in README.md: the ZIP carries compiled JS and
	// no `blocks/` directory to compare it with, so the repository has to name
	// the source and the way back to the bundles for whoever reads the code.
	$landing = file_get_contents( $root . '/README.md' );

	$assert(
		false !== strpos( $landing, 'blocks/' ),
		'README.md must name the blocks/ folder that holds the readable source.'
	);
	$assert(
		false !== strpos( $landing, 'https://github.com/AhsanulBarakah/titlesparks' ),
		'README.md must link the repository that holds the readable source.'
	);
	$assert(
		false !== strpos( $landing, 'npm ci && npm run build' ),
		'README.md must state the build steps that regenerate the compiled bundles.'
	);

	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI test summary; the only placeholder is an integer counter.
	printf( "PASS: %d packaging PHP assertions\n", $assertions );
}
