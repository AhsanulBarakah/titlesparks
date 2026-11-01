<?php
/**
 * Lifecycle tests: uninstall cleanup and the cached scan's save guard.
 *
 * Two findings are pinned here.
 *
 * - Deleting the plugin has to remove everything it wrote — the settings
 *   option, every post timeline, and both transients — and nothing it did not
 *   write. Media attachments are the case that matters: the asset library
 *   points at images in the Media Library, which belong to the site.
 * - `save_post` fires for autosaves, revisions, menu items and non-public post
 *   types, and none of those can change what the deep scan read. Forgetting the
 *   cache for them made the next page view rescan every template for nothing.
 * - A save that can change the scan keeps the cached copy and marks it stale,
 *   so a visitor's request is never the one that rebuilds it.
 *
 * Run after loading WordPress, for example:
 * php -r 'require "path/to/wp-load.php"; require "tests/php/test-uninstall-and-scan-cache.php"; titlesparks_test_uninstall_and_scan_cache();'
 *
 * The uninstall half deletes every timeline row on the site, because that is
 * what `delete_post_meta_by_key()` does: the rows are captured first and
 * written back in a `finally` block, along with the option and both
 * transients. Every fixture post is deleted on the way out.
 *
 * @package Title_Sparks
 */

defined( 'ABSPATH' ) || exit;

use Title_Sparks\Settings;

/**
 * Run the lifecycle tests against a bootstrapped WordPress install.
 *
 * @return void
 */
function titlesparks_test_uninstall_and_scan_cache() {
	$settings   = Settings::instance();
	$assertions = 0;
	$assert     = static function ( $condition, $message ) use ( &$assertions ) {
		++$assertions;

		if ( ! $condition ) {
			throw new RuntimeException( esc_html( $message ) );
		}
	};

	// Uninstall runs the multisite loop for every site it can see. This suite
	// captures only the blog it is running on, so it refuses to start on a
	// network rather than wipe the timelines of sites it cannot put back.
	if ( is_multisite() ) {
		throw new RuntimeException( 'Run this suite on a single-site install.' );
	}

	global $wpdb;		$created_posts    = array();
		$registered_types = array();
		$previous_option  = get_option( 'titlesparks_settings', null );
	$previous_meta   = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT post_id, meta_value FROM {$wpdb->postmeta} WHERE meta_key = %s",
			'_titlesparks_timeline_schema'
		),
		ARRAY_A
	);
	$previous_scan     = get_transient( 'titlesparks_scanned_sections' );
	$previous_contexts = get_transient( 'titlesparks_sidebar_contexts' );

	try {
		$post_id = wp_insert_post(
			array(
				'post_title'   => 'TitleSparks lifecycle fixture',
				'post_content' => 'Fixture content for the lifecycle suite.',
				'post_status'  => 'publish',
				'post_type'    => 'post',
			)
		);

		$attachment_id = wp_insert_post(
			array(
				'post_title'     => 'TitleSparks lifecycle image',
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'post_mime_type' => 'image/gif',
				'guid'           => 'https://example.invalid/titlesparks-fixture.gif',
			)
		);

		$created_posts = array( $post_id, $attachment_id );

		$assert( $post_id > 0, 'The fixture post must be created.' );

		// Uninstall: everything the plugin wrote, and nothing else.
		update_option( 'titlesparks_settings', array( 'enabled' => true ) );
		update_post_meta( $post_id, '_titlesparks_timeline_schema', '{"enabled":true}' );
		set_transient( 'titlesparks_scanned_sections', array( array( 'id' => 'fixture' ) ), WEEK_IN_SECONDS );
		set_transient( 'titlesparks_sidebar_contexts', array( 'sidebar-1' => array( 'home' ) ), WEEK_IN_SECONDS );

		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			define( 'WP_UNINSTALL_PLUGIN', 'titlesparks/titlesparks.php' );
		}

		require dirname( __DIR__, 2 ) . '/uninstall.php';

		$assert(
			false === get_option( 'titlesparks_settings' ),
			'Uninstall must delete the settings option.'
		);
		$assert(
			'' === get_post_meta( $post_id, '_titlesparks_timeline_schema', true ),
			'Uninstall must delete every stored post timeline.'
		);
		$assert(
			false === get_transient( 'titlesparks_scanned_sections' ),
			'Uninstall must delete the cached scan.'
		);
		$assert(
			false === get_transient( 'titlesparks_sidebar_contexts' ),
			'Uninstall must delete the cached sidebar map.'
		);
		$assert(
			false === get_option( 'titlesparks_scan_stale' ),
			'Uninstall must delete the stale-scan mark.'
		);
		$assert(
			false === get_transient( 'titlesparks_scan_lock' ),
			'Uninstall must delete the scan rebuild lock.'
		);
		$assert(
			get_post( $attachment_id ) instanceof WP_Post,
			'Uninstall must leave media attachments in the library.'
		);

		// A real save on a public post keeps the cached scan and marks it stale,
		// so a visitor is still served the last scan and the rebuild is queued
		// for cron rather than run during that visitor's request.
		$settings->flush_cache();
		delete_option( 'titlesparks_scan_stale' );
		wp_clear_scheduled_hook( 'titlesparks_rebuild_scan' );
		set_transient( 'titlesparks_scanned_sections', array(), WEEK_IN_SECONDS );
		$settings->forget_scan_on_save( $post_id );
		$assert(
			false !== get_transient( 'titlesparks_scanned_sections' ),
			'Saving a public post must keep the cached scan for visitors.'
		);
		$assert(
			false !== get_option( 'titlesparks_scan_stale' ),
			'Saving a public post must mark the cached scan stale.'
		);
		$assert(
			false !== wp_next_scheduled( 'titlesparks_rebuild_scan' ),
			'Saving a public post must queue one scan rebuild.'
		);

		// A revision is a copy of content, not content.
		$revision_id     = wp_insert_post(
			array(
				'post_type'   => 'revision',
				'post_status' => 'inherit',
				'post_parent' => $post_id,
				'post_title'  => 'TitleSparks lifecycle revision',
				'post_name'   => $post_id . '-revision-v1',
			)
		);
		$created_posts[] = $revision_id;

		set_transient( 'titlesparks_scanned_sections', array(), WEEK_IN_SECONDS );
		$settings->forget_scan_on_save( $revision_id );
		$assert(
			false !== get_transient( 'titlesparks_scanned_sections' ),
			'Saving a revision must not drop the cached scan.'
		);

		// An autosave is stored the same way, under its parent's name.
		$autosave_id     = wp_insert_post(
			array(
				'post_type'   => 'revision',
				'post_status' => 'inherit',
				'post_parent' => $post_id,
				'post_title'  => 'TitleSparks lifecycle autosave',
				'post_name'   => $post_id . '-autosave',
			)
		);
		$created_posts[] = $autosave_id;

		$assert(
			wp_is_post_autosave( $autosave_id ),
			'The autosave fixture must be recognised as an autosave.'
		);

		set_transient( 'titlesparks_scanned_sections', array(), WEEK_IN_SECONDS );
		$settings->forget_scan_on_save( $autosave_id );
		$assert(
			false !== get_transient( 'titlesparks_scanned_sections' ),
			'Saving an autosave must not drop the cached scan.'
		);

		// A menu item never appears in the scan.
		$menu_item_id    = wp_insert_post(
			array(
				'post_type'   => 'nav_menu_item',
				'post_status' => 'publish',
				'post_title'  => 'TitleSparks lifecycle menu item',
			)
		);
		$created_posts[] = $menu_item_id;

		set_transient( 'titlesparks_scanned_sections', array(), WEEK_IN_SECONDS );
		$settings->forget_scan_on_save( $menu_item_id );
		$assert(
			false !== get_transient( 'titlesparks_scanned_sections' ),
			'Saving a menu item must not drop the cached scan.'
		);

		// A Site Editor template is not public, but the scan parses it, so a
		// template edit has to refresh the section list on the next request.
		foreach ( array( 'wp_template', 'wp_template_part' ) as $template_type ) {
			if ( ! post_type_exists( $template_type ) ) {
				register_post_type(
					$template_type,
					array(
						'label'  => $template_type,
						'public' => false,
					)
				);
				$registered_types[] = $template_type;
			}

			$template_id     = wp_insert_post(
				array(
					'post_type'   => $template_type,
					'post_status' => 'publish',
					'post_title'  => 'TitleSparks lifecycle template',
				)
			);
			$created_posts[] = $template_id;

			delete_option( 'titlesparks_scan_stale' );
			set_transient( 'titlesparks_scanned_sections', array(), WEEK_IN_SECONDS );
			$settings->forget_scan_on_save( $template_id );
			$assert(
				false !== get_transient( 'titlesparks_scanned_sections' ),
				sprintf( 'Saving a %s must keep the cached scan.', $template_type )
			);
			$assert(
				false !== get_option( 'titlesparks_scan_stale' ),
				sprintf( 'Saving a %s must mark the cached scan stale.', $template_type )
			);
		}

		// Nor does any post type the scan cannot see.
		register_post_type(
			'ts_private_fixture',
			array(
				'label'  => 'TitleSparks private fixture',
				'public' => false,
			)
		);

		$private_id      = wp_insert_post(
			array(
				'post_type'   => 'ts_private_fixture',
				'post_status' => 'publish',
				'post_title'  => 'TitleSparks lifecycle private',
			)
		);
		$created_posts[] = $private_id;

		delete_option( 'titlesparks_scan_stale' );
		set_transient( 'titlesparks_scanned_sections', array(), WEEK_IN_SECONDS );
		$settings->forget_scan_on_save( $private_id );
		$assert(
			false !== get_transient( 'titlesparks_scanned_sections' ),
			'Saving a non-public post type must not drop the cached scan.'
		);
		$assert(
			false === get_option( 'titlesparks_scan_stale' ),
			'Saving a non-public post type must not mark the cached scan stale.'
		);

		unregister_post_type( 'ts_private_fixture' );
		delete_transient( 'titlesparks_scanned_sections' );
		delete_option( 'titlesparks_scan_stale' );
		wp_clear_scheduled_hook( 'titlesparks_rebuild_scan' );

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI test summary; the only placeholder is an integer counter.
		printf( "PASS: %d lifecycle PHP assertions\n", $assertions );
	} finally {
		// Put every timeline row back; the uninstall file deleted them all.
		foreach ( (array) $previous_meta as $row ) {
			update_post_meta(
				(int) $row['post_id'],
				'_titlesparks_timeline_schema',
				$row['meta_value']
			);
		}

		if ( null === $previous_option ) {
			delete_option( 'titlesparks_settings' );
		} else {
			update_option( 'titlesparks_settings', $previous_option );
		}

		if ( false === $previous_scan ) {
			delete_transient( 'titlesparks_scanned_sections' );
		} else {
			set_transient( 'titlesparks_scanned_sections', $previous_scan, WEEK_IN_SECONDS );
		}

		if ( false === $previous_contexts ) {
			delete_transient( 'titlesparks_sidebar_contexts' );
		} else {
			set_transient( 'titlesparks_sidebar_contexts', $previous_contexts, WEEK_IN_SECONDS );
		}

		foreach ( $created_posts as $created_post ) {
			if ( $created_post > 0 ) {
				wp_delete_post( $created_post, true );
			}
		}

		if ( post_type_exists( 'ts_private_fixture' ) ) {
			unregister_post_type( 'ts_private_fixture' );
		}

		foreach ( $registered_types as $registered_type ) {
			if ( post_type_exists( $registered_type ) ) {
				unregister_post_type( $registered_type );
			}
		}

		$settings->flush_cache();
	}
}
