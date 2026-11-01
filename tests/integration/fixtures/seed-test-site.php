<?php
/**
 * Seed a WordPress site for the browser checks.
 *
 * Run with `wp eval-file` after TitleSparks is active. It switches the feature
 * on for posts, puts one icon in the library, publishes a short run of posts
 * whose first stage is live, and prints the two URLs the checks need:
 *
 *   TITLESPARKS_TEST_POST_URL           the post a reader gets
 *   TITLESPARKS_TEST_EDITOR_URL         that post in the block editor
 *   TITLESPARKS_TEST_EXPIRED_POST_URL   a post whose timeline has ended
 *
 * Four posts, not one: a post page prints the posts published next to it
 * (`the_post_navigation()`, or WordPress's own post-navigation block), so the
 * neighbours have to exist — and carry icons of their own — before a check can
 * tell whether those two links are decorated. The middle one is the post under
 * test; the posts on either side are dated around it, which is all
 * `get_previous_post()` and `get_next_post()` read.
 *
 * The fourth is older than the rest and its timeline has already elapsed, which
 * is the fixture for the cached-page check: the page still carries its icon and
 * its boundaries, and the browser has to draw nothing.
 *
 * The timeline is written through `Post_Meta::save()`, so the fixture is
 * stored exactly as the editor would store it — a raw array here would be a
 * second, silently different contract.
 *
 * @package Title_Sparks
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( '\Title_Sparks\Settings' ) || ! class_exists( '\Title_Sparks\Post_Meta' ) ) {
	fwrite( STDERR, "TitleSparks is not active; activate the plugin first.\n" );
	exit( 1 );
}

/*
 * The icon file. A GIF is what the plugin is for, and its size on the page
 * comes from the CSS width, so a tiny one draws exactly like a large one while
 * keeping the fixture in the repository small.
 */
$gif = file_get_contents( __DIR__ . '/icon.gif' );

if ( false === $gif ) {
	fwrite( STDERR, "Missing fixtures/icon.gif beside this script.\n" );
	exit( 1 );
}

$upload = wp_upload_bits( 'titlesparks-test-icon.gif', null, $gif );

if ( ! empty( $upload['error'] ) ) {
	fwrite( STDERR, 'Could not write the fixture image: ' . $upload['error'] . "\n" );
	exit( 1 );
}

$asset_id = 'ci-icon';

$settings = \Title_Sparks\Settings::instance();

$settings->update(
	array(
		'enabled'    => true,
		'post_types' => array( 'post' ),
		'assets'     => array(
			array(
				'id'       => $asset_id,
				'label'    => 'Test spark',
				'url'      => $upload['url'],
				'size'     => '24px',
				'tags'     => array( 'test' ),
			),
		),
	)
);

$meta = new \Title_Sparks\Post_Meta();

/*
 * Each post gets a stage that runs for a month: `Decay::resolve()` counts from
 * the publish date, so stage one is the icon a reader sees. The neighbours'
 * stages carry a size of their own, so the two icons differ in what was drawn
 * as well as in the id they were stored under.
 *
 * The three are minutes apart, not hours, and that is deliberate: a new
 * WordPress install already holds "Hello world!", published when the site was
 * created — a moment before this script runs. `get_next_post()` returns the
 * *nearest* newer post, so a test post dated hours ago would have Hello world!
 * as its next neighbour rather than the post seeded here, and the page would
 * print an adjacent link that no fixture gave an icon. Minutes keep the seeded
 * posts the nearest ones on either side, whatever else the install holds.
 */
$fixture_posts = array(
	array(
		'title'  => 'Previous fixture post beside a live icon',
		'offset' => -30 * MINUTE_IN_SECONDS,
		'size'   => '28px',
	),
	array(
		'title'  => 'Test post with a live icon beside its title',
		'offset' => -20 * MINUTE_IN_SECONDS,
		'size'   => '',
	),
	array(
		'title'  => 'Next fixture post beside a live icon',
		'offset' => -10 * MINUTE_IN_SECONDS,
		'size'   => '20px',
	),
);

$created = array();

foreach ( $fixture_posts as $fixture ) {
	$post_id = wp_insert_post(
		array(
			'post_title'   => $fixture['title'],
			'post_content' => 'Fixture post for the TitleSparks browser checks.',
			'post_status'  => 'publish',
			'post_type'    => 'post',
		),
		true
	);

	if ( is_wp_error( $post_id ) ) {
		fwrite( STDERR, 'Could not create a fixture post: ' . $post_id->get_error_message() . "\n" );
		exit( 1 );
	}

	/*
	 * Placed on the clock explicitly. WordPress dates a post when it is saved,
	 * and the three are saved within the same second, which would leave the
	 * adjacent links to whichever order the rows came back in. Both stamps are
	 * written because WordPress reads the GMT one for ordering.
	 */
	$stamp = time() + $fixture['offset'];

	$placed = wp_update_post(
		array(
			'ID'            => $post_id,
			'post_date'     => wp_date( 'Y-m-d H:i:s', $stamp ),
			'post_date_gmt' => gmdate( 'Y-m-d H:i:s', $stamp ),
		),
		true
	);

	if ( is_wp_error( $placed ) ) {
		fwrite( STDERR, 'Could not date a fixture post: ' . $placed->get_error_message() . "\n" );
		exit( 1 );
	}

	$stage = array(
		'asset_id'     => $asset_id,
		'position'     => 'left',
		'flip'         => false,
		'duration'     => 30,
		'unit'         => 'days',
		'size'         => $fixture['size'],
		'size_mode'    => 'fixed',
		'sizing_rules' => array(),
	);

	$meta->save(
		$post_id,
		array(
			'enabled'           => true,
			'anchor'            => '',
			'stage_1'           => $stage,
			'stage_2'           => array_merge( $stage, array( 'asset_id' => '' ) ),
			'stage_3'           => array_merge( $stage, array( 'asset_id' => '' ) ),
			'stage_3_behaviour' => 'keep',
			'position_offsets'  => array(
				'left'  => array( 'x' => 0, 'y' => 0 ),
				'right' => array( 'x' => 0, 'y' => 0 ),
			),
			'icon_anchor'       => '',
			'icon_spacing'      => '',
		)
	);

	$created[] = array(
		'id'    => (int) $post_id,
		'title' => $fixture['title'],
	);
}

// The middle post is the one under test; the other two are its neighbours.
$post_id      = $created[1]['id'];
$previous_id  = $created[0]['id'];
$next_id      = $created[2]['id'];

$site = untrailingslashit( home_url() );

/*
 * The post whose timeline has ended.
 *
 * A cached page cannot ask the server which stage a reader sees, so every
 * boundary travels in the page and the browser decides. This is what that
 * decision looks like from the outside: an old post whose three stages have all
 * elapsed, each carrying an icon, so the timeline's `remove` answer is the only
 * reason nothing is drawn.
 *
 * It is dated hours back rather than beside the others because
 * `get_previous_post()` returns the nearest older post, and the previous link
 * on the post under test is measured by the adjacent-link check, which needs an
 * icon on it. An older post stays out of that pair.
 */
$expired_stage = array(
	'asset_id'     => $asset_id,
	'position'     => 'left',
	'flip'         => false,
	'duration'     => 5,
	'unit'         => 'minutes',
	'size'         => '',
	'size_mode'    => 'fixed',
	'sizing_rules' => array(),
);

$expired_id = wp_insert_post(
	array(
		'post_title'   => 'Fixture post whose timeline has expired',
		'post_content' => 'Fixture post for the TitleSparks cached-page check.',
		'post_status'  => 'publish',
		'post_type'    => 'post',
	),
	true
);

if ( is_wp_error( $expired_id ) ) {
	fwrite( STDERR, 'Could not create the expired fixture post: ' . $expired_id->get_error_message() . "\n" );
	exit( 1 );
}

$expired_stamp = time() - 3 * HOUR_IN_SECONDS;

$expired_placed = wp_update_post(
	array(
		'ID'            => $expired_id,
		'post_date'     => wp_date( 'Y-m-d H:i:s', $expired_stamp ),
		'post_date_gmt' => gmdate( 'Y-m-d H:i:s', $expired_stamp ),
	),
	true
);

if ( is_wp_error( $expired_placed ) ) {
	fwrite( STDERR, 'Could not date the expired fixture post: ' . $expired_placed->get_error_message() . "\n" );
	exit( 1 );
}

$meta->save(
	$expired_id,
	array(
		'enabled'           => true,
		'anchor'            => '',
		'stage_1'           => $expired_stage,
		'stage_2'           => $expired_stage,
		'stage_3'           => $expired_stage,
		'stage_3_behaviour' => 'remove',
		'position_offsets'  => array(
			'left'  => array( 'x' => 0, 'y' => 0 ),
			'right' => array( 'x' => 0, 'y' => 0 ),
		),
		'icon_anchor'       => '',
		'icon_spacing'      => '',
	)
);

printf( "post_id=%d\n", (int) $post_id );
printf( "previous_post_id=%d\n", (int) $previous_id );
printf( "next_post_id=%d\n", (int) $next_id );
printf( "TITLESPARKS_TEST_POST_URL=%s/?p=%d\n", $site, (int) $post_id );
printf(
	"TITLESPARKS_TEST_EDITOR_URL=%s/wp-admin/post.php?post=%d&action=edit\n",
	$site,
	(int) $post_id
);
printf( "TITLESPARKS_TEST_EXPIRED_POST_URL=%s/?p=%d\n", $site, (int) $expired_id );
