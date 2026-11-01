<?php
/**
 * Regression tests for `Security::anchor()`.
 *
 * The anchor decides when a post's timeline starts, and it is stored as a
 * `Y-m-d H:i:s` string on the *site* clock with no offset in it. A value that
 * arrives with its own offset has to be converted to that clock before it is
 * formatted: `2026-10-28T10:00:00Z` is 10:00 UTC, which is 15:30 in a site set
 * to Asia/Kolkata, and storing `10:00` there would start the timeline five and
 * a half hours before the moment the author picked.
 *
 * Run after loading WordPress, for example:
 * php -r 'require "path/to/wp-load.php"; require "tests/php/test-security-anchor.php"; titlesparks_test_security_anchor();'
 *
 * The site's timezone options are changed for the run and restored in a
 * `finally` block, so a failure cannot leave the install on another clock.
 *
 * @package Title_Sparks
 */

defined( 'ABSPATH' ) || exit;

use Title_Sparks\Security;

/**
 * Run the anchor tests against a bootstrapped WordPress install.
 *
 * @return void
 */
function titlesparks_test_security_anchor() {
	$assertions = 0;
	$assert     = static function ( $condition, $message ) use ( &$assertions ) {
		++$assertions;

		if ( ! $condition ) {
			throw new RuntimeException( esc_html( $message ) );
		}
	};

	$previous_timezone = get_option( 'timezone_string' );
	$previous_offset   = get_option( 'gmt_offset' );

	try {
		// A site on a fixed offset with no daylight saving, so the expected
		// answer is the same in every month. India is UTC+05:30.
		update_option( 'timezone_string', 'Asia/Kolkata' );
		update_option( 'gmt_offset', 5.5 );

		$assert(
			'2026-10-28 15:30:00' === Security::anchor( '2026-10-28T10:00:00Z' ),
			'A value ending in Z must be stored as that instant on the site clock.'
		);
		$assert(
			'2026-10-28 15:30:00' === Security::anchor( '2026-10-28T10:00:00+00:00' ),
			'A value carrying a written offset must be converted the same way as Z.'
		);
		$assert(
			'2026-10-28 10:00:00' === Security::anchor( '2026-10-28 10:00:00' ),
			'A value with no offset is already site time and must be left alone.'
		);
		$assert(
			'' === Security::anchor( '' ),
			'An empty value must stay empty, so the renderer falls back to the post date.'
		);

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI test summary; the only placeholder is an integer counter.
		printf( "PASS: %d security-anchor PHP assertions\n", $assertions );
	} finally {
		update_option( 'timezone_string', $previous_timezone );
		update_option( 'gmt_offset', $previous_offset );
	}
}
