<?php
/**
 * Plugin orchestrator.
 *
 * The only class that knows about all the others. Each subsystem registers its
 * own hooks, so adding or removing a feature is a one-line change here instead
 * of a hunt through `add_action` calls scattered across the codebase.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks;

use Title_Sparks\Admin\Block_Assets;
use Title_Sparks\Admin\Meta_Box;
use Title_Sparks\Admin\Settings_Page;

defined( 'ABSPATH' ) || exit;

/**
 * Class Plugin
 */
final class Plugin {

	/**
	 * Singleton instance.
	 *
	 * @var Plugin|null
	 */
	private static $instance = null;

	/**
	 * Whether boot() already ran.
	 *
	 * @var bool
	 */
	private $booted = false;

	/**
	 * Get the shared instance.
	 *
	 * @return Plugin
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Wire up every subsystem.
	 *
	 * @return void
	 */
	public function boot() {
		if ( $this->booted ) {
			return;
		}

		$this->booted = true;

		// Subsystems. Order matters only for the settings store, which the
		// others read through on demand anyway. It also registers the hooks
		// that keep the cached template scan current.
		Settings::instance()->register();

		( new Asset_Library() )->register();
		( new Post_Meta() )->register();
		( new Title_Renderer() )->register();
		( new Rest_Controller() )->register();
		( new Settings_Page() )->register();
		( new Block_Assets() )->register();

		( new Meta_Box() )->register();

		/**
		 * Fires once the plugin has finished booting.
		 *
		 * @param Plugin $plugin The plugin instance.
		 */
		do_action( 'titlesparks_loaded', $this );
	}

	/**
	 * Absolute path to the plugin directory.
	 *
	 * @return string
	 */
	public function dir() {
		return TITLE_SPARKS_DIR;
	}
}
