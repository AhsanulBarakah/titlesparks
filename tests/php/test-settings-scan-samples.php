<?php
/**
 * Tests for the deep scan's own sample read.
 *
 * The scan names each section after the source it came from, and the source for
 * an item's own content is the item itself: `Post: <title>`. That read is a
 * `get_posts()` of the most recent items per public post type, and it must not
 * suppress filters. A site filters its own queries — a multilingual plugin
 * restricting a language, a plugin hiding a post — and a scan that bypassed them
 * would report sections from pages nobody is served, naming items the reader
 * cannot see.
 *
 * The label has two branches as well: an item with a title names it, an untitled
 * one is named by its post type alone. The settings screen prints that label
 * verbatim, so both branches are pinned here.
 *
 * Run after loading WordPress, for example:
 * php -r 'require "path/to/wp-load.php"; require "tests/php/test-settings-scan-samples.php"; titlesparks_test_scan_samples();'
 *
 * The fixtures are posts this suite creates and deletes, and the scan's cache is
 * dropped on the way out.
 *
 * @package Title_Sparks
 */

defined( 'ABSPATH' ) || exit;

use Title_Sparks\Settings;

/**
 * Run the deep-scan sample tests against a bootstrapped WordPress install.
 *
 * @throws RuntimeException When an assertion fails.
 * @return void
 */
function titlesparks_test_scan_samples() {
	$settings   = Settings::instance();
	$assertions = 0;
	$assert     = static function ( $condition, $message ) use ( &$assertions ) {
		++$assertions;

		if ( ! $condition ) {
			throw new RuntimeException( esc_html( $message ) );
		}
	};

	$created = array();

	// The sample read is private and feeds the section scan; the assertions here
	// are about what it returns, so it is called directly.
	$samples = static function () use ( $settings ) {
		$method = new ReflectionMethod( Settings::class, 'content_sources' );
		$method->setAccessible( true );

		return $method->invoke( $settings );
	};

	$labels = static function ( array $sources ) {
		return array_column( $sources, 'label' );
	};

	/**
	 * Publish a fixture post and remember it for cleanup.
	 *
	 * @param string $title   Post title, empty for an untitled item.
	 * @param string $content Post content.
	 * @return int Post ID.
	 */
	$make_post = static function ( $title, $content ) use ( &$created ) {
		$post_id = wp_insert_post(
			array(
				'post_title'   => $title,
				'post_content' => $content,
				'post_status'  => 'publish',
				'post_type'    => 'post',
			),
			true
		);

		if ( is_wp_error( $post_id ) ) {
			throw new RuntimeException( esc_html( 'Could not create a fixture post: ' . $post_id->get_error_message() ) );
		}

		$created[] = (int) $post_id;

		return (int) $post_id;
	};

	try {
		$settings->forget_scan();

		$kind  = (string) get_post_type_object( 'post' )->labels->singular_name;
		$title = 'Titlesparks scan sample ' . wp_generate_password( 8, false, false );

		$probe_id = $make_post( $title, 'Sample content for the scan.' );

		$first = $samples();

		$assert(
			$first && array( 'singular' ) === $first[0]['contexts'],
			'Every sampled item must be recorded as a single-page source.'
		);

		$named = array_values(
			array_filter(
				$first,
				static function ( $source ) use ( $kind, $title ) {
					return $kind . ': ' . $title === $source['label'];
				}
			)
		);

		$assert(
			1 === count( $named ),
			'A published item with a title must be sampled once and named "Post: title".'
		);

		$assert(
			'Sample content for the scan.' === $named[0]['content'],
			'The sample named after an item must carry that item\'s own content.'
		);

		// A newer post would be the first sample for its type, so a scan that
		// honours the filter can only name the item the filter returns.
		$newer_id  = $make_post( 'Titlesparks newer sample ' . wp_generate_password( 8, false, false ), 'Newer sample content.' );
		$newer     = get_post( $newer_id );
		$observed  = array();
		$returned  = array( $probe_id );
		$pre_query = static function ( $posts, $query ) use ( &$observed, &$returned ) {
			if ( 'post' !== $query->get( 'post_type' ) ) {
				return $posts;
			}

			$observed['suppress_filters'] = $query->get( 'suppress_filters' );

			return $returned;
		};

		add_filter( 'posts_pre_query', $pre_query, 10, 2 );
		$filtered = $samples();
		remove_filter( 'posts_pre_query', $pre_query, 10 );

		$assert(
			array_key_exists( 'suppress_filters', $observed ),
			'The sample query must let posts_pre_query run; it only runs when the query does not suppress filters.'
		);

		$assert(
			empty( $observed['suppress_filters'] ),
			'The sample query must not set suppress_filters, which hides a site\'s own filtering from the read.'
		);

		$filtered_labels = $labels( $filtered );

		$assert(
			in_array( $kind . ': ' . $title, $filtered_labels, true ),
			'The sample read must return the item the site\'s own filter returned.'
		);

		$assert(
			! in_array( $kind . ': ' . $newer->post_title, $filtered_labels, true ),
			'A filtered sample must not still name the newest item the filter excluded.'
		);

		// The other branch: an item with no title is named by its type alone.
		$untitled_id = $make_post( '', 'Untitled sample content.' );
		$returned    = array( $untitled_id );

		add_filter( 'posts_pre_query', $pre_query, 10, 2 );
		$untitled = $labels( $samples() );
		remove_filter( 'posts_pre_query', $pre_query, 10 );

		$assert(
			in_array( $kind, $untitled, true ),
			'An untitled item must be named by its post type, with no title after a colon.'
		);

		$assert(
			! in_array( $kind . ': ', $untitled, true ),
			'An untitled item must not leave an empty title after the colon.'
		);

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI test summary; the only placeholder is an integer counter.
		printf( "PASS: %d deep-scan sample PHP assertions\n", $assertions );
	} finally {
		foreach ( $created as $post_id ) {
			wp_delete_post( $post_id, true );
		}

		$settings->forget_scan();
	}
}
