<?php
/**
 * Loads the block editor sidebar bundle.
 *
 * Kept separate from `Settings_Page` because the two bundles are built
 * independently (`build-admin` and `build-block`), and because the block bundle
 * must load on every editor screen while the settings bundle loads on exactly
 * one admin screen.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks\Admin;

use Title_Sparks\Settings;
use Title_Sparks\Traits\Assets;

defined( 'ABSPATH' ) || exit;

/**
 * Class Block_Assets
 */
final class Block_Assets {

	use Assets;

	/**
	 * Bundle directory produced by `npm run build-block`.
	 */
	const BUNDLE = 'build-block';

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue' ) );
	}

	/**
	 * Enqueue the sidebar script for the current editor screen.
	 *
	 * @return void
	 */
	public function enqueue() {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;

		if ( ! $screen || ! Settings::instance()->is_post_type_enabled( $screen->post_type ) ) {
			return;
		}

		$file = 'index.js';

		if ( ! $this->asset_exists( self::BUNDLE, $file ) ) {
			add_action( 'admin_notices', array( $this, 'render_missing_build_notice' ) );

			return;
		}

		$manifest = $this->asset_manifest( self::BUNDLE, $file );
		$version  = $this->asset_version( self::BUNDLE, $file );

		wp_enqueue_script(
			TITLE_SPARKS_BLOCK_HANDLE,
			$this->asset_url( self::BUNDLE, $file ),
			$manifest['dependencies'],
			$version,
			true
		);

		if ( $this->asset_exists( self::BUNDLE, 'index.css' ) ) {
			wp_enqueue_style(
				TITLE_SPARKS_BLOCK_HANDLE,
				$this->asset_url( self::BUNDLE, 'index.css' ),
				array( 'wp-components', 'wp-edit-blocks' ),
				$version
			);
			wp_style_add_data( TITLE_SPARKS_BLOCK_HANDLE, 'rtl', 'replace' );
		}

		wp_set_script_translations( TITLE_SPARKS_BLOCK_HANDLE, TITLE_SPARKS_TEXTDOMAIN, TITLE_SPARKS_DIR . 'languages' );
	}

	/**
	 * Notice shown when the compiled bundle is missing.
	 *
	 * @return void
	 */
	public function render_missing_build_notice() {
		?>
		<div class="notice notice-error">
			<p>
				<?php
				printf(
					/* translators: %s: the npm command, wrapped in a <code> element. */
					esc_html__( 'TitleSparks: the editor bundle is missing. Run %s in the plugin directory.', 'titlesparks' ),
					// The sentence is escaped above; the one element it allows is
					// escaped here, so the markup is the only thing that survives rather
					// than being trusted because it happens to be a literal today.
					wp_kses(
						'<code>npm install &amp;&amp; npm run build-block</code>',
						array( 'code' => array() )
					)
				);
				?>
			</p>
		</div>
		<?php
	}
}
