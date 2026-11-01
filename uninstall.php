<?php
/**
 * Uninstall cleanup.
 *
 * WordPress runs this file instead of the plugin when a site deletes
 * TitleSparks, so `titlesparks.php` has not been loaded and its constants do
 * not exist here: the names below are literal copies of
 * `TITLE_SPARKS_OPTION_NAME`, `TITLE_SPARKS_META_KEY`, the still-frame meta
 * `Asset_Library::STILL_META` and the two transients `Title_Sparks\Settings`
 * owns. They are the only rows the plugin writes, so a deleted plugin leaves
 * nothing behind — and nothing else is touched.
 *
 * Media attachments are deliberately left alone. The asset library points at
 * images in the Media Library, and those images belong to the site rather than
 * to this plugin: a post, a page or another plugin may be using them. The only
 * image files deleted are the still frames this plugin wrote beside an animated
 * GIF, which carry the plugin's own `-titlesparks-still` suffix.
 *
 * @package Title_Sparks
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

/**
 * Delete everything the plugin stored for the current site.
 *
 * @return void
 */
function titlesparks_uninstall_site() {
	// The still frames written beside animated GIFs, and the meta that records
	// them. Both lists are read before anything is deleted: the library first,
	// then every attachment still carrying the meta, so a frame outlives a row
	// that was removed from the library. Only a path ending in the plugin's own
	// suffix is ever built for deletion — never the attachment's own file.
	$attachment_ids = array();
	$settings       = get_option( 'titlesparks_settings', array() );

	if ( is_array( $settings ) && ! empty( $settings['assets'] ) && is_array( $settings['assets'] ) ) {
		foreach ( $settings['assets'] as $asset ) {
			if ( ! empty( $asset['attachment_id'] ) ) {
				$attachment_ids[] = (int) $asset['attachment_id'];
			}
		}
	}

	// One indexed lookup for every row carrying the meta. It returns post IDs
	// for any post type; `get_attached_file()` below answers an empty string for
	// anything that is not an attachment, so those are skipped. A direct query
	// is used because `get_post_meta_by_key()` lives in the admin includes, and
	// uninstall may run without them.
	global $wpdb;

	$recorded = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall: one one-off read, and no cache applies to a table being emptied.
		$wpdb->prepare(
			"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s",
			'_titlesparks_still_url'
		)
	);

	foreach ( $recorded as $recorded_id ) {
		$attachment_ids[] = (int) $recorded_id;
	}

	foreach ( array_unique( $attachment_ids ) as $attachment_id ) {
		$file = get_attached_file( $attachment_id );

		if ( ! $file ) {
			continue;
		}

		$path  = pathinfo( $file );
		$still = $path['dirname'] . '/' . $path['filename'] . '-titlesparks-still.png';

		if ( file_exists( $still ) ) {
			wp_delete_file( $still );
		}
	}

	// The record of which GIFs have a still frame, on the attachments that are
	// no longer in the library by now.
	delete_post_meta_by_key( '_titlesparks_still_url' );

	// The global settings row, holding the switches and the asset library.
	delete_option( 'titlesparks_settings' );

	// Every post's three stage timeline, in one query rather than one per post.
	delete_post_meta_by_key( '_titlesparks_timeline_schema' );

	// The cached deep scan and the cached sidebar map. Both are written with a
	// week's lifetime; deleting them here means a reinstall scans afresh
	// instead of reading selectors from a theme that may since have changed.
	delete_transient( 'titlesparks_scanned_sections' );
	delete_transient( 'titlesparks_sidebar_contexts' );

	// The mark that says the cached scan needs a rebuild, and the lock a
	// rebuild holds while it runs.
	delete_option( 'titlesparks_scan_stale' );
	delete_transient( 'titlesparks_scan_lock' );
}

if ( is_multisite() ) {
	// Every site keeps its own option row, post meta and transients. `number`
	// of 0 asks for all of them rather than the first page of a hundred.
	$titlesparks_sites = get_sites(
		array(
			'fields' => 'ids',
			'number' => 0,
		)
	);

	foreach ( $titlesparks_sites as $titlesparks_site_id ) {
		switch_to_blog( (int) $titlesparks_site_id );
		titlesparks_uninstall_site();
		restore_current_blog();
	}
} else {
	titlesparks_uninstall_site();
}
