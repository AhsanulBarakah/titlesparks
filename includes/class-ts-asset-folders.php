<?php
/**
 * Folders: named views over the asset library's tags.
 *
 * A folder is not a container an asset is moved into. An asset carries tags, a
 * folder names the tags it collects, and an asset appears in the folder when it
 * carries at least one of them. That is what makes a folder useful on a site
 * with a hundred icons: tagging a new asset once puts it in every folder that
 * already describes it, without anyone opening the folder to file it.
 *
 * Members are never stored, only the rule. Nothing here can therefore go stale:
 * there is no list of asset ids to keep in step when an asset is deleted, and no
 * migration when a tag is renamed in the editor.
 *
 * This is the same thin facade over the `folders` key of the settings row that
 * `Asset_Library` is over `assets`, so the REST controller and the settings
 * screen share one definition of what a stored folder is.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks;

defined( 'ABSPATH' ) || exit;

/**
 * Class Asset_Folders
 */
final class Asset_Folders {

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
	 * Every folder, in creation order.
	 *
	 * @return array[]
	 */
	public function all() {
		$folders = $this->settings->get( 'folders', array() );

		return is_array( $folders ) ? array_values( $folders ) : array();
	}

	/**
	 * Find one folder by identifier.
	 *
	 * @param mixed $id Folder identifier.
	 * @return array|null Null when no folder matches.
	 */
	public function get( $id ) {
		$id = Security::asset_id( $id );

		if ( '' === $id ) {
			return null;
		}

		foreach ( $this->all() as $folder ) {
			if ( isset( $folder['id'] ) && $folder['id'] === $id ) {
				return $folder;
			}
		}

		return null;
	}

	/**
	 * Replace the whole folder list.
	 *
	 * @param array[] $folders Sanitized folder rows.
	 * @return array[] The stored folders.
	 */
	public function replace( array $folders ) {
		$settings = $this->settings->all();

		$settings['folders'] = $folders;

		$stored = $this->settings->update( $settings );

		return isset( $stored['folders'] ) ? $stored['folders'] : array();
	}

	/**
	 * Add or update a single folder, keyed by identifier.
	 *
	 * A folder arrives with the name the author typed; its identifier is derived
	 * from that name on the way in (`Security::folder()`), so two folders called
	 * "News" are the same folder rather than two halves of one view.
	 *
	 * @param array $folder Raw folder row.
	 * @return array|null The stored folder, or null when it was invalid.
	 */
	public function save( array $folder ) {
		$clean = Security::folder( $folder );

		if ( '' === $clean['id'] || '' === $clean['name'] ) {
			return null;
		}

		$folders = $this->all();
		$found   = false;

		foreach ( $folders as $index => $existing ) {
			if ( isset( $existing['id'] ) && $existing['id'] === $clean['id'] ) {
				$folders[ $index ] = $clean;
				$found             = true;
				break;
			}
		}

		if ( ! $found ) {
			$folders[] = $clean;
		}

		$this->replace( $folders );

		return $clean;
	}

	/**
	 * Delete a folder.
	 *
	 * Only the folder goes. Its tags and the assets carrying them are untouched,
	 * so deleting a folder never deletes an asset and never changes what a post
	 * draws.
	 *
	 * @param mixed $id Folder identifier.
	 * @return bool Whether something was removed.
	 */
	public function delete( $id ) {
		$id = Security::asset_id( $id );

		if ( '' === $id ) {
			return false;
		}

		$folders = $this->all();
		$kept    = array();
		$removed = false;

		foreach ( $folders as $folder ) {
			if ( isset( $folder['id'] ) && $folder['id'] === $id ) {
				$removed = true;
				continue;
			}

			$kept[] = $folder;
		}

		if ( $removed ) {
			$this->replace( $kept );
		}

		return $removed;
	}
}
