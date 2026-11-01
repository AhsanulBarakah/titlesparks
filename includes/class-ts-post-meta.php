<?php
/**
 * Per-post timeline storage.
 *
 * The three stage timeline lives in a single string meta row
 * (`_titlesparks_timeline_schema`, JSON-encoded) so a post is either fully
 * configured or not configured at all, and the editor can save it in one
 * request. The meta key is protected (leading underscore), which keeps it out
 * of the default Custom Fields panel, and it is registered with `show_in_rest`
 * so the block editor reads and writes it through its own meta flow with the
 * same sanitisation as everything else.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks;

use Title_Sparks\Security;
use Title_Sparks\Traits\Security as Security_Trait;

defined( 'ABSPATH' ) || exit;

/**
 * Class Post_Meta
 */
final class Post_Meta {

	use Security_Trait;

	/**
	 * Meta key.
	 */
	const META_KEY = TITLE_SPARKS_META_KEY;

	/**
	 * REST field name exposed to the block editor.
	 */
	const REST_FIELD = 'titlesparks_timeline_schema';

	/**
	 * Nonce action used by the classic editor save path.
	 */
	const NONCE_ACTION = 'titlesparks_save_timeline';

	/**
	 * Nonce field name used by the classic editor save path.
	 */
	const NONCE_FIELD = 'titlesparks_timeline_nonce';

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'init', array( $this, 'register_meta' ) );
		add_action( 'save_post', array( $this, 'save_from_request' ), 10, 2 );
		add_action( 'enqueue_block_editor_assets', array( $this, 'localize_editor_data' ), 20 );
	}

	/**
	 * Register the meta field with the REST API.
	 *
	 * The REST name is declared explicitly rather than left to default. The
	 * default is the meta key itself, so the protected key
	 * `_titlesparks_timeline_schema` would be exposed to the editor as
	 * `meta._titlesparks_timeline_schema`, while the bundle writes the name in
	 * `self::REST_FIELD`. The two silently diverge:
	 * `WP_REST_Meta_Fields::update_value()` skips any request key that is not a
	 * registered field name, so the post still saves, the API still answers
	 * `200`, and the timeline is dropped on the floor. Naming the field here
	 * keeps the internal (protected) key and the REST name independent, and
	 * keeps the REST name equal to the `metaKey` handed to the editor.
	 *
	 * @return void
	 */
	public function register_meta() {
		foreach ( Settings::instance()->enabled_post_types() as $post_type ) {
			register_post_meta(
				$post_type,
				self::META_KEY,
				array(
					'type'              => 'string',
					'description'       => __( 'Three stage title icon decay timeline, stored as JSON.', 'titlesparks' ),
					'single'            => true,
					'default'           => '',
					'show_in_rest'      => array(
						'name' => self::REST_FIELD,
					),
					'sanitize_callback' => array( __CLASS__, 'sanitize_meta' ),
					'auth_callback'     => array( $this, 'can_edit_meta' ),
				)
			);
		}
	}

	/**
	 * Sanitize callback for the registered meta.
	 *
	 * Runs on every write path, including REST-driven saves, so nothing can
	 * reach the database without passing through `Security`. The stored value
	 * is a JSON string; a malformed string normalises to an empty timeline
	 * rather than being rejected with an error.
	 *
	 * @param mixed $value Raw meta value.
	 * @return string JSON-encoded timeline.
	 */
	public static function sanitize_meta( $value ) {
		return self::encode( self::decode( $value ) );
	}

	/**
	 * Decode a stored value into a sanitized timeline array.
	 *
	 * @param mixed $value JSON string, array or empty value.
	 * @return array
	 */
	private static function decode( $value ) {
		$value = self::deep_unslash( $value );

		if ( is_string( $value ) ) {
			$decoded = json_decode( $value, true );
			$value   = is_array( $decoded ) ? $decoded : array();
		}

		return Security::timeline( is_array( $value ) ? $value : array() );
	}

	/**
	 * Encode a timeline array for storage.
	 *
	 * @param array $timeline Sanitized timeline.
	 * @return string JSON string (never `false`).
	 */
	private static function encode( array $timeline ) {
		$json = wp_json_encode( Security::timeline( $timeline ) );

		return is_string( $json ) ? $json : '';
	}

	/**
	 * Capability check for REST writes to the meta field.
	 *
	 * @param bool   $allowed   Whether the user can edit the meta.
	 * @param string $meta_key  Meta key.
	 * @param int    $object_id Post ID.
	 * @return bool
	 */
	public function can_edit_meta( $allowed, $meta_key, $object_id ) {
		return self::user_can_edit_post( $object_id );
	}

	/**
	 * Fallback save path for the classic (non-REST) editor.
	 *
	 * The block editor saves through the REST API and the meta box posts its
	 * own nonce, so this only fires for `post.php` submissions or code that
	 * calls `wp_insert_post()` with a matching nonce.
	 *
	 * @param int     $post_id Post ID.
	 * @param WP_Post $post    Post object.
	 * @return void
	 */
	public function save_from_request( $post_id, $post ) {
		// Autosaves and revisions must never overwrite the timeline.
		if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
			return;
		}

		if ( ! isset( $_POST[ self::NONCE_FIELD ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified on the next line.
			return;
		}

		if ( ! $this->check_nonce( self::NONCE_ACTION . '_' . $post_id, self::NONCE_FIELD ) ) {
			return;
		}

		if ( ! self::user_can_edit_post( $post_id ) ) {
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Nonce checked above; Security::timeline() sanitizes the value below.
		$raw = isset( $_POST['titlesparks_timeline'] ) ? wp_unslash( $_POST['titlesparks_timeline'] ) : array();

		if ( is_string( $raw ) ) {
			$decoded = json_decode( $raw, true );
			$raw     = is_array( $decoded ) ? $decoded : array();
		}

		$raw = is_array( $raw ) ? $raw : array();

		// The classic form renders only part of the schema. Rebuilding the whole
		// timeline from it would reset everything it has no field for — the
		// position offsets, the mirror flag, the stage's own size table and the
		// per-post display choices — so the posted fields are merged over the stored row
		// instead. `enabled` is the exception: it is a checkbox, so an unchecked
		// box (no key at all in the request) has to mean "off".
		$this->save( $post_id, self::merge_classic_form( $this->get( $post_id ), $raw ) );

		// The hook receives the post type for callers that key off it.
		unset( $post );
	}

	/**
	 * Merge the classic meta box's fields over the stored timeline.
	 *
	 * Fields the form does not render keep the stored value; fields it does
	 * render take the posted value, so clearing one in the form still clears it.
	 *
	 * @param array $stored Sanitized timeline already stored for the post.
	 * @param array $posted Raw fields posted by the meta box.
	 * @return array Timeline ready for `Security::timeline()`.
	 */
	private static function merge_classic_form( array $stored, array $posted ) {
		$merged = array(
			'enabled'           => ! empty( $posted['enabled'] ),
			'anchor'            => isset( $stored['anchor'] ) ? $stored['anchor'] : '',
			'stage_3_behaviour' => isset( $posted['stage_3_behaviour'] )
				? $posted['stage_3_behaviour']
				: ( isset( $stored['stage_3_behaviour'] ) ? $stored['stage_3_behaviour'] : 'keep' ),
			'position_offsets'  => isset( $stored['position_offsets'] ) ? $stored['position_offsets'] : array(),
			'display'           => isset( $stored['display'] ) ? $stored['display'] : array(),
			// The classic box has no field for the icon's alignment or spacing,
			// so a save from it must leave the author's answer alone.
			'icon_anchor'       => isset( $stored['icon_anchor'] ) ? $stored['icon_anchor'] : '',
			'icon_spacing'      => isset( $stored['icon_spacing'] ) ? $stored['icon_spacing'] : '',
		);

		foreach ( Security::stage_keys() as $key ) {
			$form  = isset( $posted[ $key ] ) && is_array( $posted[ $key ] ) ? $posted[ $key ] : array();
			$saved = isset( $stored[ $key ] ) && is_array( $stored[ $key ] ) ? $stored[ $key ] : array();

			$merged[ $key ] = array_merge( $saved, $form );
		}

		return $merged;
	}

	/**
	 * Persist a timeline for a post.
	 *
	 * @param int   $post_id Post ID.
	 * @param array $raw     Raw timeline.
	 * @return array The stored timeline.
	 */
	public function save( $post_id, array $raw ) {
		$timeline = Security::timeline( $raw );

		update_post_meta( $post_id, self::META_KEY, self::encode( $timeline ) );

		/**
		 * Fires after a post timeline is stored.
		 *
		 * @param int   $post_id  Post ID.
		 * @param array $timeline Sanitized timeline.
		 */
		do_action( 'titlesparks_timeline_saved', $post_id, $timeline );

		return $timeline;
	}

	/**
	 * Read a post timeline, seeded from the global defaults when empty.
	 *
	 * @param int  $post_id      Post ID.
	 * @param bool $use_defaults Seed the timeline from the global defaults.
	 * @return array
	 */
	public function get( $post_id, $use_defaults = true ) {
		$stored = get_post_meta( $post_id, self::META_KEY, true );

		if ( is_string( $stored ) && '' !== trim( $stored ) ) {
			$decoded = json_decode( $stored, true );

			if ( is_array( $decoded ) ) {
				return Security::timeline( $decoded );
			}
		}

		// A row stored as an array rather than a JSON string reads the same
		// way, so data written either way is never lost.
		if ( is_array( $stored ) && ! empty( $stored ) ) {
			return Security::timeline( $stored );
		}

		return $use_defaults ? $this->default_timeline() : Security::timeline( array() );
	}

	/**
	 * Timeline seeded from the global defaults, used for new posts.
	 *
	 * @return array
	 */
	public function default_timeline() {
		$settings = Settings::instance();

		return Security::timeline(
			array(
				'enabled'           => false,
				'anchor'            => '',
				'stage_1'           => $settings->get( 'default_stage_1', array() ),
				'stage_2'           => $settings->get( 'default_stage_2', array() ),
				'stage_3'           => $settings->get( 'default_stage_3', array() ),
				'stage_3_behaviour' => $settings->get( 'default_behaviour', 'keep' ),
			)
		);
	}

	/**
	 * Delete a post timeline.
	 *
	 * @param int $post_id Post ID.
	 * @return void
	 */
	public function delete( $post_id ) {
		delete_post_meta( $post_id, self::META_KEY );
	}

	/**
	 * Hand the block editor everything it needs in one inline script.
	 *
	 * @return void
	 */
	public function localize_editor_data() {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;

		if ( $screen && ! Settings::instance()->is_post_type_enabled( $screen->post_type ) ) {
			return;
		}

		$post_id = ( isset( $GLOBALS['post'] ) && $GLOBALS['post'] instanceof \WP_Post ) ? (int) $GLOBALS['post']->ID : 0;

		if ( ! $post_id ) {
			return;
		}

		$timeline = $this->get( $post_id );

		$settings = Settings::instance();
		$sections = array_map(
			static function ( $section ) {
				return array(
					'id'   => $section['id'],
					'name' => $section['name'],
				);
			},
			$settings->homepage_section_choices()
		);
		$widgets = array_map(
			static function ( $widget ) {
				return array(
					'id'   => $widget['id'],
					'name' => $widget['name'],
				);
			},
			$settings->active_widgets()
		);

		// NewsMash and its NewsOnline child load this title face on the front
		// end only, so the editor canvas cannot report it by itself. Any other
		// theme gets no font family from this plugin unless it says so through
		// the filter below.
		$font = 'newsmash' === get_template() ? '"Josefin Sans", sans-serif' : '';

		/**
		 * Filter the title font family the editor canvas is told about.
		 *
		 * The canvas draws the title with the theme's own styles but cannot read
		 * a face the theme loads on the front end only, so this is how a theme
		 * keeps the preview and the page matching.
		 *
		 * @param string $font     Font family CSS value, or an empty string.
		 * @param string $template Active theme's template slug.
		 */
		$font = (string) apply_filters( 'titlesparks_editor_font_family', $font, get_template() );

		$data = array(
			'timeline'         => $timeline,
			'defaults'         => $this->default_timeline(),
			'displayLocations' => $settings->display_locations(),
			'displayOptions'   => array(
				'sections' => $sections,
				'widgets'  => $widgets,
			),
			'assets'      => ( new Asset_Library() )->to_editor_list(),
			'positions'   => Security::allowed_positions(),
			'behaviours'  => Security::allowed_behaviours(),
			'units'       => Security::allowed_units(),
			'postType'    => get_post_type( $post_id ),
			'postDate'    => get_post_time( 'Y-m-d H:i:s', false, $post_id ),
			// The anchor this post's timeline actually resolves from: its own
			// saved anchor when it has one, otherwise the site's "timeline
			// starts" setting. The editor picks its end dates against this, so
			// the dates it shows are the dates the front end will use.
			'anchor'      => Settings::instance()->anchor_for( $timeline ),
			// "Now", so the editor preview can resolve the active stage without
			// depending on the browser's timezone. `time()` is a true UTC
			// instant, and the offset beside it is what puts it on the site
			// clock the anchor is written on.
			'now'         => time(),
			// The site clock's offset from UTC, in seconds.
			'nowOffset'   => Decay::local_offset(),
			'isEnabled'   => $settings->is_enabled(),
			// What the canvas measures the icon's Y offset from, so the preview
			// keeps the icon on the first line exactly as the page does. This is
			// this post's own answer, which is the site's unless its author picked
			// one.
			'iconAnchor'  => $settings->icon_anchor_for( $timeline ),
			// The space beside the icon, also as this post resolves it, so the
			// canvas shows a flush icon where the page will.
			'iconSpacing' => $settings->icon_spacing_for( $timeline ),
			// The page's stacking order for the icon, so the canvas draws it in
			// front of (or behind) the same things the published page does.
			'iconZIndex'  => $settings->icon_z_index(),
			// The site's bands for a title-following icon, so the canvas previews
			// what the page will draw and the stage editor starts from them.
			'sizingRules'       => $settings->sizing_rules(),
			'metaKey'     => self::REST_FIELD,
			'namespace'   => TITLE_SPARKS_REST_NAMESPACE,
			'nonce'       => wp_create_nonce( 'wp_rest' ),
			'settingsUrl' => admin_url( 'admin.php?page=' . TITLE_SPARKS_ADMIN_PAGE_SLUG ),
			// The font this site draws its titles with, when it is one the
			// canvas cannot discover for itself. Filterable above.
			'themeFontFamily' => $font,
		);

		wp_add_inline_script(
			TITLE_SPARKS_BLOCK_HANDLE,
			'window.titleSparksEditorData = ' . wp_json_encode(
				$data,
				// WordPress' own flags for JSON inside a <script> element; see
				// the same note in Title_Renderer::enqueue_script().
				JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
			) . ';',
			'before'
		);
	}
}
