<?php
/**
 * Asset URL / build-manifest helpers.
 *
 * Shared by the admin settings page and the block editor loader so both
 * bundles resolve their compiled files — and the content hash
 * `@wordpress/scripts` writes into `*.asset.php` — in exactly the same way.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks\Traits;

defined( 'ABSPATH' ) || exit;

/**
 * Trait Assets
 */
trait Assets {

	/**
	 * Absolute filesystem path of a compiled bundle directory.
	 *
	 * @param string $directory Bundle directory name, e.g. `build-admin`.
	 * @return string Path with a trailing slash.
	 */
	protected function bundle_path( $directory ) {
		return TITLE_SPARKS_DIR . trim( $directory, '/' ) . '/';
	}

	/**
	 * Public URL of a compiled bundle directory.
	 *
	 * @param string $directory Bundle directory name, e.g. `build-admin`.
	 * @return string URL with a trailing slash.
	 */
	protected function bundle_url( $directory ) {
		return TITLE_SPARKS_URL . trim( $directory, '/' ) . '/';
	}

	/**
	 * URL of a single file inside a bundle.
	 *
	 * @param string $directory Bundle directory name.
	 * @param string $file      File name, e.g. `index.js`.
	 * @return string
	 */
	protected function asset_url( $directory, $file ) {
		return $this->bundle_url( $directory ) . ltrim( $file, '/' );
	}

	/**
	 * Whether a compiled bundle entry actually exists on disk.
	 *
	 * @param string $directory Bundle directory name.
	 * @param string $file      Asset file name, e.g. `index.js`.
	 * @return bool
	 */
	protected function asset_exists( $directory, $file ) {
		return is_readable( $this->bundle_path( $directory ) . ltrim( $file, '/' ) );
	}

	/**
	 * Read the dependency manifest generated next to a bundle entry.
	 *
	 * Runs in a `function_exists`-free context on purpose: it returns safe
	 * defaults when the manifest is missing, so a developer working from the
	 * source directory without a build gets a graceful notice instead of a
	 * fatal error.
	 *
	 * @param string $directory Bundle directory name.
	 * @param string $file      Asset file name, e.g. `index.js`.
	 * @return array{dependencies: string[], version: string|null}
	 */
	protected function asset_manifest( $directory, $file ) {
		$fallback = array(
			'dependencies' => array(),
			'version'      => null,
		);

		$manifest = $this->bundle_path( $directory ) . preg_replace( '/\.js$/', '.asset.php', $file );

		if ( ! is_readable( $manifest ) ) {
			return $fallback;
		}

		$data = include $manifest;

		if ( ! is_array( $data ) ) {
			return $fallback;
		}

		return array(
			'dependencies' => ( isset( $data['dependencies'] ) && is_array( $data['dependencies'] ) ) ? $data['dependencies'] : array(),
			'version'      => isset( $data['version'] ) ? (string) $data['version'] : null,
		);
	}

	/**
	 * Version string for `wp_enqueue_*`.
	 *
	 * Prefers the build manifest hash so browsers pick up a new bundle after a
	 * rebuild without needing a plugin version bump.
	 *
	 * @param string      $directory Bundle directory name.
	 * @param string      $file      Asset file name.
	 * @param string|null $fallback  Fallback version.
	 * @return string
	 */
	protected function asset_version( $directory, $file, $fallback = null ) {
		$manifest = $this->asset_manifest( $directory, $file );

		if ( ! empty( $manifest['version'] ) ) {
			return $manifest['version'];
		}

		return $fallback ? $fallback : TITLE_SPARKS_VERSION;
	}
}
