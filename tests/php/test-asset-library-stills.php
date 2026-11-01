<?php
/**
 * Still-frame tests for the asset library.
 *
 * Two things are pinned here.
 *
 * - A still frame belongs to its attachment, not to one library row. Two rows
 *   can point at the same attachment — the same picture saved under a second
 *   name — and deleting one of them must not take the frame the other still
 *   draws.
 * - The still of an animated GIF has to be the picture a reader sees, not the
 *   transparent remainder of a partial frame. GD reads the first frame by
 *   itself; Imagick needs the first-frame editor the plugin asks for. That case
 *   needs Imagick and a two-frame fixture, so it skips cleanly on a PHP build
 *   without it.
 *
 * Run after loading WordPress, for example:
 * php -r 'require "path/to/wp-load.php"; require "tests/php/test-asset-library-stills.php"; titlesparks_test_asset_library_stills();'
 *
 * Every fixture is removed on the way out, the library rows this suite adds are
 * deleted, and the settings row is restored, so a run leaves the site as it
 * found it.
 *
 * @package Title_Sparks
 */

defined( 'ABSPATH' ) || exit;

use Title_Sparks\Asset_Library;
use Title_Sparks\Settings;

/**
 * Run the still-frame tests against a bootstrapped WordPress install.
 *
 * @return void
 */
function titlesparks_test_asset_library_stills() {
	$assertions = 0;
	$assert     = static function ( $condition, $message ) use ( &$assertions ) {
		++$assertions;

		if ( ! $condition ) {
			throw new RuntimeException( esc_html( $message ) );
		}
	};

	$library  = new Asset_Library();
	$previous = get_option( 'titlesparks_settings', null );
	$upload   = wp_upload_dir();
	$created  = array();

	wp_set_current_user( 1 );

	try {
		// One attachment, two library rows, one still frame.
		$file = trailingslashit( $upload['path'] ) . 'titlesparks-shared-still-test.gif';
		$url  = trailingslashit( $upload['url'] ) . 'titlesparks-shared-still-test.gif';

		file_put_contents( $file, 'GIF89a' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- Test fixture.

		$attachment_id = wp_insert_attachment(
			array(
				'post_title'     => 'TitleSparks shared still test',
				'post_mime_type' => 'image/gif',
				'post_status'    => 'inherit',
			),
			$file
		);
		$created[] = $attachment_id;

		$still = trailingslashit( $upload['path'] ) . 'titlesparks-shared-still-test-titlesparks-still.png';
		file_put_contents( $still, 'PNG' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- Test fixture.
		update_post_meta( $attachment_id, '_titlesparks_still_url', 'https://example.invalid/shared-still.png' );

		foreach ( array( 'shared-one', 'shared-two' ) as $asset_id ) {
			$library->save(
				array(
					'id'            => $asset_id,
					'label'         => $asset_id,
					'url'           => $url,
					'attachment_id' => $attachment_id,
					'size'          => '20px',
				)
			);
		}

		$library->delete( 'shared-one' );

		$assert(
			file_exists( $still ),
			'Deleting one of two assets that share an attachment must keep the still frame.'
		);
		$assert(
			'https://example.invalid/shared-still.png' === get_post_meta( $attachment_id, '_titlesparks_still_url', true ),
			'The recorded still URL must stay while another asset still uses the attachment.'
		);

		$library->delete( 'shared-two' );

		$assert(
			! file_exists( $still ),
			'Deleting the last asset must remove the still frame.'
		);
		$assert(
			'' === get_post_meta( $attachment_id, '_titlesparks_still_url', true ),
			'Deleting the last asset must remove the recorded still URL.'
		);

		wp_delete_attachment( $attachment_id, true );

		// The Imagick first frame, with a second frame that only paints a corner.
		if ( ! class_exists( 'Imagick' ) ) {
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI test report.
			echo "SKIP: the first-frame test needs the Imagick extension, which this PHP build does not load.\n";
		} else {
			$gif_file = trailingslashit( $upload['path'] ) . 'titlesparks-partial-frame-test.gif';
			$gif_url  = trailingslashit( $upload['url'] ) . 'titlesparks-partial-frame-test.gif';
			$gif      = new Imagick();

			$first = new Imagick();
			$first->newImage( 40, 30, 'red' );
			$first->setImageFormat( 'gif' );
			$gif->addImage( $first );

			$second = new Imagick();
			$second->newImage( 10, 10, 'blue' );
			$second->setImageFormat( 'gif' );
			$second->setImagePage( 10, 10, 0, 0 );
			$gif->addImage( $second );

			$gif->setImageIterations( 0 );
			$gif->writeImages( $gif_file, true );
			$gif->clear();

			// Only meaningful when the fixture really is a partial second frame.
			$check = new Imagick( $gif_file );
			$check->setIteratorIndex( 1 );

			if ( $check->getNumberImages() < 2 || $check->getImageWidth() >= 40 ) {
				$check->clear();
				// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI test report.
				echo "SKIP: the two-frame fixture did not come out with a partial second frame.\n";
			} else {
				$check->clear();

				$partial_id = wp_insert_attachment(
					array(
						'post_title'     => 'TitleSparks partial frame test',
						'post_mime_type' => 'image/gif',
						'post_status'    => 'inherit',
					),
					$gif_file
				);
				$created[] = $partial_id;

				$library->save(
					array(
						'id'            => 'partial-frame',
						'label'         => 'partial frame',
						'url'           => $gif_url,
						'attachment_id' => $partial_id,
						'size'          => '20px',
					)
				);

				$library->build_missing_stills( 5 );

				$still_path = trailingslashit( $upload['path'] ) . 'titlesparks-partial-frame-test-titlesparks-still.png';
				$still_meta = (string) get_post_meta( $partial_id, '_titlesparks_still_url', true );

				$assert( file_exists( $still_path ), 'A still frame must be written beside the GIF.' );
				$assert( '' !== $still_meta && 'failed' !== $still_meta, 'The still URL must be recorded on the attachment.' );

				$size = file_exists( $still_path ) ? getimagesize( $still_path ) : false;

				$assert( is_array( $size ) && 40 === $size[0] && 30 === $size[1], 'The still frame must keep the GIF’s own width and height.' );

				// Transparent pixels are counted with GD, which every editor path
				// can read a PNG with. A frame written from the last image of a
				// partial GIF is mostly transparent.
				if ( ! function_exists( 'imagecreatefrompng' ) ) {
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI test report.
					echo "SKIP: counting transparent pixels needs GD, which this PHP build does not load.\n";
				} else {
					$png    = imagecreatefrompng( $still_path );
					$width  = imagesx( $png );
					$height = imagesy( $png );
					$total  = 0;
					$clear  = 0;

					for ( $x = 0; $x < $width; $x += 2 ) {
						for ( $y = 0; $y < $height; $y += 2 ) {
							$pixel = imagecolorat( $png, $x, $y );
							$alpha = ( $pixel >> 24 ) & 0x7F;

							++$total;

							if ( $alpha > 100 ) {
								++$clear;
							}
						}
					}

					imagedestroy( $png );

					$assert( $total > 0, 'The still frame must have pixels to inspect.' );
					$assert( $clear < $total / 4, 'The still frame must not be mostly transparent.' );
				}

				$library->delete( 'partial-frame' );
				wp_delete_attachment( $partial_id, true );
			}
		}
	} finally {
		foreach ( array( 'shared-one', 'shared-two', 'partial-frame' ) as $asset_id ) {
			$library->delete( $asset_id );
		}

		foreach ( $created as $created_id ) {
			if ( $created_id > 0 ) {
				wp_delete_attachment( $created_id, true );
			}
		}

		if ( null === $previous ) {
			delete_option( 'titlesparks_settings' );
		} else {
			update_option( 'titlesparks_settings', $previous );
		}

		Settings::instance()->flush_cache();

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI test summary; the only placeholder is an integer counter.
		printf( "PASS: %d asset-library still assertions\n", $assertions );
	}
}
