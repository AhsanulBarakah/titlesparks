/**
 * Front end title icons.
 *
 * The editor draws the icon by measuring the title's own *text* and positioning
 * against it, and this does the same with the same code — `placeIcon`, shared
 * with the editor — so a title looks the same in the editor and on the front
 * end, down to which element each side calls the room beside the title.
 *
 * The title element is found in the finished page rather than written into it
 * by PHP. `blocks/shared/frontendTitleDom.js` explains why at length; the short
 * version is that filtering `the_title` also catches the title inside
 * attributes, secondary loops, breadcrumbs and meta tags, and whichever of
 * those came first in a theme decided where the icon appeared — differently on
 * every theme. Here the icon is inserted into the element a reader actually
 * sees, so nothing a theme renders can be disturbed.
 *
 * The step runs again whenever the page changes: web fonts land after the first
 * paint and change how much room the text takes, themes insert content in
 * response to a scroll, and opening a menu can reflow a heading. Placement is
 * measured, so it has to be measured again when what it was measured from
 * moves. `Title_Renderer` only enqueues this script when the page really has an
 * icon to place, so a page with nothing to show never downloads it.
 */

import { ICON_GAP, ICON_GAP_EM, placeIcon } from '../shared/editorTitleDom';
import {
	ICON_ANCHOR_DEFAULT,
	ICON_SPACING_DEFAULT,
	TIGHT_FIT_DEFAULT,
	iconAnchorMode,
	iconSpacingMode,
	iconZIndex,
	resolveIconSpacing,
	tightFitMode,
} from '../shared/constants';
import {
	ICON_ATTR,
	WIDGET_ATTR,
	fitBoundary as boundaryForIcon,
	iconPlacementForEntry,
	iconTitleHost,
	insertIcons,
} from '../shared/frontendTitleDom';
import { entryAt, nextBoundary } from '../shared/stageTimeline';

/**
 * Global the server fills in with the icons this page should show.
 *
 * Named after the editor's bootstrap (`titleSparksEditorData`) so the two sides
 * of the plugin read alike.
 */
const DATA = 'titleSparksFrontendData';

/**
 * How far ahead a stage boundary is worth a timer, in seconds.
 *
 * A boundary further away than this is left to the next page load: keeping a
 * timer alive for hours would be a timer every open page never uses.
 */
const STAGE_TIMER_WINDOW = 24 * 60 * 60;

/**
 * Results of choosing a widget icon's boundary, kept per icon.
 *
 * Recomputing after a reservation would read the padding placement just added
 * and mistake it for the card's own. A known box still containing the icon is
 * reused; anything else is measured afresh.
 */
const fitBoundaries = new WeakMap();

/**
 * Find the box that owns a widget icon's space, reusing a settled answer.
 *
 * @param {Element} icon   Icon element.
 * @param {Element} widget Marked widget wrapper, the last resort.
 * @return {Element} Element to measure the icon against.
 */
const fitBoundary = ( icon, widget ) => {
	const known = fitBoundaries.get( icon );

	if ( known && known.contains( icon ) ) {
		return known;
	}

	const boundary = boundaryForIcon( icon, widget );

	if ( boundary ) {
		fitBoundaries.set( icon, boundary );
	}

	return boundary;
};

/**
 * The site's answer for an icon that does not fit inside its card.
 *
 * One switch in Settings: `shrink` draws an icon the card would cut off at a
 * smaller size, so it fits; `keep` draws it exactly as the author placed it and
 * leaves the card edge to the theme. Neither moves the title's words. Passed
 * with the icon data so a page is never laid out with a mode the site did not
 * choose.
 *
 * @return {string} `keep` or `shrink`.
 */
const tightFit = () => {
	const data = window[ DATA ];

	return data ? tightFitMode( data.tightFit ) : TIGHT_FIT_DEFAULT;
};

/**
 * What the icon's Y offset counts from: the title's first line, or the middle
 * of every line.
 *
 * Passed with the icon data, so the answer travels with the page instead of
 * being read from an option during placement.
 *
 * @return {string} `first_line` or `block`.
 */
const iconAnchor = () => {
	const data = window[ DATA ];

	return data ? iconAnchorMode( data.iconAnchor ) : ICON_ANCHOR_DEFAULT;
};

/**
 * The space the site leaves beside an icon.
 *
 * Passed with the icon data for the same reason as the anchor: an entry that
 * carries no answer of its own still draws the space the site asks for.
 *
 * @return {string} `gap` or `flush`.
 */
const iconSpacing = () => {
	const data = window[ DATA ];

	return data ? iconSpacingMode( data.iconSpacing ) : ICON_SPACING_DEFAULT;
};

/**
 * The site's stacking order for the icon.
 *
 * Passed with the icon data for the same reason as the anchor: the answer
 * travels with the page instead of being read from an option.
 *
 * @return {number} A CSS `z-index`, `0` for the page's normal order.
 */
const iconStackingOrder = () => {
	const data = window[ DATA ];

	return iconZIndex( data ? data.iconZIndex : undefined );
};

/**
 * The site's default title-size bands.
 *
 * Each entry normally carries the bands of the stage that produced its icon,
 * because a stage can have its own table. This is the fallback for an entry
 * that carries none.
 *
 * @return {Array|null} `{ font, icon }` pairs in pixels, or null on a page
 *                      that carries none.
 */
const siteSizingRules = () => {
	const data = window[ DATA ];

	return data && Array.isArray( data.sizingRules ) ? data.sizingRules : null;
};

/**
 * The icons the server resolved for this page.
 *
 * Each entry also carries its `stages` and the timeline's `stage3Behaviour`,
 * which is what lets a cached page pick the stage that is live when it is
 * read; `entryAt()` resolves that.
 *
 * @return {Array} Entries, each `{ id, title, permalink, url, size, position,
 *                 offsetX, offsetY, alt, stages }`.
 */
const entries = () => {
	const data = window[ DATA ];

	return data && Array.isArray( data.icons ) ? data.icons : [];
};

/**
 * Whether the reader has asked their system for less motion.
 *
 * An animated GIF cannot be paused with CSS, so an entry whose site offered a
 * still copy carries one in `still` and this is what picks it. The preference
 * can change while the page is open, and placement runs again on every change
 * the page makes, so it is read per pass rather than once.
 *
 * @return {boolean} Whether reduced motion is requested.
 */
const prefersReducedMotion = () =>
	Boolean(
		window.matchMedia &&
		window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches
	);

/**
 * Place one icon against the corner or edge of its title's text.
 *
 * The placement itself is `placeIcon`, shared with the editor, so a title
 * cannot be measured one way in the canvas and another way on the page. All
 * this adds is the front end's own housekeeping: the icon is taken out of flow
 * and the title is made the positioning context for it.
 *
 * @param {Element} icon     Icon element.
 * @param {string}  position Position keyword.
 * @param {Object}  offset   `{ offsetX, offsetY }` nudge in pixels.
 * @param {boolean} adaptive Whether this stage follows the title's size.
 * @param {Array}   rules    Bands a title-following icon is sized from.
 * @param {string}  anchor   This post's anchor, or null for the site's.
 * @param {string}  spacing  `gap` or `flush`, or `''` for the site's.
 * @return {void}
 */
const place = ( icon, position, offset, adaptive, rules, anchor, spacing ) => {
	const view = icon.ownerDocument.defaultView;

	// The icon is normally inserted into the heading itself, so its parent is
	// the title — the same element the editor measures against, which is what
	// makes one offset mean one thing on both sides. A card link that also
	// carries a thumbnail stores the title separately: the icon sits beside the
	// card's content but is measured against the title text.
	const title = iconTitleHost( icon );
	const wrapper = icon.parentElement;

	if ( ! view || ! title || ! wrapper ) {
		return;
	}

	const { document: doc } = view;
	const widget = icon.closest( `[${ WIDGET_ATTR }]` );
	const titleFontSize = view.getComputedStyle( title ).fontSize;
	const titleFontPixels = Number.parseFloat( titleFontSize );
	let fontSize = titleFontSize;

	if ( ! Number.isFinite( titleFontPixels ) || titleFontPixels <= 0 ) {
		fontSize = widget
			? view.getComputedStyle( widget ).fontSize
			: String( ICON_GAP / ICON_GAP_EM );
	}

	// The icon's presentation is left to the theme. Its position is written by
	// `placeIcon` — the same function the canvas icon goes through — so the two
	// sides cannot end up drawing the same icon with different CSS. What is
	// left is the element it hangs off.

	// Guarded: a theme that has already positioned the title keeps its own
	// value, because turning an absolute title into a relative one would move
	// it.
	if ( 'static' === view.getComputedStyle( wrapper ).position ) {
		wrapper.style.position = 'relative';
	}

	// The placement is absolute now, so the old in-flow class is dead weight:
	// its margin would shift the icon by another gap on top of the measured one
	// (measured 6px where the rule says 4px). Removed before anything is
	// measured, because that margin still counts while the icon is being placed.
	icon.classList.remove(
		'titlesparks-icon--inline',
		'titlesparks-icon--flow'
	);

	// The icon is positioned against its parent and measured against the title
	// text. They are the same node except for a card link's icon.
	placeIcon( doc, icon, wrapper, title, position, {
		...offset,
		fontSize,
		// The author set the offset against the first line, so a title that
		// grows to two or three lines leaves the icon where they put it. A post
		// that chose its own line wins over the site's answer.
		iconAnchor: anchor || iconAnchor(),
		// The space beside the icon: the shipped gap, or none at all for an
		// icon whose picture finishes the word. A post that chose no space of
		// its own follows the site.
		spacing: resolveIconSpacing( spacing, iconSpacing() ),
		// A widget icon is drawn inside a card, which the theme clips, so the
		// site's tight-card answer applies to it. A post's own title keeps the
		// page's space beside it, so nothing is fitted there.
		fit: widget
			? { mode: tightFit(), boundary: fitBoundary( icon, widget ) }
			: null,
		zIndex: iconStackingOrder(),
		// A title-following icon takes the icon size its own title's band asks
		// for; a fixed icon keeps the size the author chose.
		adaptive,
		sizingRules: rules,
		// No clearance is reserved here: a card's icon gets the post's own
		// offsets exactly as its own title does, so the same post looks the
		// same in a widget as on its page.
	} );
};

/**
 * Keep one icon per post.
 *
 * A post's title is often on the page more than once — a related-posts card
 * carries the same title text as the article beside it — and a theme that
 * duplicates a sidebar for small screens copies whatever is inside it, icon
 * included. Each real title occurrence gets an icon, while the same Slick
 * slide is decorated only once even when a plugin replaces its slide node.
 *
 * @return {void}
 */
const dedupe = () => {
	const seen = new Set();

	document.querySelectorAll( `[${ ICON_ATTR }]` ).forEach( ( icon ) => {
		const id = icon.getAttribute( ICON_ATTR );
		const slide = icon.closest( '.slick-slide' );
		const post = id.replace( /-slide-\d+$/, '' );
		const key = slide
			? `${ post }-slide-${ slide.dataset.slickIndex }`
			: id;

		if ( seen.has( key ) ) {
			icon.remove();

			return;
		}

		seen.add( key );
	} );
};

/**
 * Place every icon the server asked for.
 *
 * Insertion and placement happen in the same pass: the icon is in the document
 * before anything is measured, because the measurement reads the title's text
 * and the icon must not be part of it.
 *
 * @return {void}
 */
let titleResizeObserver = null;
const observedTitleBoxes = new Set();

/**
 * Re-place icons whenever their title box or its immediate wrapper changes.
 *
 * Responsive themes can change the title's width, wrapping, or font size without
 * resizing the browser window (for example when opening a sidebar). Observing
 * both the title node and its layout wrapper catches those changes; icon nodes
 * themselves are deliberately excluded so placement cannot observe its own
 * style writes.
 *
 * @return {void}
 */
const observeTitleBoxes = () => {
	if ( ! window.ResizeObserver ) {
		return;
	}

	if ( ! titleResizeObserver ) {
		titleResizeObserver = new window.ResizeObserver( schedule );
	}

	const currentTitleBoxes = new Set();

	document.querySelectorAll( `[${ ICON_ATTR }]` ).forEach( ( icon ) => {
		let box = icon.parentElement;
		let depth = 0;

		while ( box && depth < 2 ) {
			currentTitleBoxes.add( box );
			box = box.parentElement;
			depth++;
		}
	} );

	observedTitleBoxes.forEach( ( box ) => {
		if ( ! currentTitleBoxes.has( box ) ) {
			titleResizeObserver.unobserve( box );
			observedTitleBoxes.delete( box );
		}
	} );

	currentTitleBoxes.forEach( ( box ) => {
		if ( ! observedTitleBoxes.has( box ) ) {
			observedTitleBoxes.add( box );
			titleResizeObserver.observe( box );
		}
	} );
};

const decorate = () => {
	// The stage a reader should see is chosen here, from the boundaries the
	// page carries, so a page served from a full-page cache still changes on
	// time. A reader who asked for less motion gets the still copy of that
	// stage rather than the animated one.
	const reducedMotion = prefersReducedMotion();
	const now = Math.floor( Date.now() / 1000 );
	const list = entries()
		.map( ( entry ) => entryAt( entry, now ) )
		.filter( Boolean )
		.map( ( entry ) =>
			reducedMotion && entry.still
				? { ...entry, url: entry.still }
				: entry
		);

	if ( ! list.length ) {
		return;
	}

	dedupe();
	insertIcons( list, document );
	observeTitleBoxes();

	const siteRules = siteSizingRules();
	const placement = new Map();

	list.forEach( ( entry ) => {
		// The stage that produced this icon says whether it follows the title
		// and which table it is sized from. Advanced carries the stage's own
		// rows, or the site's until it has any; an entry without a mode is
		// drawn at its written size.
		const adaptive = 'advanced' === entry.sizeMode;
		const rules =
			adaptive && Array.isArray( entry.sizingRules )
				? entry.sizingRules
				: siteRules;

		document.querySelectorAll( `[${ ICON_ATTR }]` ).forEach( ( icon ) => {
			const id = icon.getAttribute( ICON_ATTR );
			const widget = icon.closest( `[${ WIDGET_ATTR }]` );
			const widgetPosition =
				widget &&
				widget.getAttribute( 'data-titlesparks-widget-position' );
			const settings = iconPlacementForEntry(
				id,
				entry,
				widgetPosition || undefined
			);

			if ( settings ) {
				placement.set( id, {
					...settings,
					adaptive,
					rules,
					// How this post's icon sits on its title. An entry that carries
					// no answer of its own falls back to the site's.
					anchor: entry.iconAnchor
						? iconAnchorMode( entry.iconAnchor )
						: null,
					spacing: entry.iconSpacing,
				} );
			}
		} );
	} );

	document.querySelectorAll( `[${ ICON_ATTR }]` ).forEach( ( icon ) => {
		const settings = placement.get( icon.getAttribute( ICON_ATTR ) );

		if ( settings ) {
			place(
				icon,
				settings.position,
				settings.offset,
				settings.adaptive,
				settings.rules,
				settings.anchor,
				settings.spacing
			);
		}
	} );

	scheduleStageRefresh( now );
};

let stageTimer = 0;

/**
 * Ask for another pass when the next stage begins.
 *
 * The page carries every boundary, so it can update itself without a request.
 * Only the next boundary within a day is scheduled: a page left open gets the
 * icon the stage asks for when it changes, and a boundary further away is left
 * to the next page load rather than keeping a timer alive for hours.
 *
 * @param {number} now Current time, in seconds.
 * @return {void}
 */
const scheduleStageRefresh = ( now ) => {
	if ( stageTimer ) {
		window.clearTimeout( stageTimer );
		stageTimer = 0;
	}

	const next = nextBoundary( entries(), now );

	if ( null === next ) {
		return;
	}

	const delay = next - now;

	if ( delay <= 0 || delay > STAGE_TIMER_WINDOW ) {
		return;
	}

	stageTimer = window.setTimeout( schedule, delay * 1000 + 1000 );
};

let frame = 0;

/**
 * Coalesce a burst of layout changes into one pass.
 *
 * @return {void}
 */
const schedule = () => {
	if ( frame ) {
		return;
	}

	frame = window.requestAnimationFrame( () => {
		frame = 0;
		decorate();
	} );
};

/**
 * Make the page match what the editor showed, and keep it that way.
 *
 * @return {void}
 */
const start = () => {
	schedule();

	// Web fonts land after the first paint and change how much room the text
	// takes, which moves every icon with it. Images do the same when they push
	// the title down the page.
	if ( document.fonts && document.fonts.ready ) {
		document.fonts.ready.then( schedule );
	}

	window.addEventListener( 'load', schedule, { once: true } );
	window.addEventListener( 'resize', schedule, { passive: true } );

	// A theme that renders its titles late, appends content as the reader
	// scrolls, or changes the title text in place gets its icon as soon as the
	// title exists. Icon placement only changes attributes, which are not
	// observed, so the script does not schedule itself from its own writes.
	if ( window.MutationObserver && document.body ) {
		new window.MutationObserver( schedule ).observe( document.body, {
			childList: true,
			characterData: true,
			subtree: true,
		} );
	}
};

if ( 'loading' === document.readyState ) {
	document.addEventListener( 'DOMContentLoaded', start, { once: true } );
} else {
	start();
}
