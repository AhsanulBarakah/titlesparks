<?php
/**
 * The global library of GIFs, icons and images.
 *
 * A thin read/write facade over the `assets` key of the settings row. It exists
 * so the renderer, the admin REST controller and the block editor sidebar all
 * resolve an asset identifier through the same method, and so a missing asset
 * can never produce a broken `<img>` on the front end.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks;

defined( 'ABSPATH' ) || exit;

/**
 * Class Asset_Library
 */
final class Asset_Library {

	/**
	 * Suffix of the still frame this plugin writes beside an animated GIF.
	 *
	 * A file carrying this suffix is the plugin's own work rather than the
	 * site's: uninstall deletes those files and nothing else, so a site's
	 * originals are never at risk.
	 */
	const STILL_SUFFIX = '-titlesparks-still';

	/**
	 * Post meta holding the URL of an attachment's still frame.
	 *
	 * It lives on the attachment rather than in the settings row so a page view
	 * never has to write the option. The value is the URL when a still was
	 * made, or `failed` when one could not be made — recorded so the attempt is
	 * not repeated on every request.
	 */
	const STILL_META = '_titlesparks_still_url';

	/**
	 * Stored answer meaning "a still frame could not be made".
	 */
	const STILL_FAILED = 'failed';

	/**
	 * Settings store.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Constructor.
	 *
	 * @param Settings|null $settings Optional settings store.
	 */
	public function __construct( ?Settings $settings = null ) {
		$this->settings = $settings ? $settings : Settings::instance();
	}

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'delete_attachment', array( $this, 'delete_attachment_still' ) );
	}

	/**
	 * Remove the still frame of a deleted attachment.
	 *
	 * The frame carries this plugin's own suffix, so it is the plugin's to
	 * remove; the attachment's own files are WordPress' to delete. The hook
	 * runs before core deletes them, which is what lets `still_file()` resolve
	 * the path beside the original.
	 *
	 * @param int $attachment_id Attachment being deleted.
	 * @return void
	 */
	public function delete_attachment_still( $attachment_id ) {
		$attachment_id = (int) $attachment_id;

		if ( $attachment_id <= 0 ) {
			return;
		}

		$file = get_attached_file( $attachment_id );

		if ( $file ) {
			$still = self::still_file( $file );

			if ( file_exists( $still ) ) {
				wp_delete_file( $still );
			}
		}

		delete_post_meta( $attachment_id, self::STILL_META );
	}

	/**
	 * Every asset in the library.
	 *
	 * @return array[]
	 */
	public function all() {
		$assets = $this->settings->get( 'assets', array() );

		return is_array( $assets ) ? array_values( $assets ) : array();
	}

	/**
	 * Find one asset by identifier.
	 *
	 * @param mixed $id Asset identifier.
	 * @return array|null Null when no asset matches.
	 */
	public function get( $id ) {
		$id = Security::asset_id( $id );

		if ( '' === $id ) {
			return null;
		}

		foreach ( $this->all() as $asset ) {
			if ( isset( $asset['id'] ) && $asset['id'] === $id ) {
				return $asset;
			}
		}

		return null;
	}

	/**
	 * Whether an asset identifier still resolves.
	 *
	 * @param mixed $id Asset identifier.
	 * @return bool
	 */
	public function has( $id ) {
		return null !== $this->get( $id );
	}

	/**
	 * A lightweight list for the editors (`id`, `label`, `url`, `preview`, `size`,
	 * `tags`).
	 *
	 * The admin UI only needs enough to render a preview; attachment IDs stay on
	 * the server. `url` is the original file — the one the front end draws — and
	 * `preview` is WordPress' own smaller copy of it, for grids. `tags` travels
	 * with the row because the library's folders are tag filters: the browser
	 * needs the tags to decide what a folder contains, and re-fetching the
	 * library per folder would make a folder switch a round trip.
	 *
	 * @return array[]
	 */
	public function to_editor_list() {
		$list = array();

		foreach ( $this->all() as $asset ) {
			if ( empty( $asset['id'] ) || empty( $asset['url'] ) ) {
				continue;
			}

			$list[] = array(
				'id'      => (string) $asset['id'],
				'label'   => ( isset( $asset['label'] ) && '' !== $asset['label'] ) ? (string) $asset['label'] : (string) $asset['id'],
				'url'     => (string) $asset['url'],
				'preview' => $this->preview_url( $asset ),
				'size'    => ( isset( $asset['size'] ) && '' !== $asset['size'] ) ? (string) $asset['size'] : '20px',
				'tags'    => Security::asset_tags( isset( $asset['tags'] ) ? $asset['tags'] : array() ),
			);
		}

		return $list;
	}

	/**
	 * A small still copy of an asset's image, for list and grid previews.
	 *
	 * An animated GIF is routinely several megabytes — the whole point of the
	 * file is that it moves — but a 96-pixel card only needs one frame of it.
	 * WordPress' own intermediate size is exactly that, so the grid paints from
	 * `medium` (or `thumbnail`) and the animated original is loaded afterwards.
	 *
	 * @param array $asset Stored asset row.
	 * @return string Empty string when the asset has no smaller copy, or is not
	 *                an attachment WordPress can size.
	 */
	private function preview_url( array $asset ) {
		$attachment_id = isset( $asset['attachment_id'] ) ? (int) $asset['attachment_id'] : 0;
		$asset_url     = isset( $asset['url'] ) ? $asset['url'] : '';

		if ( $attachment_id <= 0 ) {
			return '';
		}

		foreach ( array( 'medium', 'thumbnail' ) as $size ) {
			$src = wp_get_attachment_image_src( $attachment_id, $size );

			if ( is_array( $src ) && ! empty( $src[0] ) && $src[0] !== $asset_url ) {
				return (string) $src[0];
			}
		}

		return '';
	}

	/**
	 * A single still frame of an asset's animated image.
	 *
	 * CSS cannot pause an animated GIF, so a reader who has asked their system
	 * for less motion can be drawn the same picture without the movement. Three
	 * copies are tried, in this order:
	 *
	 * 1. The still frame this plugin wrote beside the original, at the
	 *    original's own width and height and never cropped. Its URL is stored on
	 *    the attachment (`_titlesparks_still_url`), and an asset row also carries
	 *    its own copy in `still_url` because `from_attachment()` builds one as
	 *    the asset is added.
	 * 2. WordPress' `medium` copy. It is not cropped, but WordPress only makes
	 *    it when the original is larger than the size — which rules out most
	 *    title icons.
	 * 3. WordPress' `thumbnail` copy, as a last resort. It is usually cropped to
	 *    a square, so a wide GIF loses its edges.
	 *
	 * A missing still is only made during an admin, REST or WP-CLI request; a
	 * visitor's page view never writes a file or the settings row. The settings
	 * screen makes a few of them per load instead (`build_missing_stills()`), so
	 * a large library catches up over a few visits without a page view touching
	 * the database.
	 *
	 * Only animated GIFs are offered: an ordinary image is already still, and
	 * swapping it for a smaller copy would change the site's look for nothing.
	 *
	 * @param array $asset Stored asset row.
	 * @return string Empty string when the asset is not an animated GIF, or when
	 *                no still copy can be made or found.
	 */
	public function still_url( array $asset ) {
		$attachment_id = isset( $asset['attachment_id'] ) ? (int) $asset['attachment_id'] : 0;

		if ( $attachment_id <= 0 || 'image/gif' !== get_post_mime_type( $attachment_id ) ) {
			return '';
		}

		$stored = isset( $asset['still_url'] ) ? (string) $asset['still_url'] : '';

		if ( '' !== $stored ) {
			return $stored;
		}

		$meta = (string) get_post_meta( $attachment_id, self::STILL_META, true );

		if ( '' !== $meta && self::STILL_FAILED !== $meta ) {
			return $meta;
		}

		// An empty value is "never tried"; `failed` is a recorded answer and
		// is not retried. Neither is built while a visitor is reading a page.
		if ( '' === $meta && $this->may_build_still() ) {
			$built = $this->build_still( $attachment_id );

			if ( '' !== $built ) {
				return $built;
			}
		}

		return $this->preview_url( $asset );
	}

	/**
	 * Whether this request may write a still frame.
	 *
	 * Building one writes a file and a meta row. That is fine while an
	 * administrator is looking at the library, and wrong during a visitor's page
	 * view: two requests writing the same row would race, and a failed write
	 * would be attempted again on every next request.
	 *
	 * @return bool
	 */
	private function may_build_still() {
		return is_admin() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || ( defined( 'WP_CLI' ) && WP_CLI );
	}

	/**
	 * Make still frames for animated GIFs in the library that have none yet.
	 *
	 * Called while the settings screen loads the library, which is an admin or
	 * REST request: a visitor's page view never builds one. A large library
	 * would otherwise do all of them in one request, so a few are made per load
	 * and the rest follow on later visits.
	 *
	 * @param int $limit Most frames to make now.
	 * @return int How many were made.
	 */
	public function build_missing_stills( $limit = 5 ) {
		$limit = max( 1, (int) $limit );
		$made  = 0;

		foreach ( $this->all() as $asset ) {
			if ( $made >= $limit ) {
				break;
			}

			$attachment_id = isset( $asset['attachment_id'] ) ? (int) $asset['attachment_id'] : 0;

			if ( $attachment_id <= 0 || 'image/gif' !== get_post_mime_type( $attachment_id ) ) {
				continue;
			}

			// Non-empty covers both a URL and `failed`, so neither is retried.
			if ( '' !== (string) get_post_meta( $attachment_id, self::STILL_META, true ) ) {
				continue;
			}

			if ( '' !== $this->build_still( $attachment_id ) ) {
				++$made;
			}
		}

		return $made;
	}

	/**
	 * Make a still frame and remember the answer on the attachment.
	 *
	 * The meta is written either way: the URL when a frame was made, `failed`
	 * when it could not be, so a GIF no editor can read is not retried forever.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return string URL of the still frame, or an empty string.
	 */
	private function build_still( $attachment_id ) {
		$url = $this->create_still( $attachment_id );

		update_post_meta( $attachment_id, self::STILL_META, '' === $url ? self::STILL_FAILED : $url );

		return $url;
	}

	/**
	 * Write a still frame of an animated GIF beside its original.
	 *
	 * The copy keeps the original's width and height and is never cropped, so a
	 * wide icon stays wide. WordPress' own intermediate sizes cannot be relied
	 * on: it only makes them when the original is larger than the size, and its
	 * thumbnail is cropped square.
	 *
	 * GD reads a GIF's first frame by itself (`imagecreatefromgif()`). Imagick
	 * loads every frame and leaves the iterator on the last one, so the editor
	 * is asked for through `still_editor()`, which puts a first-frame subclass
	 * ahead of the others for this call only. If no frame can be selected the
	 * copy is abandoned and the caller keeps the animated GIF.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return string URL of the still frame, or an empty string when there is
	 *                no editor or nothing to read.
	 */
	private function create_still( $attachment_id ) {
		$file = get_attached_file( $attachment_id );
		$url  = wp_get_attachment_image_url( $attachment_id, 'full' );

		if ( ! $file || ! $url || ! file_exists( $file ) ) {
			return '';
		}

		$still = self::still_file( $file );

		if ( ! file_exists( $still ) ) {
			$editor = $this->still_editor( $file );

			// No editor, no copy: the caller keeps the animated original.
			if ( is_wp_error( $editor ) ) {
				return '';
			}

			// Saving without resizing keeps the original's own dimensions.
			$saved = $editor->save( $still, 'image/png' );

			if ( is_wp_error( $saved ) ) {
				return '';
			}
		}

		return trailingslashit( dirname( $url ) ) . wp_basename( $still );
	}

	/**
	 * Ask WordPress for an editor that keeps a GIF's first frame.
	 *
	 * GD needs nothing: it reads the first frame of a GIF already. Only Imagick
	 * gets the subclass, and only through this one call — the filter is added
	 * before the editor is asked for and removed immediately afterwards.
	 *
	 * @param string $file Image file path.
	 * @return \WP_Image_Editor|\WP_Error
	 */
	private function still_editor( $file ) {
		// Load core's editor classes first. `Still_Image_Editor` is defined only
		// when `WP_Image_Editor_Imagick` already exists, and core does not load
		// it until `wp_get_image_editor()` runs — which is the call below, after
		// the autoloader has already loaded the subclass file. Without these two
		// requires the guard in that file fails and the stock Imagick editor
		// saves the GIF's last, mostly transparent frame.
		require_once ABSPATH . WPINC . '/class-wp-image-editor.php';
		require_once ABSPATH . WPINC . '/class-wp-image-editor-imagick.php';

		$use_imagick = class_exists( __NAMESPACE__ . '\\Still_Image_Editor' );

		if ( $use_imagick ) {
			add_filter( 'wp_image_editors', array( __CLASS__, 'prefer_still_editor' ) );
		}

		$editor = wp_get_image_editor( $file );

		if ( $use_imagick ) {
			remove_filter( 'wp_image_editors', array( __CLASS__, 'prefer_still_editor' ) );
		}

		return $editor;
	}

	/**
	 * Put the first-frame editor ahead of the other editors.
	 *
	 * @param string[] $editors Editor class names, best first.
	 * @return string[]
	 */
	public static function prefer_still_editor( $editors ) {
		array_unshift( $editors, __NAMESPACE__ . '\\Still_Image_Editor' );

		return $editors;
	}

	/**
	 * Path of the still frame belonging to an attachment's file.
	 *
	 * @param string $file Absolute path of the original.
	 * @return string
	 */
	public static function still_file( $file ) {
		$path = pathinfo( $file );

		return $path['dirname'] . '/' . $path['filename'] . self::STILL_SUFFIX . '.png';
	}

	/**
	 * Remove the still frame this plugin wrote for an asset.
	 *
	 * Only the file carrying the plugin's suffix is touched: the attachment it
	 * was made from is the site's own image and stays in the Media Library. Two
	 * library rows can point at the same attachment — the same picture saved
	 * under a second name, for instance — so the file and its meta are removed
	 * only when the deleted row was the last one using it.
	 *
	 * @param array $asset Stored asset row being removed.
	 * @param array $kept  Rows that remain in the library.
	 * @return void
	 */
	private function delete_still( array $asset, array $kept ) {
		$attachment_id = isset( $asset['attachment_id'] ) ? (int) $asset['attachment_id'] : 0;

		if ( $attachment_id <= 0 ) {
			return;
		}

		foreach ( $kept as $row ) {
			if ( isset( $row['attachment_id'] ) && (int) $row['attachment_id'] === $attachment_id ) {
				return;
			}
		}

		$file = get_attached_file( $attachment_id );

		if ( ! $file ) {
			return;
		}

		$still = self::still_file( $file );

		if ( file_exists( $still ) ) {
			wp_delete_file( $still );
		}

		delete_post_meta( $attachment_id, self::STILL_META );
	}

	/**
	 * Build a library row from a WordPress attachment.
	 *
	 * @param mixed  $attachment_id Attachment ID.
	 * @param string $label         Optional label; defaults to the attachment title.
	 * @return array|null Null when the attachment is invalid.
	 */
	public function from_attachment( $attachment_id, $label = '' ) {
		$attachment_id = Security::attachment_id( $attachment_id );

		if ( ! $attachment_id || ! Security::can_edit_attachment( $attachment_id ) ) {
			return null;
		}

		$url = wp_get_attachment_image_url( $attachment_id, 'full' );

		if ( ! $url ) {
			return null;
		}

		if ( '' === $label ) {
			$label = get_the_title( $attachment_id );
		}

		return Security::library_asset(
			array(
				'id'            => 'att-' . $attachment_id,
				'label'         => $label,
				'url'           => $url,
				'attachment_id' => $attachment_id,
				'size'          => '',
				// A still copy is written now, while an administrator is adding
				// the asset, so a reader who asked for less motion never waits for
				// one to be made during a page view.
				'still_url'     => 'image/gif' === get_post_mime_type( $attachment_id )
					? $this->build_still( $attachment_id )
					: '',
			)
		);
	}

	/**
	 * Replace the whole library.
	 *
	 * @param array[] $assets Sanitized asset rows.
	 * @return array[] The stored library.
	 */
	public function replace( array $assets ) {
		$settings = $this->settings->all();

		$settings['assets'] = $assets;

		$stored = $this->settings->update( $settings );

		return $stored['assets'];
	}

	/**
	 * Add or update a single asset, keyed by identifier.
	 *
	 * @param array $asset Raw asset row.
	 * @return array|null The stored asset, or null when it was invalid.
	 */
	public function save( array $asset ) {
		$clean = Security::library_asset( $asset );

		if ( '' === $clean['id'] || '' === $clean['url'] ) {
			return null;
		}

		$assets = $this->all();
		$found  = false;

		foreach ( $assets as $index => $existing ) {
			if ( isset( $existing['id'] ) && $existing['id'] === $clean['id'] ) {
				$assets[ $index ] = $clean;
				$found            = true;
				break;
			}
		}

		if ( ! $found ) {
			$assets[] = $clean;
		}

		$this->replace( $assets );

		return $clean;
	}

	/**
	 * Delete an asset from the library.
	 *
	 * @param mixed $id Asset identifier.
	 * @return bool Whether something was removed.
	 */
	public function delete( $id ) {
		$id = Security::asset_id( $id );

		if ( '' === $id ) {
			return false;
		}

		$assets  = $this->all();
		$kept    = array();
		$removed = null;

		foreach ( $assets as $asset ) {
			if ( isset( $asset['id'] ) && $asset['id'] === $id ) {
				$removed = $asset;
				continue;
			}

			$kept[] = $asset;
		}

		if ( null === $removed ) {
			return false;
		}

		$this->delete_still( $removed, $kept );
		$this->replace( $kept );

		return true;
	}
}
