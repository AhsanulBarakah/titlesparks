/**
 * DOM plumbing for the live icon beside the editor canvas title.
 *
 * WordPress gives no slot to render into the post title, so the icon is
 * injected next to it. The structure targeted is:
 *
 *   <div class="editor-visual-editor__post-title-wrapper" contenteditable="false">
 *     <h1 class="… editor-post-title editor-post-title__input" contenteditable="true">…</h1>
 *   </div>
 *
 * Inserting as a *sibling* of the heading is what makes this safe: the wrapper
 * is `contenteditable="false"`, so the icon can never become part of the saved
 * title text. The heading is `contenteditable="true"`, and anything inside it
 * is written into the title the next time the author types — so a DOM child of
 * the heading is not an option here, however much it would simplify the
 * placement. The wrapper is the next best thing, and the closest box to the
 * heading's own: WordPress' wrapper holds nothing but the title, so the box the
 * icon is placed against here is the box the front end places against too.
 *
 * The icon is then taken out of flow with `position: absolute` so it is drawn
 * over the title without moving it. Anything that puts the icon *in* the flow —
 * floats, flex, grid — reserves space for it and so pushes the title sideways,
 * and this is a preview of a title the author is still editing, so the title
 * must not move.
 *
 * The position is computed from the heading's own *text* rather than from the
 * wrapper's edge or the heading's box: the editor's constrained layout gives
 * the heading a max-width and centring auto margins, and a short title fills
 * only a part of that box, so only the text itself puts the icon next to the
 * words.
 *
 * Deliberately free of React and `@wordpress/*` imports: these rules have to
 * match WordPress' DOM, so they are kept testable in isolation.
 */

/**
 * The editor canvas is an iframe on modern WordPress, so the title lives in a
 * different document. Older setups render it in the admin document itself.
 */
export const CANVAS_IFRAME = 'iframe[name="editor-canvas"]';

/**
 * The heading WordPress renders the post title into.
 */
export const TITLE_INPUT = '.editor-post-title__input';

/**
 * WordPress' dedicated post title wrapper.
 */
const WRAPPER_CLASS = 'editor-visual-editor__post-title-wrapper';

/**
 * Marks the node this plugin injected, and doubles as the "already correct"
 * check so re-running never flickers the icon.
 */
export const ICON_ATTR = 'data-titlesparks-editor-icon';

/**
 * Class put on the title wrapper so it becomes the positioning context for the
 * absolutely positioned icon.
 *
 * The wrapper, not the heading: the icon is a DOM sibling of the heading, so the
 * heading cannot be its containing block however it is positioned — only an
 * ancestor can, and the icon has none between it and the wrapper.
 */
export const HOST_CLASS = 'titlesparks-title-icon-host';

/**
 * The stylesheet injected into whichever document holds the title.
 */
export const STYLE_ID = 'titlesparks-editor-title-css';

/**
 * Gap between the icon and the title, as a fraction of the title's own font
 * size.
 *
 * A fixed number of pixels cannot hold: themes scale headings with the
 * viewport, so the same title is far larger in a wide window than in the
 * editor's canvas, and a fixed gap goes *proportionally* smaller the bigger the
 * title gets. That reads as the icon crowding the words at the default zoom,
 * sitting comfortably at 175%, and looking different again in the editor —
 * three answers to one setting. A font-relative gap is the same space in all of
 * them, which is the only version an author can judge by eye once.
 */
export const ICON_GAP_EM = 0.15;

/**
 * Gap between the icon and the title, in pixels.
 *
 * The reference gap: what `ICON_GAP_EM` works out to at the size this was
 * designed at, and the fallback for a caller with no font size to hand.
 */
export const ICON_GAP = 6;

/**
 * What the icon's vertical position is measured against.
 *
 * - `first_line` keeps the icon on the title's first line. The author put it
 *   there, and a title that becomes two or three lines — a narrower column, a
 *   smaller screen, a longer headline — must not drag it down to the middle of
 *   the paragraph.
 * - `last_line` does the same on the bottom line, for an icon that belongs at
 *   the end of the words rather than their start.
 * - `block` centres it on all of the title's lines, which is the older rule and
 *   is kept as a choice for sites that liked it.
 *
 * Mirrors `Security::allowed_icon_anchors()` on the PHP side.
 */
export const ICON_ANCHORS = [ 'first_line', 'last_line', 'block' ];

/**
 * The anchor an untouched site uses: the first line, which is where the author
 * dropped the icon.
 */
export const ICON_ANCHOR_DEFAULT = 'first_line';

/**
 * Normalise a stored anchor choice.
 *
 * @param {string} value Stored value.
 * @return {string} `first_line`, `last_line` or `block`.
 */
export const resolveIconAnchor = ( value ) =>
	ICON_ANCHORS.includes( value ) ? value : ICON_ANCHOR_DEFAULT;

/**
 * Smallest clearance left between an icon and its title after an inward nudge.
 */
export const ICON_MIN_CLEARANCE = 2;

/**
 * The icon box a side placement is anchored on, in pixels.
 *
 * The icon hangs from its *middle* rather than from its inner edge, so a size
 * change does not push the picture outwards by half of every increase: the
 * point one gap plus half this box from the title's text is where the middle
 * stays.
 *
 * The middle is only held while the icon fits between that point and the words;
 * a wider one would grow *towards* the title and cover the end of it (measured
 * on a real post: 11.6px in the canvas, 15.2px on the page). So past this box
 * the icon is held at the gap instead and grows away from the title, and the
 * two rules meet without a jump at exactly this size. Either way the vertical
 * middle is exact (`top` plus `translateY(-50%)`), and no size ever draws the
 * icon over the words.
 *
 * 20px is the library's fallback icon size, so an icon at or below it keeps a
 * middle that does not move.
 */
export const ICON_ANCHOR_SIZE = 20;

/**
 * How far to move an icon away from the title on a side placement, in pixels.
 *
 * An icon no wider than the anchor box is narrowed about its middle, so its
 * near edge backs off as it shrinks and the middle does not move. A wider icon
 * is held at the gap (a shift of 0) and grows outwards, so it can never cover
 * the title. Pure, so the rule and the editor previews share it.
 *
 * @param {number} iconWidth Icon width in pixels.
 * @return {number} Distance to add to the near edge, in pixels.
 */
export const iconAnchorShift = ( iconWidth ) =>
	Math.max(
		0,
		( ICON_ANCHOR_SIZE - ( Number.parseFloat( iconWidth ) || 0 ) ) / 2
	);

/**
 * The same correction as CSS text, for the previews drawn from a CSS length.
 *
 * A preview knows its icon's width as a length (`20px`, `3rem`, a `clamp()`),
 * not as a number, so its margin is corrected in the browser. Written as a
 * multiplication by 0.5 rather than a division, which older engines accept
 * inside `calc()`, and floored at 0 so a large preview icon keeps its gap.
 *
 * @param {string|number} size Icon width as a CSS length.
 * @return {string} ` + max(0px, (20px - size) * 0.5)`, or `''` at the anchor size.
 */
export const iconAnchorShiftCss = ( size ) => {
	const text =
		'number' === typeof size ? `${ size }px` : String( size || '' ).trim();

	if ( ! text || `${ ICON_ANCHOR_SIZE }px` === text ) {
		return '';
	}

	return ` + max(0px, (${ ICON_ANCHOR_SIZE }px - ${ text }) * 0.5)`;
};

/**
 * The gap for a title, given its font size.
 *
 * Pure, so the fraction can be checked without a browser.
 *
 * The same fraction at every size, with no pixel floor. A floor is not a
 * safety net for the fraction, it is a different rule for small titles: at a
 * 15px widget title 4px is a quarter of the letters, where the fraction asks
 * for 2.25px, so the copies on a page spaced their icons inconsistently and
 * the small ones looked pushed away from their words. Only a title with no
 * measurable size falls back to `ICON_GAP`.
 *
 * @param {string|number} fontSize Computed font size, in pixels.
 * @return {number} Gap in pixels.
 */
export const iconGap = ( fontSize ) => {
	const size = Number.parseFloat( fontSize );

	if ( ! Number.isFinite( size ) || size <= 0 ) {
		return ICON_GAP;
	}

	return size * ICON_GAP_EM;
};

/**
 * Measure the natural gap between an inline icon and adjacent title text.
 *
 * Inline widget icons stay in text flow. Their natural gap comes from the
 * stylesheet and surrounding typography, so use actual client rects rather
 * than estimating it from a title font size.
 *
 * @param {Element} icon     Inline icon.
 * @param {Element} title    Text element containing the icon.
 * @param {string}  position `left` or `right`.
 * @return {number} Pixels between the icon and its nearest text.
 */
export const offsetGap = ( icon, title, position ) => {
	if ( ! title.ownerDocument.createRange ) {
		return 0;
	}

	const range = title.ownerDocument.createRange();

	range.selectNodeContents( title );

	if ( 'left' === position ) {
		range.setStartAfter( icon );
	} else {
		range.setEndBefore( icon );
	}

	const textRects = [ ...range.getClientRects() ].filter(
		( rect ) => rect.width > 0 && rect.height > 0
	);

	if ( ! textRects.length ) {
		return 0;
	}

	const iconRect = icon.getBoundingClientRect();
	const textEdge =
		'left' === position
			? Math.min( ...textRects.map( ( rect ) => rect.left ) )
			: Math.max( ...textRects.map( ( rect ) => rect.right ) );

	return 'left' === position
		? textEdge - iconRect.right
		: iconRect.left - textEdge;
};

/**
 * Limit an inward horizontal nudge on an inline widget icon.
 *
 * Inline widget icons stay in the title's own text flow, so the space beside
 * the words is the stylesheet's margin and only the horizontal axis can cover
 * them. That direction is clamped in rendered pixels first and converted back
 * to the stored scale so every caller uses the same exact geometry. The
 * vertical axis is a free slide.
 *
 * Absolutely positioned post-title icons do not use this: they follow both
 * numbers as written, in either direction, on every position.
 *
 * @param {string}        position    Position keyword.
 * @param {Object}        offsets     `{ offsetX, offsetY }` in stored pixels.
 * @param {string|number} fontSize    Title font size in pixels.
 * @param {number}        minimumGap  Optional clearance to preserve, in pixels.
 * @param {number}        measuredGap Optional browser-measured gap before the nudge.
 * @param {string|number} iconGrowth  How much the icon grew, when the clamp has to
 *                                    agree with a growth-limited nudge.
 * @return {Object} Safe stored-pixel offsets.
 */
export const offsetsWithMinimumGap = (
	position,
	offsets = {},
	fontSize,
	minimumGap = null,
	measuredGap,
	iconGrowth = null
) => {
	const axes = AXES[ position ] || AXES.left;
	const requested = Number.parseFloat( minimumGap );
	const pixels = Number.parseFloat( fontSize );
	if (
		! Number.isFinite( pixels ) ||
		pixels <= 0 ||
		! Number.isFinite( requested ) ||
		requested < 0
	) {
		return {
			offsetX: offsets.offsetX || 0,
			offsetY: offsets.offsetY || 0,
		};
	}

	const startingGap = Number.isFinite( measuredGap )
		? measuredGap
		: iconGap( pixels );
	// A clearance keeps the icon off the words; it is not meant to forbid the
	// nudge. On a title small enough that the gap itself is under the requested
	// clearance — the gap is 1.5px at 10px, where the clearance is 2 — the room
	// used to come out as zero, so an inline icon beside a very small heading
	// could not be moved towards its text at all while every larger title
	// could. Half the gap is always left: the nudge keeps working, and what is
	// left is still clear of the letters.
	const clearance = Math.min( requested, startingGap / 2 );
	const inwardRoom = Math.max( 0, startingGap - clearance );
	// The sign that points towards the title on the horizontal axis. A
	// corner is held clear vertically, so its side axis slides freely; a plain
	// side keeps the horizontal clearance. The vertical axis is never clamped.
	let inwardX = 0;

	if ( ! axes.edge ) {
		if ( 'left' === axes.side ) {
			inwardX = 1;
		} else if ( 'right' === axes.side ) {
			inwardX = -1;
		}
	}
	const limitX = ( value ) => {
		if ( ! inwardX ) {
			return value || 0;
		}

		const scaled = scaleOffset( value || 0, pixels, iconGrowth );

		if ( scaled * inwardX > inwardRoom ) {
			// The inverse of `scaleOffset`, in this title's own scale: the last
			// stored value whose rendered nudge still leaves `clearance`.
			return ( inwardRoom * inwardX ) / offsetScale( pixels, iconGrowth );
		}

		return value || 0;
	};

	return {
		offsetX: limitX( offsets.offsetX ),
		offsetY: offsets.offsetY || 0,
	};
};

/**
 * Position keywords broken into the axes they place the icon on.
 *
 * `side` puts the icon in the margin beside the title text; `edge` puts it
 * against the top or bottom of the text. A plain `top` or `bottom` uses only
 * an edge, and a plain `left` or `right` only a side — the four corners use
 * both, which is what places the icon outside the text on the diagonal.
 */
const AXES = {
	left: { side: 'left' },
	right: { side: 'right' },
	top: { edge: 'top' },
	bottom: { edge: 'bottom' },
	'left-top': { side: 'left', edge: 'top' },
	'left-bottom': { side: 'left', edge: 'bottom' },
	'right-top': { side: 'right', edge: 'top' },
	'right-bottom': { side: 'right', edge: 'bottom' },
};

/**
 * The title size the author's offset is written at, in pixels.
 *
 * The two offset fields are typed while looking at the editor's canvas, and
 * WordPress gives the post title there 2rem — 32px. That is the size the number
 * means something at, and the size the canvas still draws it at, so what the
 * author sees while nudging is what the field says.
 *
 * It is a reference rather than a fixed length because the author's nudge is a
 * distance *on the title*: it is spent covering the letters, and letters are
 * drawn at the size the theme asks for. The front end draws the same title at
 * a size of its own choosing — 36px on the theme this was measured on, and
 * smaller again on a phone — so a nudge left in raw pixels covers a different
 * part of the same letter at every one of those sizes. Measured on a real theme
 * with the author's own values (-33, -29): the editor's canvas and the front end
 * agreed exactly in the rule's own terms, yet the icon sat ~3px further off the
 * first letter on the page than in the canvas, which is what an author reports
 * as "a little bit of space".
 *
 * So the nudge is scaled by the title's own font size, exactly as the gap
 * already is (`iconGap`), and both sides call the same code — the canvas at its
 * size, the page at the theme's. A nudge tuned while watching the canvas then
 * lands on the page covering the same fraction of the same letters.
 *
 * The scale is the title's own fraction of 32px, so a nudge covers the same share
 * of the same letters at every size; only the top of the range is held, inside
 * `OFFSET_SCALE_MAX`, where a display headline grew the nudge until the icon
 * cleared a whole line. A small title is left exactly proportional: a copy drawn
 * at 15px puts the icon where the canvas puts it, at 15/32 of the number, which
 * is what makes the same post look the same in a card as on its own page.
 */
export const OFFSET_REFERENCE_PX = 32;

/**
 * The largest the nudge scale is allowed to go.
 *
 * A theme title at 60px is nearly twice the canvas, and the nudge grew with it
 * until the icon cleared a whole line. Past 1.4 the scale holds, so the icon
 * keeps roughly the relation to its text the author arranged, however large the
 * theme draws the title.
 */
export const OFFSET_SCALE_MAX = 1.4;

/**
 * How much the author's nudge is scaled at a title size.
 *
 * Exactly proportional, so a title of any size (the canvas's 32px, a 15px widget
 * title, a 42px page title) keeps the fraction of the text the author tuned, and
 * flat only at the top, where a very large headline would stretch the nudge
 * beyond recognition.
 *
 * `iconGrowth` is how much the icon itself grew from the size it is drawn at
 * beside the editor's 32px reference — see `positionIcon`, which measures it.
 * An adaptive icon that has reached its own minimum or maximum stops following
 * the title, and the nudge must stop with it: at a 40px title whose icon is
 * capped at 45px the icon no longer covers a larger share of the line, so a
 * nudge still at 1.25x would slowly leave the spot the author arranged. The
 * nudge takes whichever is smaller, the title's growth or the icon's, and a
 * fixed-size icon (no growth to measure) keeps following the title, which is
 * what the letter-covering nudge intends. An adaptive icon that shrank follows
 * the picture it shrank with, and that answer is then held under the ceiling.
 *
 * Pure, and `1` when there is no size to read, which leaves the number as the
 * author wrote it.
 *
 * @param {string|number}      fontSize     Computed font size of the title, in pixels.
 * @param {string|number|null} [iconGrowth] How much the icon grew, when known.
 * @return {number} Scale to apply to both offset fields.
 */
export const offsetScale = ( fontSize, iconGrowth = null ) => {
	const size = Number.parseFloat( fontSize );

	if ( ! Number.isFinite( size ) || size <= 0 ) {
		return 1;
	}

	const textScale = size / OFFSET_REFERENCE_PX;
	const growth = Number.parseFloat( iconGrowth );
	const scale =
		Number.isFinite( growth ) && growth > 0
			? Math.min( textScale, growth )
			: textScale;

	return Math.min( OFFSET_SCALE_MAX, scale );
};

/**
 * One axis of the author's nudge, at the title size being drawn.
 *
 * Pure, so the scaling can be checked without a browser, and callers that have
 * no font size to hand (a stale page's markup, a size that cannot be measured)
 * still get a usable number rather than zero.
 *
 * @param {string|number}      value        Offset in pixels, as the author wrote it.
 * @param {string|number}      fontSize     Computed font size of the title, in pixels.
 * @param {string|number|null} [iconGrowth] How much the icon grew, when known.
 * @return {number} Offset in pixels at that font size.
 */
export const scaleOffset = ( value, fontSize, iconGrowth = null ) => {
	const pixels = Number.parseFloat( value );

	if ( ! Number.isFinite( pixels ) ) {
		return 0;
	}

	return pixels * offsetScale( fontSize, iconGrowth );
};

/**
 * An icon's width under its title-size bands.
 *
 * A title-following icon is sized from a table the site (or one stage) writes:
 * each band names the icon size at one title size, and that row stays in force
 * from its own title size up to the next row. Rows of 32/32 and 40/45 therefore
 * draw a 32px icon beside every title from 32px to 39.99px and a 45px one from
 * 40px up, which is what an author writing six rows means: the icon takes a
 * size that was typed into the table and never a number that was not.
 *
 * Outside the table the nearest row holds: a title smaller than the first row
 * draws its icon, and one larger than the last row draws the last row's, so the
 * last row also covers every title above it.
 *
 * Bands arrive sorted by font size from the server; this reads them in one pass
 * and does not assume it, so a table from a stale page still answers. A row
 * with no usable size is skipped rather than trusted as a zero.
 *
 * @param {Array}         rules    `{ font, icon }` pairs in pixels.
 * @param {string|number} fontSize Title size the icon is drawn beside.
 * @return {number|null} Width in pixels, or null when no band can be used.
 */
export const advancedIconWidth = ( rules, fontSize ) => {
	const font = Number.parseFloat( fontSize );

	if ( ! Array.isArray( rules ) || ! Number.isFinite( font ) || font <= 0 ) {
		return null;
	}

	let smallest = null;
	let atOrBelow = null;

	for ( const rule of rules ) {
		const at = Number.parseFloat( rule && rule.font );
		const icon = Number.parseFloat( rule && rule.icon );

		if (
			! Number.isFinite( at ) ||
			! Number.isFinite( icon ) ||
			icon <= 0
		) {
			continue;
		}

		if ( null === smallest || at < smallest.font ) {
			smallest = { font: at, icon };
		}

		// The row in force is the last one at or under the title's size; `>=`
		// lets a later row win a repeated size, which is how the stored table
		// resolves one.
		if ( at <= font && ( null === atOrBelow || at >= atOrBelow.font ) ) {
			atOrBelow = { font: at, icon };
		}
	}

	if ( null === smallest ) {
		return null;
	}

	return ( atOrBelow || smallest ).icon;
};

/**
 * Whether the icon comes before the title text.
 *
 * The horizontal axis decides, so the icon reads in the same order as the text
 * it belongs to — an icon above or below a title starts at its beginning.
 * Shared by the editor, which inserts the icon before or after the heading, and
 * the front end, which inserts it before or after the text inside the title, so
 * the two cannot disagree about which side the icon belongs on.
 *
 * @param {string} position Sanitized position keyword.
 * @return {boolean} True when the icon precedes the title.
 */
export const iconComesFirst = ( position ) =>
	'left' === position ||
	( typeof position === 'string' && position.startsWith( 'left-' ) ) ||
	'top' === position;

/**
 * Stylesheet for the injected icon.
 *
 * The icon's own box is left to the theme; only the image is sized from the
 * icon element, and only the title wrapper becomes a positioning context.
 *
 * The image is a block so the icon element is exactly the picture. An inline
 * image sits on a text baseline, which makes its parent taller than the image
 * by the line's descent; placement anchors the icon element, so that extra
 * height would lift the picture by the same amount and the canvas would show
 * a different offset from the enlarged preview.
 *
 * @return {string} CSS text.
 */
const iconCss = () => `
.${ HOST_CLASS } {
	position: relative;
}

.titlesparks-title-icon img {
	width: 100%;
	height: auto;
	display: block;
}

.titlesparks-title-icon--flipped img {
	transform: scaleX(-1);
}
`;

/**
 * Every document the title could be rendered into.
 *
 * @return {Array<Document>} Candidate documents, admin document first.
 */
export const canvasDocuments = () => {
	const documents = new Set( [ document ] );
	const iframe = document.querySelector( CANVAS_IFRAME );

	if ( iframe && iframe.contentDocument ) {
		documents.add( iframe.contentDocument );
	}

	return [ ...documents ];
};

/**
 * Locate the title currently rendered in the editor.
 *
 * @return {{doc: Document, title: Element, wrapper: Element}|null} Target, or
 *                                                                 null when the
 *                                                                 title is not
 *                                                                 on screen.
 */
export const editorTitleTarget = () => {
	for ( const doc of canvasDocuments() ) {
		const title = doc.querySelector( TITLE_INPUT );

		if ( ! title ) {
			continue;
		}

		const wrapper = titleWrapper( title );

		if ( wrapper ) {
			return { doc, title, wrapper };
		}
	}

	return null;
};

/**
 * Inject the stylesheet, once per document.
 *
 * The canvas iframe does not receive the plugin's admin stylesheet, so the
 * rules have to be written into whichever document holds the title.
 *
 * @param {Document} doc Document owning the title.
 * @return {void}
 */
export const ensureEditorStyles = ( doc ) => {
	if ( doc.getElementById( STYLE_ID ) ) {
		return;
	}

	const style = doc.createElement( 'style' );
	style.id = STYLE_ID;
	style.textContent = iconCss();
	( doc.head || doc.documentElement ).appendChild( style );
};

/**
 * The container the icon is inserted into, and the box it is placed against.
 *
 * Only WordPress' own post title wrapper, or a container holding nothing but
 * the title, qualifies. That guard keeps the plugin from ever touching a shared
 * layout container (and so from disturbing the rest of the editor).
 *
 * @param {Element} title The post title heading.
 * @return {Element|null} The wrapper, or null when it is not safe to use.
 */
export const titleWrapper = ( title ) => {
	const parent = title.parentNode;

	if ( ! parent || 1 !== parent.nodeType ) {
		return null;
	}

	if ( parent.classList.contains( WRAPPER_CLASS ) ) {
		return parent;
	}

	const others = [ ...parent.children ].filter(
		( element ) => element !== title && ! element.hasAttribute( ICON_ATTR )
	);

	return 0 === others.length ? parent : null;
};

/**
 * Top-left corner of the wrapper's padding box, in viewport coordinates.
 *
 * An absolutely positioned child is laid out against the padding box of its
 * positioned ancestor, and element rects are reported against the border box,
 * so the border has to be taken off before the two can be mixed.
 *
 * @param {Window}  view    Window used for computed styles.
 * @param {Element} wrapper Title wrapper.
 * @return {{left: number, top: number}} Corner in viewport coordinates.
 */
const wrapperOrigin = ( view, wrapper ) => {
	const rect = wrapper.getBoundingClientRect();
	const computed = view.getComputedStyle( wrapper );

	return {
		left: rect.left + ( parseFloat( computed.borderLeftWidth ) || 0 ),
		top: rect.top + ( parseFloat( computed.borderTopWidth ) || 0 ),
	};
};

/**
 * The room the icon is placed in, as the wrapper's padding box.
 *
 * Measured from the element's own rect rather than read off `clientWidth` and
 * `clientHeight`, which are 0 on an inline element. That matters on the front
 * end, where the wrapper is the theme's own title element and a theme is free to
 * make it `display: inline`: the box would collapse to nothing on both axes, and
 * every placement anchored to a far edge — above, below, left, right — would
 * then be measured from nothing and put the icon at the wrong end of the title.
 * A block-level wrapper measures the same either way.
 *
 * The border comes off so this is the padding box: the box an absolutely
 * positioned child is laid out against, and the same box `wrapperOrigin`
 * reports the corner of.
 *
 * @param {Window}  view    Window used for computed styles.
 * @param {Element} wrapper Element the icon is positioned against.
 * @return {{width: number, height: number}} Padding box size, in pixels.
 */
const wrapperSize = ( view, wrapper ) => {
	const rect = wrapper.getBoundingClientRect();
	const computed = view.getComputedStyle( wrapper );
	const edge = ( property ) => parseFloat( computed[ property ] ) || 0;

	return {
		width: Math.max(
			0,
			rect.width - edge( 'borderLeftWidth' ) - edge( 'borderRightWidth' )
		),
		height: Math.max(
			0,
			rect.height - edge( 'borderTopWidth' ) - edge( 'borderBottomWidth' )
		),
	};
};

/**
 * Rectangle covering the title's *text*.
 *
 * The heading is a block, so its own box spans the full content width however
 * short the text is. Anchoring to that box would strand the icon at the edge of
 * an empty column — the further right the position, the further from the words.
 * A range over the contents measures the words themselves, so "right of title"
 * lands at the edge of the text.
 *
 * When the title wraps, the range's bounding box is the whole paragraph: left
 * and right are the widest line's edges, top and bottom the first and last
 * lines. The horizontal edges come from that one box, so a title that becomes
 * two or three lines keeps its icon at the same side of the text, and the
 * editor's wide single line and the theme's narrow column agree. The vertical
 * position is measured against `lineHeight` — the first line — unless the site
 * asked for the whole block.
 *
 * @param {Document} doc       Document owning the title.
 * @param {Element}  container Title element.
 * @param {Element}  skip      Icon element to leave out of the text.
 * @return {Object|null} Text bounding box, or null when there is no text.
 */
const textRect = ( doc, container, skip ) => {
	if ( ! doc.createRange ) {
		return null;
	}

	const range = doc.createRange();
	range.selectNodeContents( container );

	// On the front end the title and the icon share a host element, and the
	// icon is not part of the text: measuring across it would stretch the
	// box to the icon. The markup puts the icon first for a left corner and
	// last for a right one. In the editor the heading holds only text, so
	// this never applies.
	if ( skip && container.contains( skip ) ) {
		if ( skip.nextSibling ) {
			range.setStartAfter( skip );
		} else {
			range.setEndBefore( skip );
		}
	}

	const bounds = range.getBoundingClientRect();

	if ( ! bounds || ! bounds.width ) {
		return null;
	}

	// The first line's own height, from the per-line client rects. The union
	// above spans every line, so on a wrapped title part of it is below the
	// words the icon belongs to; anchoring to the first line needs the height
	// of that one line instead.
	const lines = (
		range.getClientRects ? [ ...range.getClientRects() ] : []
	).filter( ( rect ) => rect.width > 0 && rect.height > 0 );
	const firstTop = lines.length
		? Math.min( ...lines.map( ( rect ) => rect.top ) )
		: 0;
	const firstLine = lines.filter(
		( rect ) => Math.abs( rect.top - firstTop ) < 1
	);
	// The last line, for the anchor that counts from the end of the words.
	// Its offset is relative to the text box, so the caller can place the icon
	// without knowing where the box sits on the page.
	const lastTop = lines.length
		? Math.max( ...lines.map( ( rect ) => rect.top ) )
		: 0;
	const lastLine = lines.filter(
		( rect ) => Math.abs( rect.top - lastTop ) < 1
	);

	// Where the first line ends, so the words' own edges can be found: the
	// whitespace hanging at a soft wrap is a client rect of its own, and
	// measuring to it leaves the gap flush was meant to remove.
	const firstBottom = firstLine.length
		? Math.max( ...firstLine.map( ( rect ) => rect.bottom ) )
		: bounds.bottom;
	const words = lineWordEdges( doc, range, firstTop, firstBottom, lastTop );

	// The words' own edge wins when it could be measured, because the line's
	// rects may reach past it into a hung space. A title with no measurable
	// words falls back to the rects, and a line with no rects to its box.
	const lineEdge = ( wordEdge, rects, pick, fallback ) => {
		if ( 'number' === typeof wordEdge ) {
			return wordEdge;
		}

		return rects.length ? pick( rects ) : fallback;
	};

	// Copied into a plain object: a DOMRect keeps its numbers on the prototype,
	// so spreading one would drop them all.
	return {
		left: bounds.left,
		right: bounds.right,
		top: bounds.top,
		bottom: bounds.bottom,
		width: bounds.width,
		height: bounds.height,
		lineHeight: firstLine.length
			? Math.max( ...firstLine.map( ( rect ) => rect.height ) )
			: bounds.height,
		// How far each end of the title reaches, per line. The last line is
		// usually shorter than the box, and an icon anchored to it belongs
		// after the words on that line rather than after the longest line.
		firstLineLeft: lineEdge(
			words && words.firstLeft,
			firstLine,
			( rects ) => Math.min( ...rects.map( ( rect ) => rect.left ) ),
			bounds.left
		),
		firstLineRight: lineEdge(
			words && words.firstRight,
			firstLine,
			( rects ) => Math.max( ...rects.map( ( rect ) => rect.right ) ),
			bounds.right
		),
		lastLineLeft: lineEdge(
			words && words.lastLeft,
			lastLine,
			( rects ) => Math.min( ...rects.map( ( rect ) => rect.left ) ),
			bounds.left
		),
		lastLineRight: lineEdge(
			words && words.lastRight,
			lastLine,
			( rects ) => Math.max( ...rects.map( ( rect ) => rect.right ) ),
			bounds.right
		),
		lastLineHeight: lastLine.length
			? Math.max( ...lastLine.map( ( rect ) => rect.height ) )
			: bounds.height,
		lastLineTop: lastLine.length ? lastTop - bounds.top : 0,
	};
};

/**
 * The edges of a line's own words, without the whitespace a renderer leaves
 * hanging at a soft wrap.
 *
 * Chrome gives the space that ends a wrapped line its own client rect, so the
 * first line's box reaches a whole space past its last character. An icon that
 * was asked to sit flush against the words then stood 11px away from them — the
 * width of that space at a 40px title — which is the space the author was
 * trying to remove.
 *
 * A space typed in front of the title is the same problem on the other side:
 * a left icon was pushed out by one space. Leading and trailing whitespace is
 * dropped from the measured words too.
 *
 * Measured by character rather than by rect, because the rects cannot say which
 * part of the line is a space. Only the two positions a side icon can be
 * anchored to are worked out, and a title of one line with no space at either
 * end skips the work entirely.
 *
 * @param {Document} doc         Document owning the text.
 * @param {Range}    range       Range over the title's text.
 * @param {number}   firstTop    Top of the first line.
 * @param {number}   firstBottom Bottom of the first line.
 * @param {number}   lastTop     Top of the last line.
 * @return {Object|null} `{ firstLeft, firstRight, lastLeft, lastRight }`, or
 *                       null when the text cannot be measured by character.
 */
const lineWordEdges = ( doc, range, firstTop, firstBottom, lastTop ) => {
	const text = range.toString();
	const edgeSpace = /^\s|\s$/.test( text );
	const startContainer = range.startContainer;

	// One line, and no space at either end of it: the rects already end on a
	// character, so there is nothing to trim. A range that cannot name its
	// text — a stand-in in a test, or a document without ranges — has nothing
	// to measure by character either.
	if (
		! text ||
		! startContainer ||
		( Math.abs( lastTop - firstTop ) < 0.5 && ! edgeSpace )
	) {
		return null;
	}

	// `selectNodeContents` names the element, not the letters, so the start is
	// resolved to the text node the range begins in. A title with markup — a
	// bold word, a link — spreads the range over several nodes, and then a
	// character offset no longer names a position: the whole text has to live in
	// this one node for the offsets below to mean anything.
	const node =
		3 === startContainer.nodeType
			? startContainer
			: startContainer.childNodes[ range.startOffset ];
	const from = 3 === startContainer.nodeType ? range.startOffset : 0;

	if (
		! node ||
		3 !== node.nodeType ||
		text !== node.textContent.slice( from )
	) {
		return null;
	}
	const box = ( start, end ) => {
		const probe = doc.createRange();
		probe.setStart( node, from + start );
		probe.setEnd( node, from + end );

		return probe.getBoundingClientRect();
	};

	// The last character of the first line: the longest prefix that has not
	// reached the second line's top yet.
	let low = 0;
	let high = text.length;

	while ( low < high ) {
		const middle = Math.ceil( ( low + high ) / 2 );

		if ( box( 0, middle ).bottom <= firstBottom + 0.5 ) {
			low = middle;
		} else {
			high = middle - 1;
		}
	}

	let firstEnd = low;

	while ( firstEnd > 0 && /\s/.test( text[ firstEnd - 1 ] ) ) {
		firstEnd--;
	}

	// The first character of the last line: the shortest suffix that has
	// already reached the last line's top.
	let lowLast = 0;
	let highLast = text.length;

	while ( lowLast < highLast ) {
		const middle = Math.floor( ( lowLast + highLast ) / 2 );

		if ( box( middle, text.length ).top >= lastTop - 0.5 ) {
			highLast = middle;
		} else {
			lowLast = middle + 1;
		}
	}

	let lastStart = lowLast;

	while ( lastStart < text.length && /\s/.test( text[ lastStart ] ) ) {
		lastStart++;
	}

	let textEnd = text.length;

	while ( textEnd > 0 && /\s/.test( text[ textEnd - 1 ] ) ) {
		textEnd--;
	}

	// The first character of the title: a title that was typed with a space in
	// front of it must not push its icon out by one space either.
	let textStart = 0;

	while ( textStart < text.length && /\s/.test( text[ textStart ] ) ) {
		textStart++;
	}

	const first = firstEnd > textStart ? box( textStart, firstEnd ) : null;
	const last = textEnd > lastStart ? box( lastStart, textEnd ) : null;

	return {
		firstLeft: first ? first.left : null,
		firstRight: first ? first.right : null,
		lastLeft: last ? last.left : null,
		lastRight: last ? last.right : null,
	};
};

/**
 * Title box, relative to the wrapper's padding box.
 *
 * Pure, so the conversion can be checked without a browser.
 *
 * @param {Object} rect   Text box, in viewport coordinates.
 * @param {Object} origin Wrapper padding box origin.
 * @return {Object} `{ left, top, width, height }`.
 */
export const titleBoxFromRect = ( rect, origin ) => ( {
	left: rect.left - origin.left,
	top: rect.top - origin.top,
	width: rect.width,
	height: rect.height,
} );

/**
 * Offsets that put the icon in the margin to one side of the text.
 *
 * A plain side placement is pulled back inside when the icon would not fit in
 * that margin, so a full-width title keeps its icon visible. A corner is
 * deliberately outside the text, so it is left exactly where it was asked to
 * be — pulling it inside would put it on top of the title.
 *
 * @param {string}  side    `left` or `right`.
 * @param {Object}  box     `{ titleBox, wrapperBox, iconWidth, gap }`.
 * @param {boolean} outside Whether the icon is deliberately outside the text.
 * @return {Object} CSS properties.
 */
const sideStyle = ( side, box, outside ) => {
	const { titleBox, wrapperBox, iconWidth, gap, fit, flush } = box;
	// Hold the icon's middle on the anchor where it fits, and at the gap where
	// it would otherwise grow over the title — see `iconAnchorShift`. A fitted
	// card icon is the exception: there the whole room is needed, so it sits at
	// the gap like a full-size icon and can use the width the card leaves. A
	// flush icon is the other one: its own edge is what was asked to touch the
	// words, so the middle is not held out by half of a small box.
	const anchor = fit || flush ? 0 : iconAnchorShift( iconWidth );

	if ( 'left' === side ) {
		let right = wrapperBox.width - titleBox.left + gap + anchor;

		// The last resort, when the space beside the title is off the page:
		// overlay its start, so the icon is at least visible. The icon is drawn
		// above the title, so it stays readable — but it *is* on top of the
		// words, which is why `placeIcon` only takes this answer when leaving
		// the icon outside would push it off the screen.
		if ( ! outside && wrapperBox.width - right - iconWidth < 0 ) {
			right = Math.max( 0, wrapperBox.width - iconWidth );
		}

		return { right: `${ right }px` };
	}

	let left = titleBox.left + titleBox.width + gap + anchor;

	if ( ! outside && left + iconWidth > wrapperBox.width ) {
		left = Math.max( 0, wrapperBox.width - iconWidth );
	}

	return { left: `${ left }px` };
};

/**
 * Offsets that put the icon above or below the text.
 *
 * Above and below a title also line the icon up with the start of the text;
 * at a corner the side has already been decided, so this leaves it alone.
 *
 * @param {string}  edge        `top` or `bottom`.
 * @param {Object}  box         `{ titleBox, wrapperBox, gap, anchorHeight }`.
 * @param {boolean} alignToText Whether to align with the start of the text.
 * @return {Object} CSS properties.
 */
const edgeStyle = ( edge, box, alignToText ) => {
	const { titleBox, wrapperBox, gap, anchorHeight, anchorTop } = box;
	const style = {};

	if ( 'top' === edge ) {
		style.bottom = `${ wrapperBox.height - titleBox.top + gap }px`;
	} else {
		// Below the part of the title the icon is anchored to: the whole text,
		// or just its first or last line.
		style.top = `${ titleBox.top + anchorTop + anchorHeight + gap }px`;
	}

	if ( alignToText ) {
		style.left = `${ titleBox.left }px`;
	}

	return style;
};

/**
 * Move a computed placement by the author's offset.
 *
 * The rules anchor the icon with `left`/`right` and `top`/`bottom`, one
 * property per axis, and the offset is a screen delta: positive moves right
 * and down, negative left and up. `right` and `bottom` count inwards from the
 * far edge, so their offset is subtracted; `left` and `top` are added. That
 * makes the same number mean the same direction on every position.
 *
 * `OFFSET_DIRECTIONS` in `constants.js` spells those words out beside the two
 * fields. `iconOffset.test.js` holds the two together: it reads those words
 * back and checks the icon really moves that way, so the help text and the
 * placement cannot drift apart in silence.
 *
 * Pure, so the nudge can be checked for every position without a browser.
 *
 * @param {Object} style   CSS properties from the position rules.
 * @param {number} offsetX Horizontal offset in pixels: positive moves right.
 * @param {number} offsetY Vertical offset in pixels: positive moves down.
 * @return {Object} CSS properties, nudged.
 */
const nudge = ( style, offsetX, offsetY ) => {
	const moved = { ...style };

	// `right` and `bottom` count inwards from the far edge, so subtracting a
	// positive offset is what moves the icon right or down.
	if ( moved.right ) {
		moved.right = `${ parseFloat( moved.right ) - offsetX }px`;
	} else if ( moved.left ) {
		moved.left = `${ parseFloat( moved.left ) + offsetX }px`;
	}

	// A side placement centres with `top` plus a transform, so shifting `top`
	// carries the icon with it and the centring is left alone.
	if ( moved.bottom ) {
		moved.bottom = `${ parseFloat( moved.bottom ) - offsetY }px`;
	} else if ( moved.top ) {
		moved.top = `${ parseFloat( moved.top ) + offsetY }px`;
	}

	return moved;
};

/**
 * Style properties that place the icon beside the title.
 *
 * Pure, so the placement rules can be checked without a browser.
 *
 * `right`/`bottom` are used where possible so the icon's own size is not needed
 * — an image has no height until it loads.
 *
 * `allowOutside` says the wrapper's own box is not the room the icon has to
 * fit in, because the space beside a title belongs to the page rather than to
 * the title's own box. Both the front end and the editor want that, so both go
 * through `placeIcon`; leaving it false is what pulls the icon back on top of
 * the title's first character when the wrapper has little room to its left.
 *
 * @param {Object}  input
 * @param {Object}  input.titleBox       `{ left, top, width, height }` of the heading's text.
 * @param {Object}  input.wrapperBox     `{ width, height }` of the wrapper.
 * @param {number}  input.iconWidth      Icon width in pixels.
 * @param {string}  input.position       Position keyword.
 * @param {number}  [input.gap]          Gap between icon and title.
 * @param {boolean} [input.flush]        Whether the icon's own edge is what
 *                                       touches the words, with no gap and no
 *                                       small-icon centring.
 * @param {boolean} [input.allowOutside] Whether the icon may sit outside the wrapper.
 * @param {number}  [input.offsetX]      Horizontal screen offset in pixels:
 *                                       positive moves right, negative left.
 * @param {number}  [input.offsetY]      Vertical screen offset in pixels:
 *                                       positive moves down, negative up.
 * @param {Object}  [input.fit]          Tight-card request, when the icon is
 *                                       being fitted inside a card; it drops
 *                                       the small-icon anchor centring.
 * @param {number}  [input.lineHeight]   Height of the title line the icon is
 *                                       anchored to, in pixels. When absent
 *                                       the icon is centred on the whole block
 *                                       of text.
 * @param {number}  [input.lineTop]      Offset from the top of the text box to
 *                                       the anchored line, for the last line.
 *                                       `0` measures from the first line.
 * @return {Object} CSS properties as strings.
 */
export const computeIconStyle = ( {
	titleBox,
	wrapperBox,
	iconWidth,
	position,
	gap = ICON_GAP,
	allowOutside = false,
	offsetX = 0,
	offsetY = 0,
	fit = null,
	flush = false,
	lineHeight = null,
	lineTop = 0,
} ) => {
	const axes = AXES[ position ] || AXES.left;
	const pixels = Number.parseFloat( lineHeight );
	const topPixels = Number.parseFloat( lineTop );
	// What `top` and `bottom` are measured against on the vertical axis: one
	// line, or every line the title has.
	const anchorHeight =
		Number.isFinite( pixels ) && pixels > 0 ? pixels : titleBox.height;
	// Where that line starts, counted from the top of the text box: the first
	// line starts at 0, the last line later on.
	const anchorTop =
		Number.isFinite( topPixels ) && topPixels > 0 ? topPixels : 0;
	const box = {
		titleBox,
		wrapperBox,
		iconWidth,
		gap,
		fit,
		flush,
		anchorHeight,
		anchorTop,
	};
	let style = {};

	if ( axes.side ) {
		style = {
			...style,
			...sideStyle(
				axes.side,
				box,
				allowOutside || Boolean( axes.edge )
			),
		};
	}

	if ( axes.edge ) {
		style = { ...style, ...edgeStyle( axes.edge, box, ! axes.side ) };
	} else {
		// Centre the icon on the part of the title it is anchored to, without
		// needing its height: "left of title" means the middle of the first
		// (or last) line, so a wrapped title leaves the icon where the author
		// put it instead of pulling it down to the middle of the paragraph.
		style.top = `${ titleBox.top + anchorTop + anchorHeight / 2 }px`;
		style.transform = 'translateY(-50%)';
	}

	return nudge( style, offsetX, offsetY );
};

/**
 * Build the icon node for one asset.
 *
 * Everything that keeps the icon out of flow and on top is inline, so the icon
 * can never shift the title even if the injected stylesheet is missing.
 *
 * @param {Document} doc   Document to create the node in.
 * @param {Object}   asset Library asset (`url`, `size`, and optional responsive sizing).
 * @return {HTMLElement} The icon to insert.
 */
export const buildIcon = ( doc, asset ) => {
	const icon = doc.createElement( 'span' );
	const size = asset.fixedSize || asset.size || '20px';
	const sizeSignature = `${ asset.sizeMode || 'fixed' }|${ size }`;

	icon.className = asset.flip
		? 'titlesparks-title-icon titlesparks-title-icon--flipped'
		: 'titlesparks-title-icon';
	icon.setAttribute( 'aria-hidden', 'true' );

	// The box must be definite. An absolutely positioned icon sizes itself to
	// its content, while the image's `max-width: 100%` resolves against that
	// very width — a circular dependency Chrome settles at zero, which leaves
	// every corner position zero-sized and invisible. Naming the width breaks
	// the circle, and it also makes the overflow guards measure a real icon on
	// the first pass rather than a zero-width one. A title-following icon has
	// this width replaced with its band's size on the first placement.
	icon.style.width = size;
	icon.setAttribute( 'data-titlesparks-size-signature', sizeSignature );

	const image = doc.createElement( 'img' );
	image.className = 'titlesparks-icon__img';
	image.src = asset.url;
	image.alt = '';

	icon.appendChild( image );

	return icon;
};

/**
 * Correct placement against the fragmented containing block of an inline.
 *
 * @param {Window}  view         Window used for computed styles.
 * @param {Element} icon         Icon being positioned.
 * @param {Element} wrapper      The positioned inline containing block.
 * @param {Object}  textBox      Measured text line `{ left, right, top, bottom,
 *                               width, height }`.
 * @param {string}  position     Requested icon position.
 * @param {string}  fontSize     Computed font size for gap scaling.
 * @param {number}  offsetX      Scaled horizontal nudge.
 * @param {number}  offsetY      Scaled vertical nudge.
 * @param {Object}  [fit]        Tight-card request; a fitted icon sits at the gap
 *                               rather than the centred anchor.
 * @param {boolean} [flush]      Whether the icon's own edge touches the words,
 *                               which drops the gap and the centring.
 * @param {number}  [lineHeight] Height of the anchored line, when the icon is
 *                               anchored to one rather than to the whole title.
 * @param {number}  [lineTop]    Offset from the top of the text box to that
 *                               line, for the last line.
 * @return {void}
 */
const correctInlineContainingBlock = (
	view,
	icon,
	wrapper,
	textBox,
	position,
	fontSize,
	offsetX,
	offsetY,
	fit,
	flush,
	lineHeight,
	lineTop
) => {
	const computed = view.getComputedStyle( wrapper );

	// An absolutely positioned child of a positioned inline uses the first
	// and last fragments of that inline as its containing block. The browser's
	// fragment geometry differs from the union rect used above, most visibly
	// for wrapped links in grid/flex cards. Align the actual icon rect back to
	// the measured text line so layout mode cannot change the requested gap.
	if (
		'inline' !== computed.display ||
		'static' === computed.position ||
		icon.offsetParent !== wrapper
	) {
		return;
	}

	const axes = AXES[ position ] || AXES.left;
	const rect = icon.getBoundingClientRect();

	if ( ! rect.width || ! rect.height ) {
		return;
	}

	const gap = flush ? 0 : iconGap( fontSize );
	const pixels = Number.parseFloat( lineHeight );
	const topPixels = Number.parseFloat( lineTop );
	// The same vertical anchor as `computeIconStyle`: the anchored line when it
	// is known, the whole block otherwise.
	const anchorHeight =
		Number.isFinite( pixels ) && pixels > 0 ? pixels : textBox.height;
	const anchorTop =
		Number.isFinite( topPixels ) && topPixels > 0 ? topPixels : 0;
	let x = textBox.left + offsetX;
	let y =
		textBox.top + anchorTop + anchorHeight / 2 + offsetY - rect.height / 2;

	if ( axes.side ) {
		// Same rule as `sideStyle`, expressed as a left edge: the icon's own
		// width is measured here, so it can be taken back off.
		const anchor = fit || flush ? 0 : iconAnchorShift( rect.width );

		if ( 'left' === axes.side ) {
			x = textBox.left - gap - anchor - rect.width + offsetX;
		} else {
			x = textBox.right + gap + anchor + offsetX;
		}
	}

	if ( axes.edge ) {
		if ( 'top' === axes.edge ) {
			y = textBox.top - gap - rect.height + offsetY;
		} else {
			y = textBox.top + anchorTop + anchorHeight + gap + offsetY;
		}
	}
	const move = ( near, far, delta ) => {
		if ( icon.style[ near ] ) {
			icon.style[ near ] = `${
				parseFloat( icon.style[ near ] ) + delta
			}px`;
		} else if ( icon.style[ far ] ) {
			icon.style[ far ] = `${
				parseFloat( icon.style[ far ] ) - delta
			}px`;
		}
	};

	move( 'left', 'right', x - rect.left );
	move( 'top', 'bottom', y - rect.top );
};

/**
 * Measure the title and write the icon's position into its own style.
 *
 * Everything the placement needs travels in `options`, including the site's
 * stacking order (`zIndex`), so the editor canvas and the front end write the
 * same CSS. See `computeIconStyle` for the geometry.
 *
 * @param {Document} doc       Document owning the title.
 * @param {Element}  icon      Icon node to place.
 * @param {Element}  wrapper   Element the icon is positioned against.
 * @param {Element}  title     Title element the icon sits beside.
 * @param {string}   position  Position keyword.
 * @param {Object}   [options] `offsetX`, `offsetY`, `iconAnchor`, `zIndex`,
 *                             `fit`, `fontSize`, `adaptive` (whether the
 *                             icon follows the title) and the `sizingRules`
 *                             that decide its width when it does.
 * @return {void}
 */
export const positionIcon = (
	doc,
	icon,
	wrapper,
	title,
	position,
	options = {}
) => {
	const view = doc.defaultView || window;
	const fit = fitRequest( options.fit );

	// Undo the previous pass's fit before measuring: the width it shrank and
	// the card it hid the icon on are worked out again from the room the card
	// offers now. `fitPass` marks the re-measure of this same placement, which
	// must not undo what it has just applied.
	if ( ! options.fitPass ) {
		releaseFit( icon );
	}

	const origin = wrapperOrigin( view, wrapper );
	const measured = textRect( doc, title, icon );

	// An empty title still shows its placeholder, which has no measurable text;
	// fall back to the heading's own box so the icon stays visible.
	const textBox = measured || title.getBoundingClientRect();

	// Measured from the title, not assumed: the same title is a different size
	// in the editor's canvas, in a wide window and at a zoom level, and both the
	// gap and the author's nudge have to follow it to look the same in all
	// three. See `OFFSET_REFERENCE_PX` for why the nudge is in these terms.
	const measuredFontSize =
		options.fontSize || view.getComputedStyle( title ).fontSize;
	const fontPixels = Number.parseFloat( measuredFontSize );
	const fontSize =
		Number.isFinite( fontPixels ) && fontPixels > 0
			? measuredFontSize
			: ICON_GAP / ICON_GAP_EM;

	// A stage that follows the title is sized from its bands, and from its own
	// title's size: every copy is drawn at the icon size its text asks for.
	// A fixed stage keeps the size the author chose, whatever the title does.
	const adaptiveWidth = options.adaptive
		? advancedIconWidth( options.sizingRules, fontSize )
		: null;

	// A fitted width is the card's answer, not the title's, and it is smaller
	// on purpose. Writing the band's own size over it on the re-measure that
	// follows put the icon back at its full width on every pass, so the card
	// shrank it again and again and never settled — measured on a card with
	// 18px of room, six passes, the icon still 26px wide and still clipped.
	if ( null !== adaptiveWidth && ! icon.dataset.tsFitWidth ) {
		icon.style.width = `${ adaptiveWidth }px`;
	}

	// How much the icon grew, from the size the same bands draw beside the
	// editor's 32px reference. Below 1 at a small title and above 1 at a large
	// one. The nudge follows this rather than the title alone, so an icon that
	// the bands stop growing does not keep moving away from the text it no
	// longer grows with. A fixed-size icon has no bands to reach, so it is left
	// to the title.
	const atReferenceWidth =
		null === adaptiveWidth
			? null
			: advancedIconWidth( options.sizingRules, OFFSET_REFERENCE_PX );
	const iconGrowth =
		atReferenceWidth > 0 ? adaptiveWidth / atReferenceWidth : null;

	// The two numbers are screen deltas and are applied as written, on every
	// position and on both axes: the post-title icon belongs to the author, so
	// a horizontal move may bring it over the words just as a vertical one
	// already could. An icon drawn inside a widget card is the exception, and
	// says so by passing `minimumGap`: the card's icon may not walk onto the
	// words it labels.
	//
	// `flush` is the author asking for no space at all, so both the gap and the
	// small-icon centring go: the icon's own edge is what sits against the last
	// character. Nothing else about the placement changes.
	const flush = 'flush' === options.spacing;
	const gap = flush ? 0 : iconGap( fontSize );

	// The clamp is measured from the icon as it is *drawn*, after its bands have
	// sized it. Working it out before the resize is what let a large band show
	// the icon over the first word: a wide icon is held at the gap rather than
	// half a box out, so the room the author may nudge into is smaller than the
	// pre-resize gap suggested.
	const renderedWidth =
		null === adaptiveWidth ? icon.offsetWidth : adaptiveWidth;
	const nearEdge =
		gap + ( fit || flush ? 0 : iconAnchorShift( renderedWidth ) );
	const safe = Number.isFinite( Number.parseFloat( options.minimumGap ) )
		? offsetsWithMinimumGap(
				position,
				options,
				fontSize,
				options.minimumGap,
				nearEdge,
				iconGrowth
			)
		: options;
	const offsetX = scaleOffset( safe.offsetX, fontSize, iconGrowth );
	const offsetY = scaleOffset( safe.offsetY, fontSize, iconGrowth );

	// The anchor decides what the vertical offset is measured from. "First
	// line" is the default and needs that line's height; the last-line anchor
	// also needs how far down the box that line starts. A title with no
	// measurable text falls back to its own box, which is one line anyway.
	const anchored = resolveIconAnchor( options.iconAnchor );
	let lineHeight = null;

	if ( 'block' !== anchored && measured ) {
		lineHeight =
			'last_line' === anchored
				? measured.lastLineHeight
				: measured.lineHeight;
	}

	const lineTop =
		'last_line' === anchored && measured ? measured.lastLineTop : 0;

	// A side icon belongs beside the words of the line it is anchored to, not
	// beside the longest line in the title: measured on a wrapped post, a right
	// icon anchored to the last line stood 208px past the words it labelled, and
	// on the first line of a two-line title it floated 148px beyond the end of
	// that line. Both edges of the anchored line are used, so a right icon sits
	// after that line's last character and a left icon before its first. The
	// `block` anchor is the answer that keeps the whole text box instead, which
	// is what its name promises.
	let anchoredLine = null;

	if ( 'block' !== anchored && measured ) {
		anchoredLine =
			'last_line' === anchored
				? { left: measured.lastLineLeft, right: measured.lastLineRight }
				: {
						left: measured.firstLineLeft,
						right: measured.firstLineRight,
					};
	}
	const hasLineBox = anchoredLine && anchoredLine.right > anchoredLine.left;
	const titleBox = titleBoxFromRect( textBox, origin );

	if ( hasLineBox ) {
		titleBox.left = anchoredLine.left - origin.left;
		titleBox.width = anchoredLine.right - anchoredLine.left;
	}

	const style = computeIconStyle( {
		titleBox,
		wrapperBox: wrapperSize( view, wrapper ),
		iconWidth: icon.offsetWidth,
		position,
		gap,
		flush,
		lineHeight,
		lineTop,
		...options,
		offsetX,
		offsetY,
	} );

	[ 'left', 'right', 'top', 'bottom', 'transform' ].forEach( ( key ) => {
		icon.style[ key ] = '';
	} );

	// Taking the icon out of flow is what stops it shifting the title while it
	// is measured and placed. Everything else is left to the theme.
	icon.style.position = 'absolute';

	// The site's stacking order. It travels with the placement rather than the
	// icon node, so an existing icon moves in front of (or behind) the same
	// things when the setting changes without being rebuilt. `0` is written as
	// no inline value at all: the icon keeps the page's normal order, including
	// anything the theme's own CSS says about it.
	const zIndex = Number.parseInt( options.zIndex, 10 );

	if ( Number.isFinite( zIndex ) ) {
		icon.style.zIndex = 0 === zIndex ? '' : String( zIndex );
	}

	Object.keys( style ).forEach( ( key ) => {
		icon.style[ key ] = style[ key ];
	} );

	// The inline correction re-aligns the icon to the measured text, so it has
	// to see the same edges the placement used.
	const inlineText = hasLineBox
		? {
				...textBox,
				left: anchoredLine.left,
				right: anchoredLine.right,
			}
		: textBox;

	correctInlineContainingBlock(
		view,
		icon,
		wrapper,
		inlineText,
		position,
		fontSize,
		offsetX,
		offsetY,
		fit,
		flush,
		lineHeight,
		lineTop
	);

	// A pass that changes the icon always gets a placement after it. If the
	// last change were left unmeasured the icon would keep the position from
	// before its new width, so the gap would stretch and a fitted icon could
	// still sit outside the card.
	if (
		fit &&
		( options.fitPass || 0 ) < MAX_FIT_PASSES &&
		fitCard( { view, icon, position, textBox, gap, fit } )
	) {
		const pass = ( options.fitPass || 0 ) + 1;

		// The new size has to be measured before it can be trusted, so place
		// once more.
		positionIcon( doc, icon, wrapper, title, position, {
			...options,
			fitPass: pass,
		} );
	}
};

/**
 * How many times placement may be re-measured after fitting an icon.
 *
 * A fitted width changes the icon, and the icon is placed from its measured
 * size, so one more pass is needed to trust the result. The cap is what stops
 * a card measured mid-load from asking again for ever.
 */
const MAX_FIT_PASSES = 6;

/**
 * Smallest icon a card may shrink one to, in pixels.
 *
 * Below this the picture reads as a speck, so a card that cannot hold this much
 * falls back to keeping the author's size and letting the theme clip.
 */
export const TIGHT_FIT_MIN_ICON = 8;

/**
 * The mode an untouched site uses, matching `TIGHT_FIT_DEFAULT` in the shared
 * constants.
 *
 * `keep` is the default because it is the only answer that changes nothing: the
 * icon is drawn exactly where the author put it, at the size they chose. An
 * untouched site is therefore never surprised by an icon that shrinks or
 * disappears.
 */
export const TIGHT_FIT_DEFAULT = 'keep';

/**
 * Decide what to do about an icon that does not fit inside its card.
 *
 * Pure, so every answer can be checked without a browser. It never returns an
 * answer that draws the icon over the words: shrinking stops at the last width
 * that still leaves the gap, and a card too tight even for that is left to
 * clip. Nor does it ever answer with room to reserve: an icon that does not
 * fit is made to fit, so the title's own words stay where the author put them.
 *
 * @param {Object} input
 * @param {string} input.mode      `keep`, `shrink` or `hide`.
 * @param {number} input.room      Space between the title's text and the card edge.
 * @param {number} input.gap       Gap the placement asks for, in pixels.
 * @param {number} input.iconWidth Icon width in pixels.
 * @param {number} input.overflow  Pixels the icon hangs past the card edge.
 * @return {{width: number|null, hide: boolean}} What to apply.
 */
export const tightFitPlan = ( { mode, room, gap, iconWidth, overflow } ) => {
	const none = { width: null, hide: false };

	// Sub-pixel slop: a card measured as 0.4px over is a card that fits.
	if ( ! ( overflow > 0.5 ) ) {
		return none;
	}

	if ( 'hide' === mode ) {
		return { ...none, hide: true };
	}

	// `keep` changes nothing: the icon keeps its gap and the theme decides
	// what happens at the card edge.
	if ( 'keep' === mode ) {
		return none;
	}

	if ( 'shrink' === mode ) {
		// A card that would cut the icon off gets a smaller icon, never a
		// shorter title: moving the words to keep a picture whole is the one
		// answer this asks the site's own layout to pay for. A fitted icon
		// sits at the gap rather than on the anchor (see `sideStyle`), so the
		// whole room less the gap is its width.
		//
		// Below the floor the icon would read as a speck, so the card is left
		// to clip what it clips rather than offering a size nobody can see.
		const width = Math.floor( room - gap );

		return width >= TIGHT_FIT_MIN_ICON && width < iconWidth
			? { ...none, width }
			: none;
	}

	// Anything else — an empty setting, or a value this version does not know —
	// must not change the author's icon, so the same answer as `keep` is given
	// rather than resizing it.
	return none;
};

/**
 * Undo whatever the previous placement did to fit this icon.
 *
 * Only a fitted width or a hidden icon can be undone: the placement never
 * touches the title's own layout, so there is no room to give back.
 *
 * @param {Element} icon Placed icon.
 * @return {void}
 */
const releaseFit = ( icon ) => {
	if ( icon.dataset.tsFitWidth ) {
		icon.style.width = icon.dataset.tsFitWidth;
		delete icon.dataset.tsFitWidth;
	}

	if ( 'none' === icon.style.display ) {
		icon.style.display = '';
	}
};

/**
 * The edges a card offers an icon, in viewport pixels.
 *
 * The card's own padding is space beside the title that the icon may use,
 * exactly as a post title's icon uses the space beside its heading. Reserving
 * that padding as well indented a recent posts title by the width of its icon
 * for no reason. Only the border is outside the card.
 *
 * Pure, so the rule can be checked without a browser.
 *
 * @param {Object} rect  Card's bounding rect.
 * @param {Object} style Computed style of the card.
 * @return {{left: number, right: number}} Edges the icon may reach.
 */
export const fitLimits = ( rect, style ) => {
	const edge = ( name ) => Number.parseFloat( style[ name ] ) || 0;

	return {
		left: rect.left + edge( 'borderLeftWidth' ),
		right: rect.right - edge( 'borderRightWidth' ),
	};
};

/**
 * Whether a box would cut off what leaves it.
 *
 * Only a box that clips can hide an icon, and only then is moving the title's
 * words worth doing. A card with visible overflow leaves the icon showing in
 * the space around it, so reserving room there just indented the title by the
 * width of its icon: measured on a recent posts item, whose icon sat in the
 * theme's own page padding and was never cut off.
 *
 * Pure, so the rule can be checked without a browser.
 *
 * @param {Object} style Computed style of the box.
 * @return {boolean} Whether the box hides what leaves it.
 */
export const clipsOverflow = ( style ) =>
	/(hidden|clip|scroll|auto)/.test(
		`${ style.overflowX } ${ style.overflowY }`
	);

/**
 * Apply the site's tight-card answer to one placed icon.
 *
 * @param {Object}  input
 * @param {Window}  input.view     Window owning the icon.
 * @param {Element} input.icon     Placed icon.
 * @param {string}  input.position Position keyword.
 * @param {Object}  input.textBox  The title's text box, in viewport pixels.
 * @param {number}  input.gap      Gap the placement asks for.
 * @param {Object}  input.fit      `{ mode, boundary }` from the caller.
 * @return {boolean} Whether the icon changed and placement has to re-measure.
 */
const fitCard = ( { view, icon, position, textBox, gap, fit } ) => {
	const side =
		[ 'left', 'right' ].find( ( name ) =>
			String( position ).startsWith( name )
		) || '';

	if ( ! side ) {
		return false;
	}

	const boundary = fit.boundary;
	const computed = view.getComputedStyle( boundary );
	const rect = boundary.getBoundingClientRect();
	const limit = fitLimits( rect, computed );

	if ( limit.right <= limit.left ) {
		return false;
	}

	// Only a card that clips can hide the icon, so only that card gets a
	// smaller one. A card whose overflow is visible shows what leaves it, and
	// there the author's icon is left exactly as it was placed.
	if ( ! clipsOverflow( computed ) ) {
		return false;
	}

	const box = icon.getBoundingClientRect();
	const iconWidth = box.width || icon.offsetWidth;

	if ( ! iconWidth ) {
		return false;
	}

	const room =
		'left' === side
			? textBox.left - limit.left
			: limit.right - textBox.right;
	const overflow =
		'left' === side ? limit.left - box.left : box.right - limit.right;
	const plan = tightFitPlan( {
		mode: fit.mode,
		room,
		gap,
		iconWidth,
		overflow,
	} );

	if ( plan.hide ) {
		icon.style.display = 'none';

		return false;
	}

	if ( ! plan.width ) {
		return false;
	}

	if ( ! icon.dataset.tsFitWidth ) {
		icon.dataset.tsFitWidth = icon.style.width;
	}

	icon.style.width = `${ plan.width }px`;

	return true;
};

/**
 * Normalise the caller's tight-card request.
 *
 * @param {Object} value `{ mode, boundary }`, or nothing.
 * @return {{mode: string, boundary: Element}|null} Request, or null.
 */
const fitRequest = ( value ) => {
	if ( ! value || ! value.boundary ) {
		return null;
	}

	return {
		mode: [ 'keep', 'shrink', 'hide' ].includes( value.mode )
			? value.mode
			: TIGHT_FIT_DEFAULT,
		boundary: value.boundary,
	};
};

/**
 * Whether a placed icon has run off the visible page.
 *
 * @param {Element} icon Icon element.
 * @param {Window}  view Window the icon is rendered in.
 * @return {boolean} True when the icon is partly off the page.
 */
export const iconOffscreen = ( icon, view ) => {
	const rect = icon.getBoundingClientRect();
	const width = view && view.innerWidth ? view.innerWidth : 0;

	return Boolean( width ) && ( rect.left < 0 || rect.right > width );
};

/**
 * Place the icon beside the title, the same way on both sides of the plugin.
 *
 * The editor and the front end used to answer "is there room beside the title?"
 * differently, and that is what made the same setting look right on a page and
 * wrong in the canvas:
 *
 *   - The front end passed `allowOutside`, so a `left` icon was put to the left
 *     of the title's text wherever that landed — usually in the theme's own
 *     container padding, which is the space an author is aiming at.
 *   - The editor did not, so `computeIconStyle` measured the room against the
 *     wrapper's own box. WordPress' post title wrapper has little or no space
 *     to the left of the text, so the fallback fired and the icon was pulled
 *     back inside — on top of the title's first character.
 *
 * So the rule is stated once, here, and both sides call it: the space beside
 * the title belongs to the page, not to the title's own box; the icon is only
 * pulled back inside when leaving it outside would push it off the page, which
 * is the one case where nothing else can be done.
 *
 * @param {Document} doc       Document owning the title.
 * @param {Element}  icon      Icon node.
 * @param {Element}  wrapper   Element the icon is positioned against. The front
 *                             end passes the heading itself, the editor the
 *                             wrapper that holds it and nothing else — two ways
 *                             of naming the same box, which is what makes one
 *                             offset mean one thing on both sides.
 * @param {Element}  title     The title element the icon sits beside.
 * @param {string}   position  Position keyword.
 * @param {Object}   [options] `offsetX`, `offsetY` and anything else
 *                             `computeIconStyle` accepts. The offsets are the
 *                             author's own pixels, scaled to this title's font
 *                             size — see `OFFSET_REFERENCE_PX`.
 * @return {void}
 */
export const placeIcon = (
	doc,
	icon,
	wrapper,
	title,
	position,
	options = {}
) => {
	const view = doc.defaultView || window;

	positionIcon( doc, icon, wrapper, title, position, {
		...options,
		allowOutside: true,
	} );

	// Only a side placement has a second answer; above and below the title the
	// page's own spacing is what it is.
	if ( 'left' !== position && 'right' !== position ) {
		return;
	}

	// One read of the icon decides both questions below: whether it hangs off
	// the page, and by how much.
	const rect = icon.getBoundingClientRect();
	const width = view && view.innerWidth ? view.innerWidth : 0;
	const offscreen =
		Boolean( width ) && ( rect.left < 0 || rect.right > width );

	if ( ! offscreen ) {
		return;
	}

	// An icon the author nudged past the edge of the page is moved back by the
	// smallest amount that puts it on the page, not by its whole distance from
	// the title: the overlap they asked for is what the page shows, and a
	// narrow canvas that leaves less gutter than the nudge needs must not undo
	// it. Measured in the editor at 700px: the words start 8px in, the 37px
	// nudge needs 39.2px, so the icon's own edge sat 0.25px past the window and
	// the old fallback pulled it a whole 47px inside, beside the words instead
	// of over them.
	//
	// The shift is applied to the placed style rather than folded into the
	// stored offset, so it stays the same number of pixels at every title size:
	// the stored value is scaled by the title's font size on the way in.
	const shift =
		rect.left < 0 ? -rect.left : Math.min( 0, width - rect.right );

	if ( shift ) {
		if ( icon.style.left ) {
			icon.style.left = `${ parseFloat( icon.style.left ) + shift }px`;
		} else if ( icon.style.right ) {
			icon.style.right = `${ parseFloat( icon.style.right ) - shift }px`;
		}
	}

	// Still off the page — an icon wider than the window — keeps the older
	// answer, which at least puts the whole icon inside the wrapper.
	if ( iconOffscreen( icon, view ) ) {
		positionIcon( doc, icon, wrapper, title, position, options );
	}
};

/**
 * Whether a trailing inline icon wrapped below the title's last line.
 *
 * An inline icon is only placed after the text if there is room on that line;
 * a narrow title pushes it to a line of its own, where it sits under the start
 * of the words instead of beside their end. The icon is measured before the
 * author's nudge is applied, so an icon still on the line is to the right of
 * the last glyph.
 *
 * @param {Element} icon  Inline icon.
 * @param {Element} title Title element containing it.
 * @return {boolean} True when the icon starts before the text's last line ends.
 */
const inlineIconWrapped = ( icon, title ) => {
	const doc = icon.ownerDocument;

	if ( ! doc.createRange ) {
		return false;
	}

	const range = doc.createRange();
	range.selectNodeContents( title );
	range.setEndBefore( icon );

	const rects = [ ...range.getClientRects() ].filter(
		( rect ) => rect.width > 0 && rect.height > 0
	);

	if ( ! rects.length ) {
		return false;
	}

	const lastLine = rects[ rects.length - 1 ];

	return icon.getBoundingClientRect().left < lastLine.right;
};

/**
 * Place an inline widget icon using the same title-relative offset scale and
 * measured clearance as absolutely positioned post-title icons.
 *
 * The icon remains in text flow, so its base gap is expressed as a margin. We
 * clear the previous relative translation before measuring, which makes repeat
 * layout passes idempotent rather than measuring the last pass's own offset.
 *
 * @param {Element} icon     Inline icon.
 * @param {Element} title    Title containing the icon.
 * @param {string}  position `left` or `right`.
 * @param {Object}  options  Offset values, optional fontSize and minimumGap.
 * @return {Object} Applied, safe stored-pixel offsets.
 */
export const placeInlineIcon = ( icon, title, position, options = {} ) => {
	if ( ! title ) {
		return { offsetX: 0, offsetY: 0 };
	}

	const view = icon.ownerDocument.defaultView;

	if ( ! view ) {
		return { offsetX: 0, offsetY: 0 };
	}

	const computedSize =
		options.fontSize || view.getComputedStyle( title ).fontSize;
	const size = Number.parseFloat( computedSize );
	const fontSize =
		Number.isFinite( size ) && size > 0
			? computedSize
			: String( ICON_GAP / ICON_GAP_EM );
	icon.style.position = 'relative';
	icon.style.left = '0px';
	icon.style.top = '0px';

	// A trailing icon that did not fit on the last line is pushed to a line of
	// its own, where it reads as sitting under the start of the title. A
	// negative trailing margin removes the icon from the line's width budget,
	// so the browser keeps it on the last line; it then overhangs the title box
	// by its own width, which is where it belongs.
	if ( 'right' === position ) {
		// Repeating a placement pass must start from the theme's own margins, or
		// the negative margin would hide the fact that the icon wrapped.
		icon.style.marginRight = '';

		if ( inlineIconWrapped( icon, title ) ) {
			const computed = view.getComputedStyle( icon );
			const marginLeft = Number.parseFloat( computed.marginLeft ) || 0;
			const marginRight = Number.parseFloat( computed.marginRight ) || 0;

			icon.style.marginRight = `${ -(
				icon.offsetWidth +
				marginLeft +
				marginRight
			) }px`;
		}
	}

	const naturalGap = offsetGap( icon, title, position );
	const offsets = offsetsWithMinimumGap(
		position,
		options,
		fontSize,
		options.minimumGap ?? ICON_MIN_CLEARANCE,
		naturalGap
	);
	const offsetX = scaleOffset( offsets.offsetX, fontSize );
	const offsetY = scaleOffset( offsets.offsetY, fontSize );

	// Screen deltas: the same positive number moves an inline icon to the
	// right whether it sits before or after the title.
	icon.style.left = `${ offsetX }px`;
	icon.style.top = `${ offsetY }px`;

	return offsets;
};

/**
 * Remove every trace of the injected icon, restoring the editor's layout.
 *
 * @return {void}
 */
export const removeEditorIcon = () => {
	canvasDocuments().forEach( ( doc ) => {
		doc.querySelectorAll( `[${ ICON_ATTR }]` ).forEach( ( node ) => {
			node.remove();
		} );

		doc.querySelectorAll( `.${ HOST_CLASS }` ).forEach( ( node ) => {
			node.classList.remove( HOST_CLASS );
		} );

		const style = doc.getElementById( STYLE_ID );

		if ( style ) {
			style.remove();
		}
	} );
};

/**
 * Make the canvas match the requested icon.
 *
 * Idempotent, and deliberately keeps re-positioning even when nothing
 * structural changed: opening the editor sidebar resizes the canvas without
 * changing its DOM, which would leave the icon stranded otherwise.
 *
 * @param {Object} state
 * @param {Object} state.asset         Library asset to show.
 * @param {string} state.position      Position keyword.
 * @param {string} state.signature     Identity of the desired icon.
 * @param {number} [state.offsetX]     Horizontal nudge for this position, in pixels.
 * @param {number} [state.offsetY]     Vertical nudge for this position, in pixels.
 * @param {string} [state.iconAnchor]  What the vertical nudge counts from:
 *                                     `first_line`, `last_line` or `block`.
 * @param {string} [state.spacing]     `gap` or `flush` beside the icon.
 * @param {number} [state.zIndex]      The site's stacking order for the icon.
 * @param {Array}  [state.sizingRules] Bands a title-following icon is sized from.
 * @return {boolean} Whether the icon had to be inserted or rebuilt.
 */
export const syncEditorIcon = ( {
	asset,
	position,
	signature,
	offsetX = 0,
	offsetY = 0,
	iconAnchor = null,
	spacing = null,
	zIndex = null,
	sizingRules = null,
} ) => {
	// Every placement this function makes carries the same things, so changing
	// the anchor, the stacking order or the bands moves the icon on the next
	// pass without rebuilding it. The stage's mode travels with the asset: a
	// title-following icon is sized from the bands, a fixed one is not.
	const offset = {
		offsetX,
		offsetY,
		iconAnchor,
		spacing,
		zIndex,
		// Advanced is the title-following mode; a fixed stage ignores the bands.
		adaptive: 'advanced' === asset.sizeMode,
		sizingRules,
	};
	// The same signature `buildIcon` writes, so an icon whose size and mode
	// have not changed is moved rather than rebuilt (a rebuilt GIF restarts).
	const desiredSize = `${ asset.sizeMode || 'fixed' }|${
		asset.fixedSize || asset.size || '20px'
	}`;
	const existing = canvasDocuments().flatMap( ( doc ) => [
		...doc.querySelectorAll( `[${ ICON_ATTR }]` ),
	] );
	const target = editorTitleTarget();

	if ( ! target ) {
		existing.forEach( ( node ) => node.remove() );

		return false;
	}

	const { doc, title, wrapper } = target;
	const iconFirst = iconComesFirst( position );
	const current = existing.find( ( node ) => node.parentNode === wrapper );
	const inOrder =
		current &&
		( iconFirst
			? current.nextElementSibling === title
			: current.previousElementSibling === title );
	const currentAsset = current && current.getAttribute( ICON_ATTR );
	const currentSize =
		current && current.getAttribute( 'data-titlesparks-size-signature' );

	if ( inOrder && wrapper.classList.contains( HOST_CLASS ) ) {
		// Re-point the side if only the position changed, otherwise just
		// reposition in place.
		if ( currentAsset === signature && currentSize === desiredSize ) {
			placeIcon( doc, current, wrapper, title, position, {
				...offset,
			} );
		} else {
			current.remove();

			const icon = buildIcon( doc, asset );
			icon.setAttribute( ICON_ATTR, signature );

			if ( iconFirst ) {
				title.before( icon );
			} else {
				title.after( icon );
			}

			placeIcon( doc, icon, wrapper, title, position, {
				...offset,
			} );
		}

		existing
			.filter( ( node ) => node !== current )
			.forEach( ( node ) => node.remove() );

		return false;
	}

	existing.forEach( ( node ) => node.remove() );

	ensureEditorStyles( doc );
	wrapper.classList.add( HOST_CLASS );

	const icon = buildIcon( doc, asset );
	icon.setAttribute( ICON_ATTR, signature );

	if ( iconFirst ) {
		title.before( icon );
	} else {
		title.after( icon );
	}

	placeIcon( doc, icon, wrapper, title, position, {
		...offset,
	} );

	return true;
};
