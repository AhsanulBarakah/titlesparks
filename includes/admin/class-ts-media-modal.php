<?php
/**
 * The WordPress media modal, captured instead of enqueued.
 *
 * `wp_enqueue_media()` is the supported way to get the native uploader, but it
 * costs a megabyte of scripts, its footer templates and a handful of media
 * library queries — on every visit to the settings screen, for a modal that is
 * only opened when someone adds an asset. So the screen no longer enqueues it.
 * Instead the REST route `titlesparks/v1/media-modal` runs it inside an output
 * buffer and hands the client the exact markup wp-admin would have printed, in
 * the order wp-admin would have printed it: stylesheets, then each handle's
 * inline data (the `_wpMediaViewsL10n` settings and strings `media-views`
 * reads), then the script tags, then the modal templates.
 *
 * The client (see `blocks/shared/useMediaFrame.js`) injects those tags the first
 * time the modal is needed, which makes `wp.media` available. Skipping the work
 * per visit is the point; the markup itself is unchanged, so what opens is the
 * same modal, with the same strings, uploader and image editor.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Class Media_Modal
 */
final class Media_Modal {

	/**
	 * Handles `wp_enqueue_media()` needs, in the order wp-admin prints them.
	 *
	 * `media-editor` pulls in `media-views` and its dependencies (`jquery`,
	 * `underscore`, `backbone`, `wp-plupload`, …) through WordPress' own
	 * dependency resolution.
	 */
	const SCRIPTS = array( 'media-editor', 'media-audiovideo', 'mce-view', 'image-edit' );

	/**
	 * Stylesheets the modal needs.
	 */
	const STYLES = array( 'media-views', 'imgareaselect' );

	/**
	 * The markup that brings `wp.media` to life on the client.
	 *
	 * @return string
	 */
	public static function markup() {
		$scripts = wp_scripts();
		$styles  = wp_styles();

		// Concatenation depends on SCRIPT_DEBUG and would fold the handle list
		// into one load-scripts.php URL. Individual tags keep the payload the
		// client injects identical in development and in production, and let it
		// skip a handle the page already loaded.
		$scripts_concat = $scripts->do_concat;
		$styles_concat  = $styles->do_concat;

		$scripts->do_concat = false;
		$styles->do_concat  = false;

		ob_start();

		wp_enqueue_media();

		// `wp_enqueue_media()` only enqueues these inside wp-admin, and this
		// runs on a REST request. They are the image editor and the embed view
		// the modal offers, so the captured markup matches the admin screen.
		wp_enqueue_script( 'mce-view' );
		wp_enqueue_script( 'image-edit' );

		wp_print_scripts( self::SCRIPTS );
		wp_print_styles( self::STYLES );

		// The underscore templates the modal's views render into.
		wp_print_media_templates();

		$markup = (string) ob_get_clean();

		$scripts->do_concat = $scripts_concat;
		$styles->do_concat  = $styles_concat;

		return $markup;
	}
}
