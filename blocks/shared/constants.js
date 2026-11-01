/**
 * Shared constants and helpers for the TitleSparks editor bundles.
 *
 * Both the admin dashboard (`build-admin`) and the block editor sidebar
 * (`build-block`) read the same timeline shape, so the allow-lists, the
 * normalisers and the meta (de)serialisation live here rather than being
 * duplicated per bundle.
 *
 * Every value mirrors `Title_Sparks\Security` on the PHP side; the server remains
 * the source of truth and re-validates everything on save.
 */

import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Meta key fallback. The live value is inlined by the server as
 * `window.titleSparksEditorData.metaKey` / `window.titleSparksAdminData.metaKey`.
 */
export const META_KEY_FALLBACK = 'titlesparks_timeline_schema';

/**
 * Milliseconds in one hour and one day, used for the stage window preview.
 */
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/**
 * Deepest a single stage may run. Mirrors `Security::MAX_DURATION_*`.
 */
export const MAX_DURATION_DAYS = 3650;
export const MAX_DURATION_HOURS = 87600;
export const MAX_DURATION_MINUTES = 5256000;

/**
 * Seconds in one unit, for the duration conversions.
 *
 * Minutes are here so a stage can end on an exact minute — which is what the
 * editor's end date and time picker stores once a whole number of hours or
 * days will not do.
 */
export const UNIT_SECONDS = {
	days: 86400,
	hours: 3600,
	minutes: 60,
};

/**
 * Seconds in one of a unit.
 *
 * @param {string} unit Unit keyword.
 * @return {number} Seconds, defaulting to a day for an unknown unit.
 */
export const unitSeconds = ( unit ) =>
	UNIT_SECONDS[ unit ] || UNIT_SECONDS.days;

/**
 * Position choices offered in the editor.
 *
 * Only the two sides: vertical placement is the offset fields' job, and they
 * move the icon freely in both directions from either side.
 */
export const POSITIONS = [
	{ label: __( 'Left of title', 'titlesparks' ), value: 'left' },
	{ label: __( 'Right of title', 'titlesparks' ), value: 'right' },
];

/**
 * Position values only, for validation.
 *
 * Mirrors `Security::allowed_positions()`.
 */
export const POSITION_VALUES = POSITIONS.map( ( option ) => option.value );

/**
 * The label of a position.
 *
 * @param {string} position Position keyword.
 * @return {string} Label, or the keyword itself when it is not one.
 */
export const positionLabel = ( position ) => {
	const option = POSITIONS.find( ( item ) => item.value === position );

	return option ? option.label : position;
};

/**
 * Furthest a position offset may move an icon, in pixels.
 *
 * Mirrors `Security::MAX_OFFSET`. The offset is signed, so it runs from
 * `-OFFSET_MAX` to `OFFSET_MAX`.
 */
export const OFFSET_MAX = 100;

/**
 * Clamp a raw offset to a whole, signed number of pixels.
 *
 * @param {*} value Raw value from a number input or stored JSON.
 * @return {number} Whole pixels, `-OFFSET_MAX` to `OFFSET_MAX`.
 */
export const sanitizeOffset = ( value ) => {
	const parsed = Number.parseInt( value, 10 );

	if ( ! Number.isFinite( parsed ) ) {
		return 0;
	}

	return Math.max( -OFFSET_MAX, Math.min( OFFSET_MAX, parsed ) );
};

/**
 * Normalise an offset into `{ x, y }`.
 *
 * @param {Object} offset Raw offset.
 * @return {{x: number, y: number}} Signed pixels.
 */
export const emptyOffset = ( offset = {} ) => ( {
	x: sanitizeOffset( offset.x ),
	y: sanitizeOffset( offset.y ),
} );

/**
 * Normalise the per-position offsets.
 *
 * Every position is present, whether or not the stored value had it: the
 * placement looks an offset up by the position being drawn, so a missing key
 * would silently drop the author's nudge.
 *
 * @param {Object} offsets Raw offsets, keyed by position.
 * @return {Object} Complete offset map.
 */
export const emptyOffsets = ( offsets = {} ) => {
	const source = offsets && typeof offsets === 'object' ? offsets : {};

	return POSITION_VALUES.reduce(
		( all, position ) => ( {
			...all,
			[ position ]: emptyOffset( source[ position ] ),
		} ),
		{}
	);
};

/**
 * The offset stored for one position.
 *
 * @param {Object} timeline Timeline.
 * @param {string} position Position keyword.
 * @return {{x: number, y: number}} Signed pixels, `{ 0, 0 }` when unset.
 */
export const offsetFor = ( timeline, position ) =>
	emptyOffsets( timeline && timeline.position_offsets )[ position ] ||
	emptyOffset();

/**
 * Which way a positive offset moves the icon, per position.
 *
 * Offsets are screen coordinates, so the answer is the same for every position:
 * a positive number moves the icon right, and a positive vertical number moves
 * it down. A negative moves it left or up. That is what an author reaches for
 * when sliding a control, and it keeps the two fields meaning one thing no
 * matter which side of the title is in hand.
 *
 * Both numbers move the icon freely in either direction on every position,
 * within ±100, as the editor and the front end both apply. Inline widget icons
 * are the one exception: they keep a small horizontal clearance from their own
 * title text.
 *
 * These words are what `offsetHint()` builds its sentence from — the sidebar
 * itself only labels the two fields "x" and "y".
 */
const RIGHT_DOWN = {
	x: __( 'right', 'titlesparks' ),
	y: __( 'down', 'titlesparks' ),
};

export const OFFSET_DIRECTIONS = {
	left: RIGHT_DOWN,
	right: RIGHT_DOWN,
};

/**
 * The direction words for one position.
 *
 * Falls back to the plain right-hand side so an unknown keyword can never blank
 * the field's help, and `iconOffset.test.js` checks that every position the
 * server accepts has its own entry, so a new one cannot be added without
 * describing it.
 *
 * @param {string} position Position keyword.
 * @return {{x: string, y: string}} Where a positive number moves the icon.
 */
export const offsetDirections = ( position ) =>
	OFFSET_DIRECTIONS[ position ] || OFFSET_DIRECTIONS.right;

/**
 * The help text the Offset field shows for one position.
 *
 * Built here rather than in the sidebar so that the sentence and the words it
 * puts in it come from one place — and so the wording can be checked without
 * rendering React, which is what keeps "plus moves right / down" honest.
 *
 * The second sentence is the part an author cannot guess from the fields: the
 * number is written against the editor's own title size, and the nudge keeps
 * its look where the theme draws the title at another size — so the same numbers
 * do not mean the same pixels on the front end, which is deliberate. See
 * `OFFSET_REFERENCE_PX` in `editorTitleDom.js`.
 *
 * @param {string} position Position keyword.
 * @return {string} Translated help text.
 */
export const offsetHint = ( position ) => {
	const { x, y } = offsetDirections( position );

	return `${ sprintf(
		/* translators: 1: direction the horizontal field moves the icon, 2: direction the vertical field moves it. */
		__( 'Plus moves it %1$s / %2$s, minus the other way.', 'titlesparks' ),
		x,
		y
	) } ${ __(
		'It is measured at the editor\u2019s title size and keeps its place as the title changes size on the page.',
		'titlesparks'
	) }`;
};

/**
 * Duration unit choices, mirroring `Security::allowed_units()`.
 */
export const UNITS = [
	{ label: __( 'Days', 'titlesparks' ), value: 'days' },
	{ label: __( 'Hours', 'titlesparks' ), value: 'hours' },
	{ label: __( 'Minutes', 'titlesparks' ), value: 'minutes' },
];

/**
 * Where a timeline starts, mirroring `Security::allowed_anchor_sources()`.
 *
 * The settings page picks one for the whole site; a single post can still
 * store its own anchor.
 */
export const ANCHOR_SOURCES = [
	{
		label: __( "The post's publish date", 'titlesparks' ),
		value: 'post',
	},
	{
		label: __( 'A date and time I choose', 'titlesparks' ),
		value: 'fixed',
	},
];

/**
 * Unit values only, for validation.
 */
export const UNIT_VALUES = UNITS.map( ( option ) => option.value );

/**
 * Units an icon size may be given in.
 *
 * Kept to the four an author reaches for; the server accepts a couple more, so
 * a size written by hand or by an older value is never rejected on the way in.
 */
export const SIZE_UNITS = [
	{ label: __( 'px', 'titlesparks' ), value: 'px' },
	{ label: __( 'em', 'titlesparks' ), value: 'em' },
	{ label: __( 'rem', 'titlesparks' ), value: 'rem' },
	{ label: __( '%', 'titlesparks' ), value: '%' },
];

/**
 * The size an icon falls back to when nothing says otherwise.
 *
 * Mirrors `Security::asset_size()`: an asset that was never given a size still
 * renders, at this one.
 */
export const DEFAULT_ICON_SIZE = '20px';

/**
 * A CSS length: up to four digits, an optional fraction, and a unit.
 *
 * Mirrors the pattern in `Security::sanitize_css_size()`. The anchor is
 * deliberate — a value with no unit, or one that could close a declaration and
 * start another, is not a length.
 */
const CSS_SIZE = /^(\d{1,4}(?:\.\d{1,3})?)(px|em|rem|%|vw|vh)$/;

/**
 * Normalise a CSS length.
 *
 * @param {*} value Raw value.
 * @return {string} The length, or an empty string when it is not one.
 */
export const sanitizeCssSize = ( value ) => {
	const text = typeof value === 'string' ? value.trim() : '';

	return CSS_SIZE.test( text ) ? text : '';
};

/**
 * Split a size into the number and the unit the two fields show.
 *
 * An unusable or missing size falls back to the one handed in — the asset's own,
 * or the default — so the fields always describe the size that will be drawn.
 *
 * @param {string} value    Stored size.
 * @param {string} fallback Size to describe when there is none.
 * @return {{number: string, unit: string}} Field values.
 */
export const splitCssSize = ( value, fallback = DEFAULT_ICON_SIZE ) => {
	const size =
		sanitizeCssSize( value ) ||
		sanitizeCssSize( fallback ) ||
		DEFAULT_ICON_SIZE;
	const parts = size.match( CSS_SIZE );

	return { number: parts[ 1 ], unit: parts[ 2 ] };
};

/**
 * Build a size from the two fields.
 *
 * An empty number is not an error: it means "no size of my own", which is how
 * a stage goes back to the size set on the library asset.
 *
 * @param {string|number} number Field value.
 * @param {string}        unit   Unit keyword.
 * @return {string} A CSS length, or an empty string.
 */
export const joinCssSize = ( number, unit = 'px' ) => {
	const digits = String(
		number === undefined || number === null ? '' : number
	).trim();

	return '' === digits ? '' : sanitizeCssSize( `${ digits }${ unit }` );
};

/**
 * The size a fixed icon should be drawn at.
 *
 * The stage's own size wins, so one stage can be bigger than the others; an
 * empty stage size inherits the library asset's, which is what every stage did
 * before it could set one. A title-following icon is sized from the bands once
 * its title has been measured, so this is the fixed size it starts from.
 *
 * @param {Object} stage Stage value.
 * @param {Object} asset Library asset.
 * @return {string} CSS length.
 */
export const iconSize = ( stage, asset ) =>
	sanitizeCssSize( stage && stage.size ) ||
	sanitizeCssSize( asset && asset.size ) ||
	DEFAULT_ICON_SIZE;

/**
 * Stage 3 behaviour choices, mirroring `Security::allowed_behaviours()`.
 */
export const BEHAVIOURS = [
	{ label: __( 'Keep Icon Permanently', 'titlesparks' ), value: 'keep' },
	{ label: __( 'Disappear Completely', 'titlesparks' ), value: 'remove' },
];

/**
 * Behaviour values only, for validation.
 */
export const BEHAVIOUR_VALUES = BEHAVIOURS.map( ( option ) => option.value );

/**
 * How a stage's icon is sized.
 *
 * `fixed` uses the size the author set. `advanced` follows the title from
 * title-size bands: the stage's own table when it has one, the site's when it
 * does not.
 *
 * @param {*} value Stored mode, as the meta or the server has it.
 * @return {string} `fixed` or `advanced`.
 */
export const sizeMode = ( value ) =>
	'advanced' === value ? 'advanced' : 'fixed';

/**
 * The two answers for an icon inside a narrow card.
 *
 * Offered in Settings as one on/off switch: off (`keep`) draws the icon
 * exactly as the author placed it and leaves the card edge to the theme; on
 * (`shrink`) draws a smaller icon that fits, so the title is never indented and
 * no word moves. Two answers only: an administrator never has to decide whether
 * an icon an author chose should be shrunk or dropped.
 *
 * Mirrors `Security::allowed_tight_fits()` on the PHP side.
 */
export const TIGHT_FITS = [
	{
		label: __( 'Leave the icon exactly as it is', 'titlesparks' ),
		value: 'keep',
		description: __(
			'Nothing is resized. The icon keeps the size and offset you set, and the card edge is left to your theme — most themes show the part that sticks out.',
			'titlesparks'
		),
	},
	{
		label: __( 'Shrink the icon to fit the card', 'titlesparks' ),
		value: 'shrink',
		description: __(
			'An icon that a card would cut off is drawn smaller, down to 8px, so it fits inside. The title keeps its line length and its words never move.',
			'titlesparks'
		),
	},
];

/**
 * Tight-fit values only, for validation.
 */
export const TIGHT_FIT_VALUES = TIGHT_FITS.map( ( option ) => option.value );

/**
 * The tight-fit answer used when nothing else says otherwise.
 *
 * `keep` leaves the author's icon untouched, so a site that has never made a
 * choice never finds an icon resized.
 */
export const TIGHT_FIT_DEFAULT = 'keep';

/**
 * Normalise a stored tight-fit choice.
 *
 * The retired `hide` answer falls back to `keep`, so a stored row cannot start
 * dropping an icon behind the author's back. Any value that is not one of the
 * two answers resolves to the default.
 *
 * @param {string} value Stored value.
 * @return {string} A choice from `TIGHT_FIT_VALUES`.
 */
export const tightFitMode = ( value ) =>
	TIGHT_FIT_VALUES.includes( value ) ? value : TIGHT_FIT_DEFAULT;

/**
 * What the icon's vertical position is measured against.
 *
 * The offset fields move the icon from one line of the title. `first_line`
 * measures from the first line, so a title that grows to two or three lines — a
 * narrower column, a phone, a longer headline — leaves the icon on the line the
 * author placed it on. `block` measures from the whole paragraph, which pulls
 * the icon down towards the middle of a wrapped title.
 *
 * Shown as radio cards in Settings, each with what it does to a wrapped title.
 *
 * Mirrors `Security::allowed_icon_anchors()` on the PHP side.
 */
export const ICON_ANCHORS = [
	{
		label: __( 'First line of the title', 'titlesparks' ),
		value: 'first_line',
		description: __(
			'The icon stays on the first line, so Y moves it from that line however many lines the title takes. This is what you set the offset against.',
			'titlesparks'
		),
	},
	{
		label: __( 'Last line of the title', 'titlesparks' ),
		value: 'last_line',
		description: __(
			'The icon stays on the last line, so Y counts from the bottom line of a wrapped title — and a side icon sits after that line\u2019s last word. The end of the words rather than their start.',
			'titlesparks'
		),
	},
	{
		label: __( 'Middle of the whole title', 'titlesparks' ),
		value: 'block',
		description: __(
			'The icon is centred on all of the lines together, so Y counts from the middle of the paragraph and a wrapped title pushes the icon down.',
			'titlesparks'
		),
	},
];

/**
 * Anchor values only, for validation.
 */
export const ICON_ANCHOR_VALUES = ICON_ANCHORS.map(
	( option ) => option.value
);

/**
 * The anchor an untouched site uses: the first line.
 */
export const ICON_ANCHOR_DEFAULT = 'first_line';

/**
 * Normalise a stored icon-anchor choice.
 *
 * @param {string} value Stored value.
 * @return {string} A choice from `ICON_ANCHOR_VALUES`.
 */
export const iconAnchorMode = ( value ) =>
	ICON_ANCHOR_VALUES.includes( value ) ? value : ICON_ANCHOR_DEFAULT;

/**
 * The space left beside an icon, as offered in Settings and the post sidebar.
 *
 * `gap` is the shipped `0.15em` of the title's own size, which is what every
 * page has always drawn. `flush` leaves none at all, for an icon whose picture
 * is meant to finish the last word rather than stand beside it.
 *
 * Mirrors `Security::allowed_icon_spacings()` on the PHP side.
 */
export const ICON_SPACINGS = [
	{
		label: __( 'Standard gap', 'titlesparks' ),
		value: 'gap',
		description: __(
			'Leaves the usual space between the icon and the words, a fraction of the title\u2019s own size.',
			'titlesparks'
		),
	},
	{
		label: __( 'Flush against the words', 'titlesparks' ),
		value: 'flush',
		description: __(
			'Puts the icon\u2019s own edge against the last character, with no space between them.',
			'titlesparks'
		),
	},
];

/**
 * Spacing values only, for validation.
 */
export const ICON_SPACING_VALUES = ICON_SPACINGS.map(
	( option ) => option.value
);

/**
 * The spacing an untouched post uses: the gap.
 */
export const ICON_SPACING_DEFAULT = 'gap';

/**
 * Normalise a stored icon-spacing choice.
 *
 * @param {string} value Stored value.
 * @return {string} `gap` or `flush`.
 */
export const iconSpacingMode = ( value ) =>
	ICON_SPACING_VALUES.includes( value ) ? value : ICON_SPACING_DEFAULT;

/**
 * The space beside one icon: its own answer, or the site's when it has none.
 *
 * @param {string} value Post answer, `''` to follow the site.
 * @param {string} site  The site's answer.
 * @return {string} `gap` or `flush`.
 */
export const resolveIconSpacing = ( value, site ) =>
	iconSpacingMode( ICON_SPACING_VALUES.includes( value ) ? value : site );

/**
 * The icon's stacking order when the site has not chosen one.
 *
 * The icon is already positioned, so this is the page's normal order: nothing
 * about the way an untouched site draws it changes.
 */
export const ICON_Z_INDEX_DEFAULT = 0;

/**
 * The smallest and largest `z-index` CSS accepts.
 *
 * Mirrors `Security::MAX_Z_INDEX`. A value outside this range is not a CSS
 * stacking order, so it is clamped rather than passed through.
 */
export const ICON_Z_INDEX_MIN = -2147483647;
export const ICON_Z_INDEX_MAX = 2147483647;

/**
 * Normalise a stored icon stacking order.
 *
 * Mirrors `Security::icon_z_index()`. A missing or unusable value is the
 * default rather than an error, because a settings row written before the
 * setting existed has no opinion.
 *
 * @param {*} value Stored value.
 * @return {number} A whole number within the CSS range.
 */
export const iconZIndex = ( value ) => {
	const parsed = Number.parseInt( value, 10 );

	if ( ! Number.isFinite( parsed ) ) {
		return ICON_Z_INDEX_DEFAULT;
	}

	return Math.max( ICON_Z_INDEX_MIN, Math.min( ICON_Z_INDEX_MAX, parsed ) );
};

/**
 * The three stage indexes, in order.
 */
export const STAGE_INDEXES = [ 1, 2, 3 ];

/**
 * Deepest a stage may run in the given unit.
 *
 * @param {string} unit Unit keyword.
 * @return {number} Largest count that unit allows.
 */
export const maxForUnit = ( unit ) => {
	switch ( unit ) {
		case 'minutes':
			return MAX_DURATION_MINUTES;
		case 'hours':
			return MAX_DURATION_HOURS;
		default:
			return MAX_DURATION_DAYS;
	}
};

/**
 * Clamp a raw duration to a whole number within range for its unit.
 *
 * @param {*}      value Raw value from a `TextControl`.
 * @param {string} unit  Unit keyword.
 * @return {number} Whole count, `0` to the unit maximum.
 */
export const sanitizeDuration = ( value, unit = 'days' ) => {
	const parsed = Number.parseInt( value, 10 );

	if ( ! Number.isFinite( parsed ) || parsed <= 0 ) {
		return 0;
	}

	return Math.min( parsed, maxForUnit( unit ) );
};

/**
 * Convert a duration between the two supported units, for a friendly switch.
 *
 * @param {number} duration Duration in the source unit.
 * @param {string} from     Source unit.
 * @param {string} to       Target unit.
 * @return {number} Converted duration.
 */
export const convertDuration = ( duration, from, to ) => {
	if ( from === to ) {
		return duration;
	}

	const converted = ( duration * unitSeconds( from ) ) / unitSeconds( to );

	return Math.max( 0, Math.round( converted ) );
};

/**
 * Normalise a single stage into a complete, safe object.
 *
 * @param {Object} [stage] Raw stage.
 * @return {{asset_id: string, position: string, duration: number, unit: string, size: string, size_mode: string, sizing_rules: Array, flip: boolean}} Safe stage.
 */
export const emptyStage = ( stage = {} ) => {
	const unit = UNIT_VALUES.includes( stage.unit ) ? stage.unit : 'days';

	return {
		asset_id: typeof stage.asset_id === 'string' ? stage.asset_id : '',
		position: POSITION_VALUES.includes( stage.position )
			? stage.position
			: 'left',
		// Mirrors the icon horizontally, for an asset that faces the wrong way.
		// Off unless the author asks, so a stage saved before this existed is
		// drawn exactly as it was.
		flip: Boolean( stage.flip ),
		duration: sanitizeDuration( stage.duration, unit ),
		unit,
		// Empty means "use the size set on the library asset", which is what
		// the front end reads it as too.
		size: sanitizeCssSize( stage.size ),
		size_mode: sizeMode( stage.size_mode ),
		// A title-following stage's own bands. Empty inherits the site's table,
		// which is what every stage did before it could carry its own.
		sizing_rules: stageSizingRules( stage.sizing_rules ),
	};
};

/**
 * Choices available for per-post output overrides.
 */
export const POST_DISPLAY_CHOICES = [
	{ label: __( 'Use site setting', 'titlesparks' ), value: 'inherit' },
	{ label: __( 'Show', 'titlesparks' ), value: 'on' },
	{ label: __( 'Hide', 'titlesparks' ), value: 'off' },
];

export const POST_DISPLAY_LOCATIONS = [
	{ label: __( 'Post page title', 'titlesparks' ), key: 'singular' },
	{
		label: __( 'Homepage listings and sliders', 'titlesparks' ),
		key: 'home',
	},
	{ label: __( 'Archive/category listings', 'titlesparks' ), key: 'archive' },
	{ label: __( 'Search results', 'titlesparks' ), key: 'search' },
];

/**
 * Normalize one post-level inherit/on/off location.
 * @param {*}      value    Stored choice.
 * @param {string} fallback Choice to use when it is not one of the three.
 * @return {string} `off`, `inherit` or `on`.
 */
export const postDisplayChoice = ( value, fallback = 'inherit' ) =>
	[ 'off', 'inherit', 'on' ].includes( value ) ? value : fallback;

/**
 * The bands title-following icons start from.
 *
 * Three quarters of the title's size at every band, so a site that has never
 * edited its table still draws something considered — and draws the same share
 * of the title in a small card as beside a large headline. Mirrors
 * `Security::default_sizing_rules()`.
 */
export const DEFAULT_SIZING_RULES = [
	{ font: 12, icon: 9 },
	{ font: 16, icon: 12 },
	{ font: 20, icon: 15 },
	{ font: 24, icon: 18 },
	{ font: 32, icon: 24 },
	{ font: 40, icon: 30 },
];

/** Smallest/largest a band may name, in pixels. Mirrors `Security::MAX_SIZING_*`. */
export const MIN_SIZING_RULE = 4;
export const MAX_SIZING_RULES = 8;
export const MAX_SIZING_FONT = 200;
export const MAX_SIZING_ICON = 512;

/**
 * Clean a stored table of title-size bands.
 *
 * Each band names the icon size at one title size, and the drawing code holds
 * that size from its own title size up to the next row. A repeated font size
 * keeps the later row and the list
 * comes back smallest font first. A table with no usable row comes back empty,
 * which the callers below decide what to do with. Mirrors the PHP normaliser.
 *
 * @param {*} value Stored rows, `{ font, icon }` in pixels.
 * @return {Array} `{ font, icon }` bands, possibly empty.
 */
const cleanSizingRules = ( value ) => {
	const rows = Array.isArray( value ) ? value : [];
	const byFont = new Map();

	rows.forEach( ( row ) => {
		const number = ( raw, max ) => {
			const parsed = Math.trunc( Number( raw ) );

			return Number.isFinite( parsed )
				? Math.min( max, Math.max( 0, parsed ) )
				: 0;
		};
		const font = number( row && row.font, MAX_SIZING_FONT );
		const icon = number( row && row.icon, MAX_SIZING_ICON );

		if ( font < MIN_SIZING_RULE || icon < MIN_SIZING_RULE ) {
			return;
		}

		// A later row for the same font size wins, so editing a number cannot
		// leave two answers for one size.
		byFont.delete( font );
		byFont.set( font, icon );
	} );

	return [ ...byFont.entries() ]
		.sort( ( a, b ) => a[ 0 ] - b[ 0 ] )
		.slice( 0, MAX_SIZING_RULES )
		.map( ( [ font, icon ] ) => ( { font, icon } ) );
};

/**
 * The site's own title-size bands, cleaned up.
 *
 * An empty table returns the default ladder: the drawing code has to size an
 * icon from something, and a site that saved an empty table should look
 * deliberate rather than iconless. Mirrors `Security::sizing_rules()`.
 *
 * @param {*} value Stored rows, `{ font, icon }` in pixels.
 * @return {Array} `{ font, icon }` bands.
 */
export const normalizeSizingRules = ( value ) => {
	const rows = cleanSizingRules( value );

	return rows.length
		? rows
		: DEFAULT_SIZING_RULES.map( ( rule ) => ( { ...rule } ) );
};

/**
 * One stage's own title-size bands.
 *
 * Unlike the site table, an empty answer stays empty: it means "use the site's
 * bands", which is what a stage that has never had its own table means.
 * Mirrors `Security::stage_sizing_rules()`.
 *
 * @param {*} value Stored rows, `{ font, icon }` in pixels.
 * @return {Array} `{ font, icon }` bands, empty when the stage inherits.
 */
export const stageSizingRules = ( value ) => cleanSizingRules( value );

/**
 * Resolve the effective location choice against the site-wide switch.
 * @param {string}  choice      Post-level choice, or `inherit`.
 * @param {boolean} siteDefault Site-wide answer for the location.
 * @return {boolean} Whether the icon is drawn there.
 */
export const resolvesPostDisplay = ( choice, siteDefault = false ) =>
	'inherit' === postDisplayChoice( choice )
		? Boolean( siteDefault )
		: 'on' === choice;

/**
 * Resolve post location overrides against the site's saved defaults.
 *
 * @param {Object} display      Per-post display choices.
 * @param {Object} siteDefaults Site-level location defaults.
 * @return {Object<string, boolean>} Effective display by location.
 */
export const effectivePostDisplayLocations = ( display, siteDefaults = {} ) =>
	POST_DISPLAY_LOCATIONS.reduce(
		( result, location ) => ( {
			...result,
			[ location.key ]: resolvesPostDisplay(
				display?.locations?.[ location.key ],
				siteDefaults[ location.key ]
			),
		} ),
		{}
	);

/**
 * Resolve named widget/section overrides against site defaults.
 * @param {Object} choices     Override per location name.
 * @param {Object} siteChoices Site-level answer per location name.
 * @return {Object<string, boolean>} Effective answer per location name.
 */
export const resolvesPostDisplayMap = ( choices = {}, siteChoices = {} ) =>
	Object.keys( siteChoices ).reduce( ( result, key ) => {
		result[ key ] = resolvesPostDisplay(
			choices[ key ] || 'inherit',
			siteChoices[ key ]
		);
		return result;
	}, {} );

export const emptyTimeline = ( timeline = {} ) => ( {
	enabled: Boolean( timeline.enabled ),
	anchor: typeof timeline.anchor === 'string' ? timeline.anchor : '',
	stage_1: emptyStage( timeline.stage_1 ),
	stage_2: emptyStage( timeline.stage_2 ),
	stage_3: emptyStage( timeline.stage_3 ),
	stage_3_behaviour: BEHAVIOUR_VALUES.includes( timeline.stage_3_behaviour )
		? timeline.stage_3_behaviour
		: 'keep',
	position_offsets: emptyOffsets( timeline.position_offsets ),
	// `''` keeps the site's answer, which is what every post that has never
	// chosen one stores; a post that did keeps its own answer there.
	icon_anchor: ICON_ANCHOR_VALUES.includes( timeline.icon_anchor )
		? timeline.icon_anchor
		: '',
	icon_spacing: ICON_SPACING_VALUES.includes( timeline.icon_spacing )
		? timeline.icon_spacing
		: '',
	display: {
		locations: POST_DISPLAY_LOCATIONS.reduce(
			( result, location ) => ( {
				...result,
				[ location.key ]: postDisplayChoice(
					timeline.display?.locations?.[ location.key ],
					'inherit'
				),
			} ),
			{}
		),
		sections: Object.entries( timeline.display?.sections || {} ).reduce(
			( result, [ key, value ] ) => ( {
				...result,
				[ key ]: postDisplayChoice( value ),
			} ),
			{}
		),
		widgets: Object.entries( timeline.display?.widgets || {} ).reduce(
			( result, [ key, value ] ) => ( {
				...result,
				[ key ]: postDisplayChoice( value ),
			} ),
			{}
		),
	},
} );

/**
 * Length of a single stage in seconds.
 *
 * @param {Object} stage Stage value.
 * @return {number} The stage's length in seconds.
 */
export const stageSeconds = ( stage ) => {
	const normalised = emptyStage( stage );

	return normalised.duration * unitSeconds( normalised.unit );
};

/**
 * Total length of a timeline in seconds.
 *
 * @param {Object} timeline Timeline.
 * @return {number} All three stages together, in seconds.
 */
export const totalSeconds = ( timeline ) =>
	STAGE_INDEXES.reduce(
		( total, index ) =>
			total + stageSeconds( timeline[ `stage_${ index }` ] ),
		0
	);

/**
 * Human readable duration from a number of seconds, e.g. "3 days 12 hours".
 *
 * @param {number} seconds Total seconds.
 * @return {string} The duration in words.
 */
export const formatSeconds = ( seconds ) => {
	if ( seconds < 1 ) {
		return __( 'No stage is active yet.', 'titlesparks' );
	}

	const days = Math.floor( seconds / 86400 );
	const hours = Math.floor( ( seconds % 86400 ) / 3600 );
	const minutes = Math.round( ( seconds % 3600 ) / 60 );
	const parts = [];

	if ( days > 0 ) {
		parts.push(
			sprintf(
				/* translators: %d: number of days. */
				_n( '%d day', '%d days', days, 'titlesparks' ),
				days
			)
		);
	}

	if ( hours > 0 || ( days === 0 && minutes === 0 ) ) {
		parts.push(
			sprintf(
				/* translators: %d: number of hours. */
				_n( '%d hour', '%d hours', hours, 'titlesparks' ),
				hours
			)
		);
	}

	// Minutes only once they are the finest part: a whole number of days or
	// hours reads better without a trailing "0 minutes".
	if ( minutes > 0 ) {
		parts.push(
			sprintf(
				/* translators: %d: number of minutes. */
				_n( '%d minute', '%d minutes', minutes, 'titlesparks' ),
				minutes
			)
		);
	}

	return parts.join( ' ' );
};

/**
 * Human readable total length of a timeline.
 *
 * @param {Object} timeline Timeline.
 * @return {string} The whole timeline in words.
 */
export const formatTotal = ( timeline ) =>
	formatSeconds( totalSeconds( timeline ) );

/**
 * Longest a single asset tag may be. Mirrors `Security::MAX_TAG_LENGTH`.
 */
export const MAX_TAG_LENGTH = 32;

/**
 * Most tags one asset may carry. Mirrors `Security::MAX_ASSET_TAGS`.
 */
export const MAX_ASSET_TAGS = 12;

/**
 * Most folders a site may create. Mirrors `Security::MAX_FOLDERS`.
 */
export const MAX_FOLDERS = 50;

/**
 * How many library cards one page shows. Four to a row, two rows.
 *
 * The grid is the reason for the number: a page that ends mid-row reads as a
 * layout bug, and a longer page scrolls past the folder list it is answering to.
 */
export const LIBRARY_PAGE_SIZE = 8;

/**
 * One tag, normalised the way the server stores it.
 *
 * Lower case rather than as typed, because a tag is a key and not a label:
 * `News` and `news` have to be the same tag, or an asset tagged one way never
 * appears in a folder watching the other. Mirrors `Security::asset_tag()`.
 *
 * @param {*} value Raw value.
 * @return {string} Trimmed, single spaced, lower case, capped.
 */
export const sanitizeTag = ( value ) =>
	String( value === null || undefined === value ? '' : value )
		.replace( /\s+/g, ' ' )
		.trim()
		.toLowerCase()
		.slice( 0, MAX_TAG_LENGTH );

/**
 * A list of tags: cleaned, de-duplicated, capped.
 *
 * A string is split on commas only, because a tag may contain a space and
 * `hot news` is one tag a person typed. Mirrors `Security::asset_tags()`.
 *
 * @param {*} value Array or comma separated string.
 * @return {string[]} Clean tags, each appearing once.
 */
export const sanitizeTags = ( value ) => {
	const list = Array.isArray( value )
		? value
		: String( value || '' ).split( ',' );
	const tags = [];

	list.forEach( ( tag ) => {
		const clean = sanitizeTag( tag );

		if ( clean && ! tags.includes( clean ) ) {
			tags.push( clean );
		}
	} );

	return tags.slice( 0, MAX_ASSET_TAGS );
};

/**
 * Normalise the asset list handed to the editor.
 *
 * `url` is the file the front end draws; `preview` is WordPress' smaller copy
 * of it, which grids paint first because an animated GIF is several megabytes
 * (see `useDeferredPreview`). It is empty when the asset is not an attachment
 * WordPress could size, in which case the grid uses the original.
 *
 * `tags` are normalised here rather than trusted, so a row written by an older
 * version — or by hand — cannot put an unusable tag in a folder's filter.
 *
 * @param {*} assets Raw list.
 * @return {Array<{id: string, label: string, url: string, preview: string, size: string, tags: string[]}>} Assets in the shape the editor reads.
 */
export const normalizeAssets = ( assets ) =>
	Array.isArray( assets )
		? assets
				.filter( ( asset ) => asset && asset.id && asset.url )
				.map( ( asset ) => ( {
					id: String( asset.id ),
					label: String( asset.label || asset.id ),
					url: String( asset.url ),
					preview: asset.preview ? String( asset.preview ) : '',
					size: asset.size || '20px',
					tags: sanitizeTags( asset.tags ),
				} ) )
		: [];

/**
 * A folder identifier from a name, the way `sanitize_title()` and
 * `Security::folder()` do it on the server: lower case, non-alphanumerics to
 * dashes. Two folders called "News" are therefore one folder.
 *
 * @param {string} name Folder name.
 * @return {string} The identifier both sides store the folder under.
 */
export const folderId = ( name ) =>
	String( name || '' )
		.toLowerCase()
		.normalize( 'NFKD' )
		.replace( /[^a-z0-9]+/g, '-' )
		.replace( /^-+|-+$/g, '' )
		.slice( 0, 64 );

/**
 * Normalise the folder list.
 *
 * Two rows that resolve to the same identifier are one folder, and the later
 * one is the one that survives — the same rule `Security::folders()` applies,
 * where the keyed array is overwritten as it is walked. Keeping the earlier row
 * would quietly drop the tags of the row the server would have kept.
 *
 * @param {*} folders Raw list.
 * @return {Array<{id: string, name: string, tags: string[]}>} Folders, one per identifier.
 */
export const normalizeFolders = ( folders ) => {
	const byId = new Map();

	( Array.isArray( folders ) ? folders : [] ).forEach( ( folder ) => {
		const id = String(
			( folder && folder.id ) || folderId( folder && folder.name )
		);
		const name = String( ( folder && folder.name ) || '' ).trim();

		if ( id && name ) {
			byId.set( id, {
				id,
				name,
				tags: sanitizeTags( folder && folder.tags ),
			} );
		}
	} );

	return [ ...byId.values() ].slice( 0, MAX_FOLDERS );
};

/**
 * Whether an asset belongs in a folder.
 *
 * At least one of the folder's tags — a union, not an intersection. A folder is
 * a view an author widens by naming another tag, and an author who tags a new
 * icon `news` expects it in the News folder without also remembering every
 * other tag that folder happens to watch. A folder with no tags holds nothing:
 * it is a name waiting for one, which the panel says out loud.
 *
 * @param {Object} folder Normalised folder.
 * @param {Object} asset  Normalised asset.
 * @return {boolean} Whether at least one tag of theirs matches.
 */
export const folderHas = ( folder, asset ) => {
	const tags = ( folder && folder.tags ) || [];
	const assetTags = ( asset && asset.tags ) || [];

	return tags.some( ( tag ) => assetTags.includes( tag ) );
};

/**
 * The assets a folder collects.
 *
 * @param {Array}  assets Normalised assets.
 * @param {Object} folder Normalised folder, or null for the whole library.
 * @return {Array} The assets the folder collects, unchanged when it is null.
 */
export const assetsInFolder = ( assets = [], folder = null ) =>
	folder ? assets.filter( ( asset ) => folderHas( folder, asset ) ) : assets;

/**
 * Every tag in use, with how many assets carry it, A-Z.
 *
 * This is what the tag editor offers as suggestions, so an author reuses the
 * tag a folder already watches instead of inventing a near-miss of it.
 *
 * @param {Array} assets Normalised assets.
 * @return {Array<{tag: string, count: number}>} Tags with their counts, A-Z.
 */
export const tagIndex = ( assets = [] ) => {
	const counts = new Map();

	assets.forEach( ( asset ) => {
		( asset.tags || [] ).forEach( ( tag ) => {
			counts.set( tag, ( counts.get( tag ) || 0 ) + 1 );
		} );
	} );

	return [ ...counts.entries() ]
		.map( ( [ tag, count ] ) => ( { tag, count } ) )
		.sort( ( a, b ) => a.tag.localeCompare( b.tag ) );
};

/**
 * One page of a list, with the page clamped into range.
 *
 * Clamping rather than resetting is what makes a page survive its own list:
 * deleting the last card on the last page leaves the reader on that page, not
 * on an empty screen or back at the first one.
 *
 * @param {Array}  list    List to slice.
 * @param {number} page    1-based page number.
 * @param {number} perPage Cards per page.
 * @return {{page: number, pageCount: number, items: Array, from: number, to: number, total: number}} The page and its numbering.
 */
export const paginate = (
	list = [],
	page = 1,
	perPage = LIBRARY_PAGE_SIZE
) => {
	const size = Math.max( 1, perPage );
	const total = list.length;
	const pageCount = Math.max( 1, Math.ceil( total / size ) );
	const current = Math.min(
		Math.max( 1, Math.floor( page ) || 1 ),
		pageCount
	);
	const start = ( current - 1 ) * size;

	return {
		page: current,
		pageCount,
		items: list.slice( start, start + size ),
		from: total ? start + 1 : 0,
		to: Math.min( start + size, total ),
		total,
	};
};

/**
 * Options for an asset `SelectControl`, with a "none" entry first.
 *
 * @param {Array} assets Normalised asset list.
 * @return {Array<{label: string, value: string}>} Options, None first.
 */
export const assetOptions = ( assets = [] ) => [
	{ label: __( '— None —', 'titlesparks' ), value: '' },
	...assets.map( ( asset ) => ( {
		label: asset.label || asset.id,
		value: asset.id,
	} ) ),
];

/**
 * Asset filter tabs.
 */
export const KINDS = [
	{ label: __( 'All', 'titlesparks' ), value: 'all' },
	{ label: __( 'GIFs', 'titlesparks' ), value: 'gif' },
	{ label: __( 'Icons', 'titlesparks' ), value: 'icon' },
	{ label: __( 'Images', 'titlesparks' ), value: 'image' },
];

/**
 * Classify an asset by its file extension.
 *
 * GIFs, SVG/PNG icons and other images are filtered separately in the library
 * UI, matching the way authors describe their assets.
 *
 * @param {Object} asset Normalised asset.
 * @return {string} gif, icon or image.
 */
export const assetKind = ( asset ) => {
	const url = String( ( asset && asset.url ) || '' )
		.split( '?' )[ 0 ]
		.toLowerCase();

	if ( url.endsWith( '.gif' ) ) {
		return 'gif';
	}

	if ( url.endsWith( '.svg' ) || url.endsWith( '.png' ) ) {
		return 'icon';
	}

	return 'image';
};

/**
 * Human readable file type label, e.g. GIF or PNG.
 *
 * @param {Object} asset Normalised asset.
 * @return {string} The extension, upper case, or IMAGE.
 */
export const assetTypeLabel = ( asset ) => {
	const url = String( ( asset && asset.url ) || '' )
		.split( '?' )[ 0 ]
		.toLowerCase();
	const match = url.match( /\.([a-z0-9]+)$/ );

	return match ? match[ 1 ].toUpperCase() : 'IMAGE';
};

/**
 * Filter assets by folder, kind and a free text query.
 *
 * The three narrow each other, in that order: folder first, because that is the
 * choice the reader just made, then the file type, then the words they typed.
 * A query also matches a tag, so "news" finds the icons tagged for the News
 * folder even when the word is nowhere in their label.
 *
 * @param {Array}  assets Normalised assets.
 * @param {string} kind   Kind value from KINDS.
 * @param {string} query  Search text.
 * @param {Object} folder Normalised folder to narrow to, or null for all.
 * @return {Array} The assets matching all three.
 */
export const filterAssets = (
	assets = [],
	kind = 'all',
	query = '',
	folder = null
) => {
	const needle = query.trim().toLowerCase();

	return assetsInFolder( assets, folder ).filter( ( asset ) => {
		if ( 'all' !== kind && assetKind( asset ) !== kind ) {
			return false;
		}

		if ( ! needle ) {
			return true;
		}

		return (
			String( asset.label || '' )
				.toLowerCase()
				.includes( needle ) ||
			String( asset.url || '' )
				.toLowerCase()
				.includes( needle ) ||
			( asset.tags || [] ).some( ( tag ) => tag.includes( needle ) )
		);
	} );
};

/**
 * Parse a stored timeline value (JSON string or object) into a timeline.
 *
 * @param {*} value Raw meta value.
 * @return {Object|null} Null when there is nothing usable to parse.
 */
export const parseTimeline = ( value ) => {
	if ( value && typeof value === 'object' ) {
		return emptyTimeline( value );
	}

	if ( typeof value !== 'string' || ! value.trim() ) {
		return null;
	}

	try {
		const parsed = JSON.parse( value );

		return parsed && typeof parsed === 'object'
			? emptyTimeline( parsed )
			: null;
	} catch {
		return null;
	}
};

/**
 * Serialise a timeline for storage in the string meta field.
 *
 * @param {Object} timeline Timeline.
 * @return {string} JSON string.
 */
export const serializeTimeline = ( timeline ) =>
	JSON.stringify( emptyTimeline( timeline ) );

/**
 * Read a timeline out of the post meta being edited.
 *
 * The post meta is the source of truth; the server-inlined `boot.timeline`
 * only supplies defaults for a post that has never been configured. The meta
 * key comes from the bootstrap so a rename on the PHP side needs no JS change.
 *
 * @param {Object} meta Post meta object from the editor store.
 * @param {Object} boot Editor bootstrap data.
 * @return {Object} Complete timeline.
 */
export const readTimelineFromMeta = ( meta, boot = {} ) => {
	const key = boot.metaKey || META_KEY_FALLBACK;

	return readTimelineFromJson( meta && meta[ key ], boot );
};

/**
 * Read a timeline out of the raw meta field value.
 *
 * Takes the field value itself rather than the meta object so a store
 * subscription can select a primitive: a selector that returns the meta object
 * is at the mercy of the store's equality check, and a component downstream of
 * one can silently stop updating. A string always compares correctly.
 *
 * @param {*}      value Raw meta field value (JSON string, object or nothing).
 * @param {Object} boot  Editor bootstrap data.
 * @return {Object} Complete timeline.
 */
export const readTimelineFromJson = ( value, boot = {} ) =>
	parseTimeline( value ) ||
	emptyTimeline( boot.timeline || boot.defaults || {} );

/**
 * Format a moment, given in site-clock seconds, for display.
 *
 * Site-clock seconds are wall clock values wearing a UTC label, so the fields
 * are read back in UTC. Formatting with the browser's own zone instead would
 * print a different clock — and, near midnight, a different day — than the one
 * the site runs on.
 *
 * @param {number} seconds Site-clock seconds.
 * @return {string} e.g. "Jan 1, 2026, 09:30".
 */
export const formatSiteMoment = ( seconds ) =>
	new Date( seconds * 1000 ).toLocaleString( undefined, {
		timeZone: 'UTC',
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	} );

/**
 * The date and time window a stage occupies, for the editor preview.
 *
 * The times are printed on the site clock, so they match what an author typed
 * into the end picker. Returns an empty string when the anchor is missing or
 * invalid, which is how a fresh post with no date yet renders.
 *
 * @param {Object} timeline   Timeline.
 * @param {number} index      Stage index (1-3).
 * @param {string} anchorDate Anchor (`Y-m-d H:i:s`) the timeline falls back to.
 * @return {string} e.g. "Jan 1, 2026, 00:00 → Jan 2, 2026, 00:00".
 */
export const formatStageWindow = ( timeline, index, anchorDate ) => {
	// A timeline that carries its own anchor wins, exactly as the decay maths
	// does it — so the window shown is the window the front end will use.
	const anchor = siteTimeToSeconds( timeline.anchor || anchorDate );

	if ( anchor === null ) {
		return '';
	}

	let start = anchor;

	for ( let step = 1; step < index; step++ ) {
		start += stageSeconds( timeline[ `stage_${ step }` ] );
	}

	const length = stageSeconds( timeline[ `stage_${ index }` ] );

	if ( length <= 0 ) {
		return __(
			'No icon: this stage ends when the stage before it does.',
			'titlesparks'
		);
	}

	return sprintf(
		/* translators: 1: stage start date and time, 2: stage end date and time. */
		__( '%1$s → %2$s', 'titlesparks' ),
		formatSiteMoment( start ),
		formatSiteMoment( start + length )
	);
};

/**
 * Convert a site-local datetime string to seconds.
 *
 * The stored anchor and the post date are "Y-m-d H:i:s" on the *site* clock
 * with no offset. Parsing such a string as UTC turns it into a stable
 * pseudo-timestamp: only differences against the server-provided "now" are
 * ever used, so the browser's own timezone can never shift the result.
 *
 * @param {string} value Site-local datetime, e.g. "2026-01-01 09:30:00".
 * @return {number|null} Seconds, or null when the value is unusable.
 */
export const siteTimeToSeconds = ( value ) => {
	if ( ! value ) {
		return null;
	}

	const normalized = String( value ).trim().replace( ' ', 'T' );

	if ( ! normalized ) {
		return null;
	}

	const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test( normalized );
	const ms = Date.parse( hasZone ? normalized : `${ normalized }Z` );

	return Number.isFinite( ms ) ? Math.floor( ms / 1000 ) : null;
};

/**
 * Newest stage that actually has an icon selected.
 *
 * Mirrors `Title_Sparks\Decay::last_configured_stage()`: an empty `asset_id`
 * means the author never configured that slot, which is not the same thing as
 * choosing to show no icon.
 *
 * @param {Object} timeline Timeline.
 * @return {number} Stage number (1-3), or 0 when no stage has an icon.
 */
export const lastConfiguredStage = ( timeline ) => {
	const normalised = emptyTimeline( timeline );

	for ( let position = STAGE_INDEXES.length - 1; position >= 0; position-- ) {
		const index = STAGE_INDEXES[ position ];

		if ( normalised[ `stage_${ index }` ].asset_id ) {
			return index;
		}
	}

	return 0;
};

/**
 * Compute which stage is active at a moment in time.
 *
 * A JavaScript mirror of `Title_Sparks\Decay::resolve()`; the two must agree so
 * the editor preview shows the same stage the front end will render.
 *
 * @param {Object} timeline   Timeline.
 * @param {string} anchorDate Post date (`Y-m-d H:i:s`, site time).
 * @param {number} [now]      "Now" in site-clock seconds; defaults to the browser clock.
 * @return {{stage: number, expired: boolean, anchor: number, elapsed: number, endsAt: number, remaining: number}} The stage on screen and its timing.
 */
export const resolveTimeline = ( timeline, anchorDate, now = 0 ) => {
	const normalised = emptyTimeline( timeline );
	const anchor = siteTimeToSeconds( normalised.anchor || anchorDate );

	const result = {
		stage: 0,
		expired: true,
		anchor: anchor || 0,
		elapsed: 0,
		endsAt: anchor || 0,
		remaining: 0,
	};

	if ( ! anchor ) {
		return result;
	}

	const current =
		Number.isFinite( now ) && now > 0
			? now
			: Math.floor( Date.now() / 1000 );
	const elapsed = Math.max( 0, current - anchor );

	result.elapsed = elapsed;

	let cursor = anchor;

	for ( const index of STAGE_INDEXES ) {
		const seconds = stageSeconds( normalised[ `stage_${ index }` ] );
		const endsAt = cursor + seconds;

		// A zero-length stage is skipped rather than shown for an instant; this
		// is how an author disables a middle stage.
		if ( seconds > 0 && elapsed < endsAt - anchor ) {
			result.stage = index;
			result.expired = false;
			result.endsAt = endsAt;
			result.remaining = Math.max( 0, endsAt - current );

			return result;
		}

		cursor = endsAt;
	}

	// Every stage has elapsed. `keep` has to keep an icon that was actually
	// picked, so it falls back to the newest configured stage.
	if ( 'keep' === normalised.stage_3_behaviour ) {
		const kept = lastConfiguredStage( normalised );

		if ( kept > 0 ) {
			result.stage = kept;
			result.endsAt = cursor;
		}
	}

	return result;
};

/**
 * Work out the icon the canvas should be showing.
 *
 * The timeline-resolved stage is the only stage the canvas may display. Editing
 * a future stage changes its saved settings, but cannot make that stage live
 * before its scheduled time. Keeping this derivation pure lets the editor
 * preview be checked without a browser or WordPress runtime.
 *
 * @param {Object}  input           Input to resolve.
 * @param {Object}  input.timeline  Normalised timeline.
 * @param {Array}   input.assets    Normalised library assets.
 * @param {Object}  input.resolved  `resolveTimeline()` result.
 * @param {boolean} input.isEnabled Whether the plugin is on site-wide.
 * @return {Object} Current icon state, including sizing parameters.
 */
export const resolveTitleIcon = ( {
	timeline,
	assets = [],
	resolved,
	isEnabled,
} ) => {
	const index = resolved.stage;
	const stage =
		index > 0 ? emptyStage( timeline[ `stage_${ index }` ] ) : null;
	const asset =
		stage && stage.asset_id
			? assets.find( ( item ) => item.id === stage.asset_id )
			: null;
	const show = Boolean(
		isEnabled && timeline.enabled && stage && asset && asset.url
	);

	return {
		show,
		stage: show ? index : 0,
		position: stage ? stage.position : 'left',
		url: asset ? asset.url : '',
		size: stage || asset ? iconSize( stage, asset ) : '',
		sizeMode: stage ? stage.size_mode : 'fixed',
		flip: stage ? Boolean( stage.flip ) : false,
		// The stage's own bands, falling back to the site's table in the
		// canvas: the two together are how a title-following icon is sized.
		sizingRules: stage ? stage.sizing_rules : [],
		fixedSize:
			stage || asset
				? sanitizeCssSize( stage && stage.size ) ||
					sanitizeCssSize( asset && asset.size ) ||
					DEFAULT_ICON_SIZE
				: '',
		label: asset ? asset.label || asset.url : '',
	};
};

/**
 * "Now" on the site clock, as seconds.
 *
 * `boot.now` is inlined by the server as a true UTC instant (`time()`, not the
 * site-shifted value the server used to send), and `boot.nowOffset` is the site
 * clock's offset from UTC. The two are added back together because every value
 * this is compared against — the anchor and the post date — is a site-local
 * string parsed as if it were UTC, the trick `siteTimeToSeconds()` explains.
 * The sum is therefore on the same clock as the anchor, which is what keeps the
 * stage the editor shows the stage the page will render.
 *
 * `driftMs` is the browser time that has passed since that snapshot, so the
 * value keeps advancing while the editor stays open. Without a server value it
 * falls back to the browser clock expressed in the same site-local format.
 *
 * @param {Object} boot    Editor bootstrap data.
 * @param {number} driftMs Milliseconds since the bootstrap was read.
 * @return {number} Seconds.
 */
export const siteNowSeconds = ( boot = {}, driftMs = 0 ) => {
	const base = Number( boot && boot.now );
	const offset = Number( boot && boot.nowOffset );

	if ( Number.isFinite( base ) && base > 0 ) {
		return Math.floor(
			base + ( Number.isFinite( offset ) ? offset : 0 ) + driftMs / 1000
		);
	}

	const date = new Date();
	const pad = ( value ) => String( value ).padStart( 2, '0' );
	const local = `${ date.getFullYear() }-${ pad( date.getMonth() + 1 ) }-${ pad(
		date.getDate()
	) } ${ pad( date.getHours() ) }:${ pad( date.getMinutes() ) }:${ pad(
		date.getSeconds()
	) }`;

	return siteTimeToSeconds( local ) || Math.floor( Date.now() / 1000 );
};

/**
 * The moment the editor counts a timeline from.
 *
 * The server inlines the anchor this post actually resolves from: its own
 * saved anchor when it has one, otherwise the date the site settings start
 * timelines on. The post date is the last fallback, for a bootstrap written
 * before that setting existed.
 *
 * @param {Object} boot Editor bootstrap data.
 * @return {string} `Y-m-d H:i:s` in site time, or an empty string.
 */
export const editorAnchor = ( boot = {} ) =>
	( boot && ( boot.anchor || boot.postDate ) ) || '';
