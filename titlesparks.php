<?php
/**
 * Plugin Name:       TitleSparks
 * Plugin URI:        https://github.com/AhsanulBarakah/titlesparks
 * Description:       Attach customizable animated GIFs, icons and images to post titles and let each one expire through a three stage timeline.
 * Version:           1.0.0
 * Requires at least: 6.6
 * Requires PHP:      7.4
 * Author:            AhsanulBarakah
 * Author URI:        https://profiles.wordpress.org/ahsanulbarakah/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       titlesparks
 * Domain Path:       /languages
 *
 * @package Title_Sparks
 */

defined( 'ABSPATH' ) || exit;

/*
 * ---------------------------------------------------------------------------
 * Constants. Every path, URL and shared name the plugin relies on is derived
 * from these values, so the folder can be renamed or symlinked without touching
 * any other file, and a rename of an option/meta key happens in exactly one
 * place.
 * ---------------------------------------------------------------------------
 */
define( 'TITLE_SPARKS_VERSION', '1.0.0' );
define( 'TITLE_SPARKS_FILE', __FILE__ );
define( 'TITLE_SPARKS_DIR', plugin_dir_path( __FILE__ ) );
define( 'TITLE_SPARKS_URL', plugin_dir_url( __FILE__ ) );
define( 'TITLE_SPARKS_BASENAME', plugin_basename( __FILE__ ) );

define( 'TITLE_SPARKS_TEXTDOMAIN', 'titlesparks' );
define( 'TITLE_SPARKS_OPTION_NAME', 'titlesparks_settings' );
define( 'TITLE_SPARKS_META_KEY', '_titlesparks_timeline_schema' );
define( 'TITLE_SPARKS_REST_NAMESPACE', 'titlesparks/v1' );
define( 'TITLE_SPARKS_ADMIN_PAGE_SLUG', 'titlesparks' );
define( 'TITLE_SPARKS_ADMIN_HANDLE', 'titlesparks-admin' );
define( 'TITLE_SPARKS_BLOCK_HANDLE', 'titlesparks-block' );

/*
 * ---------------------------------------------------------------------------
 * Autoloading. No Composer: the class map is resolved from the file names so
 * the plugin can be installed by uploading a zip.
 * ---------------------------------------------------------------------------
 */
require_once TITLE_SPARKS_DIR . 'includes/class-ts-autoloader.php';

\Title_Sparks\Autoloader::register();

/**
 * Boot the plugin.
 *
 * Deferred to `plugins_loaded` so other plugins can hook into the lifecycle
 * actions TitleSparks fires, and so every translation string registered later is
 * resolvable.
 *
 * @return void
 */
function titlesparks_bootstrap() {
	\Title_Sparks\Plugin::instance()->boot();
}
add_action( 'plugins_loaded', 'titlesparks_bootstrap' );

/**
 * Activation.
 *
 * Creates the default settings row. Nothing else is written here, so an update
 * over an existing install is always a no-op.
 *
 * @return void
 */
function titlesparks_activate() {
	\Title_Sparks\Settings::instance()->ensure_defaults();
}
register_activation_hook( __FILE__, 'titlesparks_activate' );

/**
 * Deactivation.
 *
 * Clears the queued scan rebuild, which would otherwise run on cron for a
 * plugin that is no longer loaded. Nothing else is removed: users expect their
 * asset library and per-post timelines to survive a deactivate/reactivate
 * cycle, and a dedicated uninstall.php handles permanent removal.
 *
 * @return void
 */
function titlesparks_deactivate() {
	wp_clear_scheduled_hook( \Title_Sparks\Settings::SCAN_CRON_HOOK );
}
register_deactivation_hook( __FILE__, 'titlesparks_deactivate' );
