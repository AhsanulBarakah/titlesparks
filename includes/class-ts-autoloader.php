<?php
/**
 * Tiny PSR-4 style autoloader.
 *
 * The plugin ships without Composer so it can be installed by uploading a zip.
 * This autoloader maps a namespaced class such as `Title_Sparks\Traits\Security`
 * to a file in the familiar WordPress `type-prefix-slug.php` style:
 *
 *   Title_Sparks\Autoloader        -> includes/class-ts-autoloader.php
 *   Title_Sparks\Traits\Security   -> includes/traits/trait-ts-security.php
 *   Title_Sparks\Rest\Controller   -> includes/rest/class-ts-controller.php
 *
 * @package Title_Sparks
 */

namespace Title_Sparks;

defined( 'ABSPATH' ) || exit;

/**
 * Class Autoloader
 */
final class Autoloader {

	/**
	 * Namespace prefix handled by this autoloader.
	 */
	const PREFIX = __NAMESPACE__ . '\\';

	/**
	 * Register the autoloader with the SPL stack.
	 *
	 * @return void
	 */
	public static function register() {
		spl_autoload_register( array( __CLASS__, 'autoload' ) );
	}

	/**
	 * Resolve a class name to a file and include it.
	 *
	 * @param string $class_name Fully qualified class name.
	 * @return void
	 */
	public static function autoload( $class_name ) {
		if ( 0 !== strpos( $class_name, self::PREFIX ) ) {
			return;
		}

		$relative = substr( $class_name, strlen( self::PREFIX ) );
		$segments = explode( '\\', $relative );
		$class    = array_pop( $segments );

		// `Admin\Settings_Page` -> `admin/class-ts-settings-page.php`.
		$slug      = strtolower( str_replace( '_', '-', $class ) );
		$directory = implode( '/', array_map( 'strtolower', $segments ) );
		$base      = TITLE_SPARKS_DIR . 'includes/' . ( $directory ? $directory . '/' : '' );

		// Classes, traits and interfaces share the naming convention but not the
		// prefix, so each candidate is tried in turn.
		foreach ( array( 'class', 'trait', 'interface' ) as $type ) {
			$path = $base . $type . '-ts-' . $slug . '.php';

			if ( is_readable( $path ) ) {
				require_once $path;

				return;
			}
		}
	}
}
