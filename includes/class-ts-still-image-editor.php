<?php
/**
 * Image editor that keeps only a GIF's first frame.
 *
 * `WP_Image_Editor_Imagick` loads every frame of an animated GIF and leaves the
 * iterator on the last one, which is the frame `save()` then writes. Later
 * frames of a GIF often store only the pixels that changed, so that last frame
 * can be almost entirely transparent — a still copied from it is a blank
 * picture.
 *
 * This subclass exists for one call and no other. `Asset_Library::still_editor()`
 * puts it at the front of the `wp_image_editors` filter, asks WordPress for an
 * editor, and removes the filter again, so every other image on the site is
 * handled exactly as it was before.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks;

defined( 'ABSPATH' ) || exit;

// Only when Imagick is installed: extending a class that does not exist is a
// fatal error, and a site without Imagick has nothing to override.
if ( class_exists( 'WP_Image_Editor_Imagick' ) ) {

	/**
	 * Class Still_Image_Editor
	 */
	final class Still_Image_Editor extends \WP_Image_Editor_Imagick {

		/**
		 * Load the image and keep only its first frame.
		 *
		 * The frames are flattened onto each other first. A GIF frame may
		 * describe only the pixels it changes, so the first frame on its own
		 * can be the transparent remainder; coalescing builds the picture a
		 * reader actually sees at that moment, and frame 0 of that sequence is
		 * the whole still.
		 *
		 * @return true|\WP_Error
		 */
		public function load() {
			$loaded = parent::load();

			if ( is_wp_error( $loaded ) ) {
				return $loaded;
			}

			try {
				$frames = $this->image->coalesceImages();
				$frames->setIteratorIndex( 0 );
				$first = $frames->getImage();

				$this->image->clear();
				$this->image = $first;
				$frames->clear();
			} catch ( \Exception $error ) {
				// The caller keeps the animated GIF rather than a half-made
				// still: a blank picture is worse than a moving one.
				return new \WP_Error(
					'titlesparks_still_frame',
					__( 'The first frame of this GIF could not be read.', 'titlesparks' )
				);
			}

			return true;
		}
	}
}
