<?php
/**
 * Plugin specific validation, layered on top of the generic security trait.
 *
 * The trait (`Title_Sparks\Traits\Security`) knows how to sanitise primitives —
 * text, keys, URLs, CSS sizes and so on. This class composes that trait and
 * adds the validation the *plugin* needs: the shape of a three stage timeline
 * and the shape of a library asset.
 *
 * Keeping the domain rules here means the REST controller, the meta box, the
 * settings page and the front end renderer all normalise data through exactly
 * the same call, so a stored value can never differ depending on which entry
 * point wrote it.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks;

use Title_Sparks\Traits\Security as Security_Handlers;

defined( 'ABSPATH' ) || exit;

/**
 * Class Security
 */
final class Security {

	use Security_Handlers;

	/**
	 * Longest a single asset tag may be.
	 *
	 * Mirrors `MAX_TAG_LENGTH` in `blocks/shared/constants.js`. Tags are typed
	 * by hand, so the ceiling is about a stray paste rather than a real limit.
	 */
	const MAX_TAG_LENGTH = 32;

	/**
	 * Most tags one asset may carry.
	 *
	 * Mirrors `MAX_ASSET_TAGS`. The library filters by tag in the browser, where a
	 * row with a hundred tags would be a row nobody can read.
	 */
	const MAX_ASSET_TAGS = 12;

	/**
	 * Most folders a site may create.
	 *
	 * Mirrors `MAX_FOLDERS`. Folders are a view over tags, so the list is a
	 * sidebar; a hundred of them would be a second settings screen.
	 */
	const MAX_FOLDERS = 50;

	/**
	 * Deepest a single stage may run, in days.
	 */
	const MAX_DURATION_DAYS = 3650;

	/**
	 * Deepest a single stage may run, in hours.
	 */
	const MAX_DURATION_HOURS = 87600;

	/**
	 * Deepest a single stage may run, in minutes.
	 *
	 * The same ten year ceiling as the other units, so switching a stage to
	 * minutes to fine tune its end cannot lengthen the timeline.
	 */
	const MAX_DURATION_MINUTES = 5256000;

	/**
	 * Furthest a position offset may move an icon, in pixels.
	 *
	 * The offset is signed, so it runs from `-MAX_OFFSET` to `MAX_OFFSET`.
	 */
	const MAX_OFFSET = 100;

	/**
	 * Largest stacking order an icon may be given.
	 *
	 * CSS takes a 32-bit signed integer for `z-index`; clamping to that range
	 * keeps any value the browser would accept and rejects the rest.
	 */
	const MAX_Z_INDEX = 2147483647;

	/**
	 * How many title-size bands the advanced calculation may hold.
	 *
	 * A table of eight is a design decision; a hundred is a spreadsheet, and a
	 * page would have to test every icon against all of them.
	 */
	const MAX_SIZING_RULES = 8;

	/**
	 * Smallest and largest a title-size band may be, in pixels.
	 *
	 * The font size runs from 4px (a caption) to 200px (a display headline);
	 * the icon size allows 4px so a band can name a deliberately tiny icon.
	 */
	const MIN_SIZING_RULE = 4;
	const MAX_SIZING_FONT = 200;
	const MAX_SIZING_ICON = 512;

	/* ---------------------------------------------------------------------
	 * Allow-lists. Shared with the admin UI so the editor and the validator
	 * can never drift apart.
	 * ------------------------------------------------------------------ */

	/**
	 * Positions a stage may be set to now.
	 *
	 * Only the two sides: vertical placement is the offset fields' job, and
	 * they move the icon freely from either side.
	 *
	 * @return string[]
	 */
	public static function position_choices() {
		return array( 'left', 'right' );
	}

	/**
	 * Every position a stored stage may carry.
	 *
	 * Only the two sides: vertical placement is the offset fields' job, and
	 * they move the icon freely from either side.
	 *
	 * @return string[]
	 */
	public static function allowed_positions() {
		return self::position_choices();
	}

	/**
	 * Allowed stage 3 behaviours once the timeline has fully elapsed.
	 *
	 * @return string[]
	 */
	public static function allowed_behaviours() {
		return array( 'keep', 'remove' );
	}

	/**
	 * Allowed answers for an icon with no room inside its card.
	 *
	 * Two answers, offered in Settings as one switch: `keep` (off) draws the
	 * icon exactly as the author placed it, `shrink` (on) draws it smaller so
	 * it fits inside the card. Neither indents the title, so an icon is never
	 * dropped behind the author's back.
	 *
	 * @return string[]
	 */
	public static function allowed_tight_fits() {
		return array( 'keep', 'shrink' );
	}

	/**
	 * Allowed anchors for the icon's vertical position.
	 *
	 * `first_line` keeps the icon on the line the author placed it on;
	 * `last_line` does the same on the bottom line; `block` centres it on the
	 * whole title, which moves it when the title wraps.
	 *
	 * @return string[]
	 */
	public static function allowed_icon_anchors() {
		return array( 'first_line', 'last_line', 'block' );
	}

	/**
	 * Allowed answers for the space left beside an icon.
	 *
	 * `gap` is the shipped fraction of the title's own size; `flush` draws the
	 * icon against the last character for an icon that belongs to the words
	 * rather than beside them.
	 *
	 * @return string[]
	 */
	public static function allowed_icon_spacings() {
		return array( 'gap', 'flush' );
	}

	/**
	 * Allowed duration units.
	 *
	 * @return string[]
	 */
	public static function allowed_units() {
		return array( 'days', 'hours', 'minutes' );
	}

	/**
	 * Deepest a stage may run in the given unit.
	 *
	 * @param mixed $unit Unit keyword.
	 * @return int
	 */
	public static function max_duration( $unit ) {
		switch ( self::unit( $unit ) ) {
			case 'minutes':
				return self::MAX_DURATION_MINUTES;
			case 'hours':
				return self::MAX_DURATION_HOURS;
			default:
				return self::MAX_DURATION_DAYS;
		}
	}

	/**
	 * Allowed sources for the start of a timeline.
	 *
	 * @return string[]
	 */
	public static function allowed_anchor_sources() {
		return array( 'post', 'fixed' );
	}

	/**
	 * An anchor source, defaulting to `post`.
	 *
	 * A per-post timeline may still store its own anchor; this only decides what
	 * the site uses for every post that has not set one.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function anchor_source( $value ) {
		return self::sanitize_choice( $value, self::allowed_anchor_sources(), 'post' );
	}

	/**
	 * The stage keys of a timeline, in order.
	 *
	 * @return string[]
	 */
	public static function stage_keys() {
		return array( 'stage_1', 'stage_2', 'stage_3' );
	}

	/* ---------------------------------------------------------------------
	 * Field level validators.
	 * ------------------------------------------------------------------ */

	/**
	 * A position keyword, defaulting to `left`.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function position( $value ) {
		return self::sanitize_choice( $value, self::allowed_positions(), 'left' );
	}

	/**
	 * A stage 3 behaviour, defaulting to `keep`.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function behaviour( $value ) {
		return self::sanitize_choice( $value, self::allowed_behaviours(), 'keep' );
	}

	/**
	 * What to do when a card cannot hold an icon, defaulting to `keep`.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function tight_fit( $value ) {
		return self::sanitize_choice( $value, self::allowed_tight_fits(), 'keep' );
	}

	/**
	 * What the icon's vertical position is measured against.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function icon_anchor( $value ) {
		return self::sanitize_choice( $value, self::allowed_icon_anchors(), 'first_line' );
	}

	/**
	 * A per-post answer for what the icon's vertical position is measured from.
	 *
	 * An empty answer means "use the site setting", which is what every post
	 * that has never touched the field stores — so a site that changes its own
	 * answer still moves those icons.
	 *
	 * @param mixed $value Raw value.
	 * @return string One of `allowed_icon_anchors()`, or `''` to inherit.
	 */
	public static function icon_anchor_override( $value ) {
		return self::sanitize_choice(
			$value,
			array_merge( array( '' ), self::allowed_icon_anchors() ),
			''
		);
	}

	/**
	 * The space a site leaves between an icon and its title.
	 *
	 * @param mixed $value Raw value.
	 * @return string `gap` or `flush`.
	 */
	public static function icon_spacing( $value ) {
		return self::sanitize_choice( $value, self::allowed_icon_spacings(), 'gap' );
	}

	/**
	 * A per-post answer for the space beside the icon.
	 *
	 * An empty answer means "use the site setting", so a site that changes its
	 * own answer still moves the posts that never picked one.
	 *
	 * @param mixed $value Raw value.
	 * @return string One of `allowed_icon_spacings()`, or `''` to inherit.
	 */
	public static function icon_spacing_override( $value ) {
		return self::sanitize_choice(
			$value,
			array_merge( array( '' ), self::allowed_icon_spacings() ),
			''
		);
	}

	/**
	 * The icon's stacking order on the page.
	 *
	 * `0` is the page's normal order, which is what an untouched site has
	 * always seen. A positive number draws the icon in front of anything the
	 * theme stacks at a lower number; a negative one puts it behind.
	 *
	 * @param mixed $value Raw value.
	 * @return int
	 */
	public static function icon_z_index( $value ) {
		return self::sanitize_int( $value, -self::MAX_Z_INDEX, self::MAX_Z_INDEX );
	}

	/**
	 * Sizing mode selected for one timeline stage.
	 *
	 * `fixed` draws the icon at the size the author set; `advanced` follows the
	 * title through the site's size bands.
	 *
	 * @param mixed $value Raw mode.
	 * @return string
	 */
	public static function size_mode( $value ) {
		return self::sanitize_choice( $value, array( 'fixed', 'advanced' ), 'fixed' );
	}

	/**
	 * The starting table of title-size bands.
	 *
	 * Three quarters of the title's size at every band, so a site that has never
	 * edited the table still draws something considered — and draws the same
	 * share of the title in a small card as beside a large headline. Mirrors
	 * `DEFAULT_SIZING_RULES` in `blocks/shared/constants.js`.
	 *
	 * @return array<int,array{font:int,icon:int}>
	 */
	public static function default_sizing_rules() {
		return array(
			array( 'font' => 12, 'icon' => 9 ),
			array( 'font' => 16, 'icon' => 12 ),
			array( 'font' => 20, 'icon' => 15 ),
			array( 'font' => 24, 'icon' => 18 ),
			array( 'font' => 32, 'icon' => 24 ),
			array( 'font' => 40, 'icon' => 30 ),
		);
	}

	/**
	 * Clean a stored table of title-size bands.
	 *
 * Each band names the icon size at one title size, and the browser holds that
 * size from its own title size up to the next row. A repeated font
 * size keeps the later row, so editing a number cannot leave two answers for
	 * one size; the list is returned smallest font first. A table with no usable
	 * row comes back empty, which the two callers below decide what to do with.
	 *
	 * @param mixed $value Raw rows.
	 * @return array<int,array{font:int,icon:int}>
	 */
	private static function clean_sizing_rules( $value ) {
		$rows    = is_array( $value ) ? $value : array();
		$by_font = array();

		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}

			$font = self::sanitize_int(
				isset( $row['font'] ) ? $row['font'] : 0,
				0,
				self::MAX_SIZING_FONT
			);
			$icon = self::sanitize_int(
				isset( $row['icon'] ) ? $row['icon'] : 0,
				0,
				self::MAX_SIZING_ICON
			);

			if ( $font < self::MIN_SIZING_RULE || $icon < self::MIN_SIZING_RULE ) {
				continue;
			}

			// A later row for the same font size wins, so editing a number
			// cannot leave two answers for one size.
			unset( $by_font[ $font ] );
			$by_font[ $font ] = $icon;
		}

		ksort( $by_font );

		$clean = array();

		foreach ( $by_font as $font => $icon ) {
			$clean[] = array( 'font' => (int) $font, 'icon' => (int) $icon );

			if ( count( $clean ) >= self::MAX_SIZING_RULES ) {
				break;
			}
		}

		return $clean;
	}

	/**
	 * The site's own title-size bands.
	 *
	 * An empty table returns the default ladder rather than an empty one: the
	 * drawing code has to size an icon from something, and a site that saved an
	 * empty table should look deliberate rather than broken. Mirrors
	 * `normalizeSizingRules()` in `blocks/shared/constants.js`.
	 *
	 * @param mixed $value Raw rows.
	 * @return array<int,array{font:int,icon:int}>
	 */
	public static function sizing_rules( $value ) {
		$clean = self::clean_sizing_rules( $value );

		return $clean ? $clean : self::default_sizing_rules();
	}

	/**
	 * One stage's own title-size bands.
	 *
	 * Unlike the site table, an empty answer stays empty: it means "use the
	 * site's bands", which is what a stage that has never had its own table
	 * means. Mirrors `stageSizingRules()` in `blocks/shared/constants.js`.
	 *
	 * @param mixed $value Raw rows.
	 * @return array<int,array{font:int,icon:int}>
	 */
	public static function stage_sizing_rules( $value ) {
		return self::clean_sizing_rules( $value );
	}

	/**
	 * Per-post location overrides. The location switches default off; section
	 * and widget overrides inherit their corresponding site-level settings.
	 *
	 * @param mixed $value Raw display settings.
	 * @return array
	 */
	public static function post_display( $value ) {
		$value     = is_array( $value ) ? $value : array();
		$locations = isset( $value['locations'] ) && is_array( $value['locations'] ) ? $value['locations'] : array();

		return array(
			'locations' => array(
				'singular' => self::post_display_choice( isset( $locations['singular'] ) ? $locations['singular'] : 'inherit' ),
				'home'     => self::post_display_choice( isset( $locations['home'] ) ? $locations['home'] : 'inherit' ),
				'archive'  => self::post_display_choice( isset( $locations['archive'] ) ? $locations['archive'] : 'inherit' ),
				'search'   => self::post_display_choice( isset( $locations['search'] ) ? $locations['search'] : 'inherit' ),
			),
			'sections'  => self::post_display_choices( isset( $value['sections'] ) ? $value['sections'] : array(), 'inherit' ),
			'widgets'   => self::post_display_choices( isset( $value['widgets'] ) ? $value['widgets'] : array(), 'inherit' ),
		);
	}

	/**
	 * One site-default override: inherit, on, or off.
	 *
	 * @param mixed  $value    Raw choice.
	 * @param string $fallback Choice used when the value is not one of the three.
	 * @return string
	 */
	public static function post_display_choice( $value, $fallback = 'inherit' ) {
		return self::sanitize_choice( $value, array( 'inherit', 'on', 'off' ), $fallback );
	}

	/**
	 * Per-section/widget choices, capped and sanitized by identifier.
	 *
	 * @param mixed  $value   Raw choices.
	 * @param string $default Choice used by a missing entry.
	 * @return array<string, string>
	 */
	public static function post_display_choices( $value, $default = 'off' ) {
		if ( ! is_array( $value ) ) {
			return array();
		}

		$clean = array();

		foreach ( $value as $key => $choice ) {
			$id = self::sanitize_key( $key );

			if ( '' === $id ) {
				continue;
			}

			$clean[ $id ] = self::post_display_choice( $choice, $default );

			if ( count( $clean ) >= 200 ) {
				break;
			}
		}

		return $clean;
	}

	/**
	 * Whether a post display choice is enabled, resolving inherited defaults.
	 *
	 * @param mixed $choice Post-level choice.
	 * @param bool  $site   Site default.
	 * @return bool
	 */
	public static function resolves_post_display( $choice, $site ) {
		$choice = self::post_display_choice( $choice );

		return 'inherit' === $choice ? (bool) $site : 'on' === $choice;
	}

	/**
	 * A duration unit, defaulting to `days`.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function unit( $value ) {
		return self::sanitize_choice( $value, self::allowed_units(), 'days' );
	}

	/**
	 * An asset identifier, capped at 64 characters.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function asset_id( $value ) {
		return substr( self::sanitize_key( $value ), 0, 64 );
	}

	/**
	 * One asset tag: lower case, single spaced, no markup.
	 *
	 * Lower case rather than as typed, because a tag is a key rather than a
	 * label: `News` and `news` have to be the same tag or an asset tagged one way
	 * never appears in a folder tagged the other.
	 *
	 * @param mixed $value Raw value.
	 * @return string Empty string when there is nothing usable left.
	 */
	public static function asset_tag( $value ) {
		// `sanitize_text_field()` already collapses runs of whitespace and trims,
		// which is what keeps a tag with a space in it one tag.
		$tag = self::sanitize_text( $value );
		$tag = function_exists( 'mb_strtolower' ) ? mb_strtolower( $tag, 'UTF-8' ) : strtolower( $tag );

		return substr( $tag, 0, self::MAX_TAG_LENGTH );
	}

	/**
	 * A list of asset tags: cleaned, de-duplicated and capped.
	 *
	 * Deliberately not `sanitize_list()`, which splits on whitespace: "hot news"
	 * is one tag a person typed, not two. A string is therefore split on commas
	 * only, and an array is taken as already split.
	 *
	 * @param mixed $value Raw value.
	 * @return string[]
	 */
	public static function asset_tags( $value ) {
		if ( is_string( $value ) ) {
			$value = explode( ',', $value );
		}

		if ( ! is_array( $value ) ) {
			return array();
		}

		$tags = array();

		foreach ( $value as $tag ) {
			$clean = self::asset_tag( $tag );

			if ( '' !== $clean && ! in_array( $clean, $tags, true ) ) {
				$tags[] = $clean;
			}
		}

		return array_slice( $tags, 0, self::MAX_ASSET_TAGS );
	}

	/**
	 * One folder: a name and the tags it collects assets by.
	 *
	 * @param mixed $value Raw value.
	 * @return array{id: string, name: string, tags: string[]}
	 */
	public static function folder( $value ) {
		$value = is_array( $value ) ? $value : array();
		$name  = self::sanitize_text( isset( $value['name'] ) ? $value['name'] : '' );
		$id    = self::asset_id( isset( $value['id'] ) ? $value['id'] : '' );

		// A folder with no id of its own is named by what it is: two folders
		// called "News" then collapse into one instead of splitting an asset
		// between them.
		if ( '' === $id ) {
			$id = self::asset_id( sanitize_title( $name ) );
		}

		return array(
			'id'   => $id,
			'name' => $name,
			'tags' => self::asset_tags( isset( $value['tags'] ) ? $value['tags'] : array() ),
		);
	}

	/**
	 * The whole folder list, de-duplicated by identifier.
	 *
	 * @param mixed $value Raw value.
	 * @return array[]
	 */
	public static function folders( $value ) {
		$folders = array();

		if ( ! is_array( $value ) ) {
			return $folders;
		}

		foreach ( $value as $folder ) {
			$clean = self::folder( $folder );

			if ( '' !== $clean['id'] && '' !== $clean['name'] ) {
				$folders[ $clean['id'] ] = $clean;
			}
		}

		return array_slice( array_values( $folders ), 0, self::MAX_FOLDERS );
	}

	/**
	 * An attachment ID, but only when it points at a real attachment.
	 *
	 * @param mixed $value Raw value.
	 * @return int Zero when the ID is not an attachment.
	 */
	public static function attachment_id( $value ) {
		$id = self::sanitize_int( $value, 0 );

		if ( $id < 1 ) {
			return 0;
		}

		return 'attachment' === get_post_type( $id ) ? $id : 0;
	}

	/**
	 * Whether the current user may use a specific attachment.
	 *
	 * Use WordPress' object-level capability check rather than role names, so
	 * custom roles and site-specific capability assignments are respected.
	 *
	 * @param mixed $value Attachment ID.
	 * @return bool
	 */
	public static function can_edit_attachment( $value ) {
		$id = self::attachment_id( $value );

		return $id > 0 && current_user_can( 'edit_post', $id );
	}

	/**
	 * An image URL. Anything that is not http(s) becomes an empty string.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function image_url( $value ) {
		return self::sanitize_url( $value );
	}

	/**
	 * An icon size, defaulting to `20px`.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function asset_size( $value ) {
		$size = self::sanitize_css_size( $value );

		return '' === $size ? '20px' : $size;
	}

	/**
	 * The size an icon is drawn at.
	 *
	 * A stage's own size wins, so one stage of a timeline can be larger than the
	 * others; an empty stage size inherits the library asset's, and an asset that
	 * has never been given one falls back to the default. Mirrors `iconSize()` in
	 * the editor's shared constants, which is what the canvas draws with.
	 *
	 * @param mixed $stage_size Size set on the stage, or an empty value.
	 * @param mixed $asset_size Size set on the library asset.
	 * @return string CSS length.
	 */
	public static function icon_size( $stage_size, $asset_size ) {
		$own = self::sanitize_css_size( $stage_size );

		return self::asset_size( '' !== $own ? $own : $asset_size );
	}

	/**
	 * Normalise an optional timeline anchor to the site timezone.
	 *
	 * Returns an empty string when the value is missing or unparseable, which
	 * makes the renderer fall back to the post date.
	 *
	 * A value may carry its own offset — the editor writes one, and a value
	 * pasted from a date picker can too. That offset is the moment's own, so
	 * the parsed date is converted to the site's timezone before it is
	 * formatted: without the conversion an instant written as `...T10:00:00Z`
	 * would be stored as `10:00:00` site time, which is a different moment on
	 * every site that is not on UTC, and the timeline would start hours away
	 * from the one the author picked.
	 *
	 * @param mixed $value Raw value.
	 * @return string `Y-m-d H:i:s` in site time, or an empty string.
	 */
	public static function anchor( $value ) {
		$value = self::sanitize_text( $value );

		if ( '' === $value ) {
			return '';
		}

		$timezone = function_exists( 'wp_timezone' ) ? wp_timezone() : new \DateTimeZone( 'UTC' );
		$date     = date_create( $value, $timezone );

		if ( ! $date ) {
			return '';
		}

		$date->setTimezone( $timezone );

		return $date->format( 'Y-m-d H:i:s' );
	}

	/* ---------------------------------------------------------------------
	 * Struct level validators.
	 * ------------------------------------------------------------------ */

	/**
	 * One stage: which asset, where, at what size, and for how long.
	 *
	 * `size` is deliberately the raw CSS length and not `asset_size()`: an empty
	 * size means "whatever the library asset is set to", and substituting the
	 * default here would silently resize every stage that has never chosen one.
	 *
	 * @param mixed $value Raw value.
	 * @return array{asset_id: string, position: string, duration: int, unit: string, size: string, size_mode: string, sizing_rules: array, flip: bool}
	 */
	public static function stage( $value ) {
		$value = is_array( $value ) ? $value : array();
		$unit  = self::unit( isset( $value['unit'] ) ? $value['unit'] : '' );

		return array(
			'asset_id' => self::asset_id( isset( $value['asset_id'] ) ? $value['asset_id'] : '' ),
			'position' => self::position( isset( $value['position'] ) ? $value['position'] : '' ),
			// Mirrors the stage's icon horizontally. Off for every stage that
			// never chose it, so an existing timeline is unchanged.
			'flip'          => self::sanitize_bool( isset( $value['flip'] ) ? $value['flip'] : false ),
			'duration'      => self::sanitize_int( isset( $value['duration'] ) ? $value['duration'] : 0, 0, self::max_duration( $unit ) ),
			'unit'          => $unit,
			'size'          => self::sanitize_css_size( isset( $value['size'] ) ? $value['size'] : '' ),
			'size_mode'     => self::size_mode( isset( $value['size_mode'] ) ? $value['size_mode'] : '' ),
			// Empty means "use the site's bands", so a stage that has never set
			// its own table follows the site instead of freezing a copy of it.
			'sizing_rules'  => self::stage_sizing_rules( isset( $value['sizing_rules'] ) ? $value['sizing_rules'] : array() ),
		);
	}

	/**
	 * One position's offset: how far to move the icon from where its position
	 * would otherwise put it.
	 *
	 * Both values are signed pixels, and they are read as *space* rather than as
	 * screen coordinates: on the axis a position points away from the title on,
	 * a positive number takes the icon further out, and a negative one brings it
	 * closer. `blocks/shared/editorTitleDom.js` is what turns them into CSS, and
	 * `blocks/shared/constants.js` is what the editor's own help text reads.
	 *
	 * @param mixed $value Raw value.
	 * @return array{x: int, y: int}
	 */
	public static function offset( $value ) {
		$value = is_array( $value ) ? $value : array();

		return array(
			'x' => self::sanitize_int( isset( $value['x'] ) ? $value['x'] : 0, -self::MAX_OFFSET, self::MAX_OFFSET ),
			'y' => self::sanitize_int( isset( $value['y'] ) ? $value['y'] : 0, -self::MAX_OFFSET, self::MAX_OFFSET ),
		);
	}

	/**
	 * An offset for every position, keyed by position keyword.
	 *
	 * Always the complete set, whether or not the stored data had one: the
	 * renderer and the editor both look an offset up by the position they are
	 * about to draw, and a missing key would silently drop the author's nudge.
	 *
	 * @param mixed $value Raw value.
	 * @return array<string, array{x: int, y: int}>
	 */
	public static function offsets( $value ) {
		$value   = is_array( $value ) ? $value : array();
		$offsets = array();

		foreach ( self::allowed_positions() as $position ) {
			$offsets[ $position ] = self::offset( isset( $value[ $position ] ) ? $value[ $position ] : array() );
		}

		return $offsets;
	}

	/**
	 * A complete three stage timeline.
	 *
	 * @param mixed $value Raw value.
	 * @return array{
	 *     enabled: bool,
	 *     anchor: string,
	 *     stage_1: array,
	 *     stage_2: array,
	 *     stage_3: array,
	 *     stage_3_behaviour: string,
	 *     position_offsets: array<string, array{x: int, y: int}>,
	 *     display: array
	 * }
	 */
	public static function timeline( $value ) {
		$value = is_array( $value ) ? $value : array();

		return array(
			'enabled'           => self::sanitize_bool( isset( $value['enabled'] ) ? $value['enabled'] : false ),
			'anchor'            => self::anchor( isset( $value['anchor'] ) ? $value['anchor'] : '' ),
			'stage_1'           => self::stage( isset( $value['stage_1'] ) ? $value['stage_1'] : array() ),
			'stage_2'           => self::stage( isset( $value['stage_2'] ) ? $value['stage_2'] : array() ),
			'stage_3'           => self::stage( isset( $value['stage_3'] ) ? $value['stage_3'] : array() ),
			'stage_3_behaviour' => self::behaviour( isset( $value['stage_3_behaviour'] ) ? $value['stage_3_behaviour'] : '' ),
			'position_offsets'  => self::offsets( isset( $value['position_offsets'] ) ? $value['position_offsets'] : array() ),
			'display'           => self::post_display( isset( $value['display'] ) ? $value['display'] : array() ),
			// The author's own answers for this post's icon, when they gave any.
			'icon_anchor'       => self::icon_anchor_override( isset( $value['icon_anchor'] ) ? $value['icon_anchor'] : '' ),
			'icon_spacing'      => self::icon_spacing_override( isset( $value['icon_spacing'] ) ? $value['icon_spacing'] : '' ),
		);
	}

	/**
	 * One library asset.
	 *
	 * @param mixed $value Raw value.
	 * @return array{id: string, label: string, url: string, attachment_id: int, size: string, tags: string[]}
	 */
	public static function library_asset( $value ) {
		$value = is_array( $value ) ? $value : array();

		return array(
			'id'            => self::asset_id( isset( $value['id'] ) ? $value['id'] : '' ),
			'label'         => self::sanitize_text( isset( $value['label'] ) ? $value['label'] : '' ),
			'url'           => self::image_url( isset( $value['url'] ) ? $value['url'] : '' ),
			// The still frame written beside an animated GIF, when there is one.
			// Same rule as the original: an http(s) URL, or nothing at all.
			'still_url'     => self::image_url( isset( $value['still_url'] ) ? $value['still_url'] : '' ),
			'attachment_id' => self::attachment_id( isset( $value['attachment_id'] ) ? $value['attachment_id'] : 0 ),
			'size'          => self::asset_size( isset( $value['size'] ) ? $value['size'] : '' ),
			'tags'          => self::asset_tags( isset( $value['tags'] ) ? $value['tags'] : array() ),
		);
	}

	/**
	 * The whole asset library, de-duplicated by identifier.
	 *
	 * Assets without an id or a URL are dropped rather than stored, so the
	 * front end can never end up with a row it cannot render.
	 *
	 * @param mixed $value Raw value.
	 * @return array[]
	 */
	public static function library( $value ) {
		$assets = array();

		if ( ! is_array( $value ) ) {
			return $assets;
		}

		foreach ( $value as $asset ) {
			$clean = self::library_asset( $asset );

			if ( '' !== $clean['id'] && '' !== $clean['url'] ) {
				$assets[ $clean['id'] ] = $clean;
			}
		}

		return array_values( $assets );
	}

	/**
	 * Post type names restricted to the public post types this site has.
	 *
	 * @param mixed $value Raw value.
	 * @return string[]
	 */
	public static function post_types( $value ) {
		$requested = self::sanitize_list( $value, 'sanitize_key' );
		$available = get_post_types( array( 'public' => true ), 'names' );

		return array_values( array_intersect( $requested, array_keys( $available ) ) );
	}

	/**
	 * Sanitize the front-end display locations.
	 *
	 * Search results carry a switch of their own: a site often wants icons on
	 * its archives and a plainer results page, and before this it had no answer
	 * of its own to give, so the page resolved no icon at all.
	 *
	 * @param mixed $value Raw settings.
	 * @return array{singular: bool, home: bool, archive: bool, search: bool}
	 */
	public static function display_locations( $value ) {
		$value = is_array( $value ) ? $value : array();

		return array(
			'singular' => self::sanitize_bool( isset( $value['singular'] ) ? $value['singular'] : true ),
			'home'     => self::sanitize_bool( isset( $value['home'] ) ? $value['home'] : true ),
			'archive'  => self::sanitize_bool( isset( $value['archive'] ) ? $value['archive'] : true ),
			'search'   => self::sanitize_bool( isset( $value['search'] ) ? $value['search'] : true ),
		);
	}

	/**
	 * Sanitize per-widget display choices keyed by registered widget ID.
	 *
	 * Unknown IDs are harmless configuration: only IDs active in WordPress's
	 * widget registry are used by the renderer. The cap keeps a crafted settings
	 * request from persisting an unbounded map.
	 *
	 * @param mixed $value Raw settings.
	 * @return array<string, bool>
	 */
	public static function widget_display( $value ) {
		if ( ! is_array( $value ) ) {
			return array();
		}

		$clean = array();

		foreach ( $value as $widget_id => $enabled ) {
			$id = self::sanitize_key( $widget_id );

			if ( '' === $id ) {
				continue;
			}

			$clean[ $id ] = self::sanitize_bool( $enabled );

			if ( count( $clean ) >= 200 ) {
				break;
			}
		}

		return $clean;
	}

	/**
	 * Sanitize per-theme-section display choices keyed by section ID.
	 *
	 * @param mixed $value Raw settings.
	 * @return array<string, bool>
	 */
	public static function section_display( $value ) {
		if ( ! is_array( $value ) ) {
			return array();
		}

		$clean = array();

		foreach ( $value as $section_id => $enabled ) {
			$id = self::sanitize_key( $section_id );

			if ( '' === $id ) {
				continue;
			}

			$clean[ $id ] = self::sanitize_bool( $enabled );

			if ( count( $clean ) >= 100 ) {
				break;
			}
		}

		return $clean;
	}

	/**
	 * The complete settings payload.
	 *
	 * @param mixed $value Raw value.
	 * @return array
	 */
	public static function settings( $value ) {
		$value = is_array( $value ) ? $value : array();

		return array(
			'enabled'           => self::sanitize_bool( isset( $value['enabled'] ) ? $value['enabled'] : false ),
			'post_types'        => self::post_types( isset( $value['post_types'] ) ? $value['post_types'] : array() ),
			'display_locations' => self::display_locations( isset( $value['display_locations'] ) ? $value['display_locations'] : array() ),
			'widget_display'    => self::widget_display( isset( $value['widget_display'] ) ? $value['widget_display'] : array() ),
			'section_display'   => self::section_display( isset( $value['section_display'] ) ? $value['section_display'] : array() ),
			'assets'            => self::library( isset( $value['assets'] ) ? $value['assets'] : array() ),
			'folders'           => self::folders( isset( $value['folders'] ) ? $value['folders'] : array() ),
			'default_stage_1'   => self::stage( isset( $value['default_stage_1'] ) ? $value['default_stage_1'] : array() ),
			'default_stage_2'   => self::stage( isset( $value['default_stage_2'] ) ? $value['default_stage_2'] : array() ),
			'default_stage_3'   => self::stage( isset( $value['default_stage_3'] ) ? $value['default_stage_3'] : array() ),
			'default_behaviour' => self::behaviour( isset( $value['default_behaviour'] ) ? $value['default_behaviour'] : '' ),
			'tight_fit'         => self::tight_fit( isset( $value['tight_fit'] ) ? $value['tight_fit'] : '' ),
			'reduced_motion'    => self::sanitize_bool( isset( $value['reduced_motion'] ) ? $value['reduced_motion'] : true ),
			'icon_anchor'       => self::icon_anchor( isset( $value['icon_anchor'] ) ? $value['icon_anchor'] : '' ),
			'icon_spacing'      => self::icon_spacing( isset( $value['icon_spacing'] ) ? $value['icon_spacing'] : 'gap' ),
			'icon_z_index'      => self::icon_z_index( isset( $value['icon_z_index'] ) ? $value['icon_z_index'] : 0 ),
			'sizing_rules'      => self::sizing_rules( isset( $value['sizing_rules'] ) ? $value['sizing_rules'] : array() ),
			'anchor_source'     => self::anchor_source( isset( $value['anchor_source'] ) ? $value['anchor_source'] : '' ),
			'anchor_datetime'   => self::anchor( isset( $value['anchor_datetime'] ) ? $value['anchor_datetime'] : '' ),
		);
	}
}
