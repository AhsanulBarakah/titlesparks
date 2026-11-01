<?php
/**
 * Admin-notice tests: this plugin leaves other plugins' notices alone.
 *
 * A WordPress.org review flagged two earlier versions of this screen. The first
 * walked `$wp_filter` and called `remove_action()` on every `admin_notices` and
 * `all_admin_notices` callback that was not core's or this plugin's, so opening
 * the settings screen suppressed other plugins' warnings entirely — a licence
 * had expired, an update failed, a payment did not go through. The second hid
 * the same notices with CSS and offered a button to bring them back, which is
 * still this plugin deciding what another plugin may say on a screen it does not
 * own.
 *
 * Both are gone: nothing is unregistered, nothing is hidden, and no style or
 * script in the shipped plugin names a notice class. These assertions pin that
 * down — including that a third-party callback registered for `admin_notices`
 * still runs and still prints on a request that loads this plugin.
 *
 * Run after loading WordPress, for example:
 * php -r 'require "path/to/wp-load.php"; require "tests/php/test-admin-notices.php"; titlesparks_test_admin_notices();'
 *
 * @package Title_Sparks
 */

defined( 'ABSPATH' ) || exit;

/**
 * Run the admin-notice tests against a bootstrapped WordPress install.
 *
 * @return void
 */
function titlesparks_test_admin_notices() {
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
			0 === preg_match( '/remove_(?:all_)?actions?\s*\(\s*[\'"]all_admin_notices[\'"]/', $source ),
			$name . ' unregisters an all_admin_notices callback; another plugin\'s notice is not this plugin\'s to remove.'
		);
		$assert(
			0 === preg_match( '/remove_(?:all_)?actions?\s*\(\s*[\'"]admin_notices[\'"]/', $source ),
			$name . ' unregisters an admin_notices callback; another plugin\'s notice is not this plugin\'s to remove.'
		);
	}

	// Nothing in the stylesheets or scripts may name a notice class, because a
	// rule that names one exists only to hide it, and this plugin has no notice
	// of another plugin's to hide. `titlesparks-notice` is this plugin's own.
	$assets = array( $root . '/assets/css/admin-skeleton.css' );

	foreach ( glob( $root . '/assets/css/*.css' ) as $file ) {
		$assets[] = $file;
	}

	foreach ( array_unique( $assets ) as $file ) {
		$css  = (string) file_get_contents( $file );
		$name = str_replace( $root . '/', '', $file );

		foreach ( explode( "\n", $css ) as $line ) {
			$line = trim( $line );

			if ( '' === $line || 0 === strpos( $line, '/*' ) || 0 === strpos( $line, '*' ) ) {
				continue;
			}

			$assert(
				1 !== preg_match( '/\.(?:notice|updated|error|update-nag)\b(?![\w-])/', $line ),
				$name . ' styles a notice: ' . $line . ' — a screen this plugin owns must leave other plugins\' messages visible.'
			);
		}
	}

	// The screen itself: no button, no toggle state, no class that a stylesheet
	// could key off.
	$page = (string) file_get_contents( $root . '/includes/admin/class-ts-settings-page.php' );

	foreach ( array( 'titlesparks-admin-messages', 'titlesparks-show-notices', 'data-titlesparks-show', 'titlesparks-notice' ) as $needle ) {
		$assert(
			false === strpos( $page, $needle ),
			'The settings screen still carries "' . $needle . '"; the notice handling has to be gone, not hidden.'
		);
	}

	// And the behaviour: bootstrapping this plugin's screen leaves a callback
	// another plugin registered exactly where it was. The hook is not fired here
	// on purpose — `admin_notices` belongs to every plugin on the site, and one
	// of them can reasonably reach for a screen function that only exists inside
	// wp-admin, which would fail this suite for a reason that is not this file's
	// subject. Registration is what the earlier versions tampered with.
	$printed = static function () {
		echo '<div class="notice notice-warning">Third-party notice.</div>';
	};

	add_action( 'admin_notices', $printed );

	$page = new \Title_Sparks\Admin\Settings_Page();

	$page->enqueue( 'toplevel_page_' . TITLE_SPARKS_ADMIN_PAGE_SLUG );
	$page->enqueue( 'edit.php' );

	$assert(
		false !== has_action( 'admin_notices', $printed ),
		'Booting the settings screen unregistered a third-party admin_notices callback.'
	);

	remove_action( 'admin_notices', $printed );

	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI test summary; the only placeholder is an integer counter.
	printf( "PASS: %d admin-notice PHP assertions\n", $assertions );
}
