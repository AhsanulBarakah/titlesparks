/**
 * Live icon on the editor's own title.
 *
 * WordPress gives no slot to render into the post title, so this component
 * keeps an icon injected next to the title in the canvas. The DOM rules live in
 * `editorTitleDom.js`; this file only decides *which* icon should be showing and
 * keeps it in place while the editor re-renders.
 *
 * The active stage is resolved from the post meta being edited, so the icon
 * follows every change made in the TitleSparks sidebar immediately.
 *
 * Two details here are deliberate, because getting them wrong makes the canvas
 * silently ignore edits made in the sidebar:
 *
 *   1. The store selector returns the raw meta *string*, not the meta object.
 *      A selector that returns an object is at the mercy of the store's
 *      equality check, and when that check decides the object is unchanged the
 *      component stops re-rendering while the sidebar happily carries on.
 *      Selecting a primitive cannot go wrong.
 *   2. Every dependency of the DOM effect is a primitive too, for the same
 *      reason: an object dependency that is re-created (or quietly re-used) on
 *      every render can suppress the effect run that moves the icon.
 */

import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';

import {
	META_KEY_FALLBACK,
	iconAnchorMode,
	iconSpacingMode,
	iconZIndex,
	resolveIconSpacing,
	offsetFor,
	readTimelineFromJson,
	editorAnchor,
	resolveTimeline,
	resolveTitleIcon,
	siteNowSeconds,
} from './constants';
import { publishPreview } from './editorPreview';
import {
	canvasDocuments,
	editorTitleTarget,
	removeEditorIcon,
	syncEditorIcon,
} from './editorTitleDom';
import { getEditorData, useAssetLibrary } from './useAssetLibrary';

const boot = getEditorData();
const META_KEY = boot.metaKey || META_KEY_FALLBACK;

// The canvas has to measure the icon the same way the page does, so the site's
// answer for what Y counts from travels with the rest of the bootstrap. This
// post's own answer, when it has one, is read from the edited timeline below because
// it changes while the sidebar is open.
const SITE_ICON_ANCHOR = iconAnchorMode( boot.iconAnchor );
const SITE_ICON_SPACING = iconSpacingMode( boot.iconSpacing );

// The site's stacking order, so an icon moved over the words is drawn where
// the author sees it on the page.
const ICON_Z_INDEX = iconZIndex( boot.iconZIndex );

// The site's bands for a title-following icon. A stage can carry its own
// table; when it does not, the canvas draws the site's, exactly as the page
// will.
const SITE_SIZING_RULES = Array.isArray( boot.sizingRules )
	? boot.sizingRules
	: null;

// Captured once so the elapsed browser time since the server snapshot can be
// added to `boot.now` and the stage keeps advancing while the editor is open.
const BOOT_LOADED_AT = Date.now();

// Only the stage boundary matters here; a half-minute refresh is plenty.
const TICK_MS = 30000;

// How often, and for how long, the canvas is asked for the icon while it is
// still booting. WordPress renders the title into the canvas well before the
// canvas has settled, and the wrapper it renders into can be replaced after
// this component has already attached its observers — no document we watch
// changes after that, so without a retry the icon never appears. Measured on
// the reference site: the canvas settled 6.5s after the title was on screen,
// and a load that attached later than that showed no icon at all.
const RETRY_MS = 500;
const RETRY_WINDOW_MS = 15000;

/**
 * EditorTitleIcon component.
 *
 * Renders nothing; it only manages the injected canvas node.
 *
 * @return {null} Always null.
 */
const EditorTitleIcon = () => {
	const metaJson = useSelect( ( select ) => {
		const editor = select( editorStore );
		const current = editor.getEditedPostAttribute( 'meta' );

		return ( current && current[ META_KEY ] ) || '';
	}, [] );

	const { assets } = useAssetLibrary();
	const timeline = useMemo(
		() => readTimelineFromJson( metaJson, boot ),
		[ metaJson ]
	);

	const [ now, setNow ] = useState( () => siteNowSeconds( boot, 0 ) );

	useEffect( () => {
		const timer = window.setInterval(
			() => setNow( siteNowSeconds( boot, Date.now() - BOOT_LOADED_AT ) ),
			TICK_MS
		);

		return () => window.clearInterval( timer );
	}, [] );

	const resolved = useMemo(
		() => resolveTimeline( timeline, editorAnchor( boot ), now ),
		[ timeline, now ]
	);

	// One derivation, shared with the sidebar's readout.
	const icon = resolveTitleIcon( {
		timeline,
		assets,
		resolved,
		isEnabled: boot.isEnabled,
	} );

	// Flat primitives, so the DOM effect below cannot be skipped by an
	// unchanged object reference.
	const { show, position } = icon;
	const assetUrl = icon.url;
	const assetSize = icon.size;
	const titleSizeMode = icon.sizeMode;
	const assetFixedSize = icon.fixedSize;
	const assetFlip = icon.flip;
	// Advanced is the mode that follows the title, from the stage's own table
	// when it has one and the site's otherwise — which is what the page draws
	// too. Held as a string so the DOM effect below gets a stable primitive
	// dependency rather than a freshly allocated array on every render.
	const sizingRules =
		'advanced' === titleSizeMode && icon.sizingRules.length
			? icon.sizingRules
			: SITE_SIZING_RULES;
	const sizingRulesJson = JSON.stringify( sizingRules || [] );
	// The nudge belongs to the position, so it travels with it. It is applied
	// here exactly as stored, which is what makes an empty nudge (0, 0) centre
	// the icon on the title in the canvas precisely as it does on the page.
	const { x: offsetX, y: offsetY } = offsetFor( timeline, position );

	// How this post's icon sits on its title. The timeline carries the author's
	// own answer, or an empty string for "follow the site" — and this is read on
	// every render, so picking a different line redraws the icon at once.
	const iconAnchor = timeline.icon_anchor
		? iconAnchorMode( timeline.icon_anchor )
		: SITE_ICON_ANCHOR;
	const iconSpacing = resolveIconSpacing(
		timeline.icon_spacing,
		SITE_ICON_SPACING
	);

	// The identity of the icon node — what it is, not where it sits. The nudge
	// is applied by re-measuring the icon in place, so typing or holding an
	// arrow key moves the picture instead of rebuilding it: a rebuilt `<img>`
	// restarts an animated GIF and re-decodes it, which is what made a small
	// offset adjustment look like the icon flickering rather than sliding.
	// Asset, size, position and mirror still rebuild, because those change the
	// node's own content or side.
	const signature = `${ assetUrl }|${ assetSize }|${ position }|${ assetFlip }`;
	const stageNumber = icon.stage;
	const assetLabel = icon.label;

	// Report back what the canvas resolved to, so the sidebar can state what is
	// on the title rather than leaving the author to read the canvas.
	useEffect( () => {
		publishPreview( {
			show,
			stage: stageNumber,
			position,
			label: assetLabel,
		} );
	}, [ show, stageNumber, position, assetLabel ] );

	// The icon as the canvas should draw it right now. A ref, because the
	// observers below outlive the render that installed them and must
	// re-measure with the newest numbers — the offset typed a moment ago, not
	// the one that was current when the canvas first appeared.
	const placement = useRef( null );

	// Apply each edit on the commit it is made in, and remember it for those
	// observers. Kept in an effect rather than written during render, so the
	// ref is only ever touched after a commit. This effect does not own the
	// observers: a nudge costs one measurement, not the canvas wiring.
	useEffect( () => {
		placement.current = show
			? {
					asset: {
						url: assetUrl,
						size: assetSize,
						fixedSize: assetFixedSize,
						sizeMode: titleSizeMode,
						flip: assetFlip,
					},
					position,
					signature,
					offsetX,
					offsetY,
					iconAnchor,
					spacing: iconSpacing,
					zIndex: ICON_Z_INDEX,
					sizingRules: JSON.parse( sizingRulesJson ),
				}
			: null;

		if ( placement.current ) {
			syncEditorIcon( placement.current );
		}
	}, [
		show,
		assetUrl,
		assetSize,
		assetFixedSize,
		assetFlip,
		titleSizeMode,
		position,
		signature,
		offsetX,
		offsetY,
		sizingRulesJson,
		iconAnchor,
		iconSpacing,
	] );

	// Watch the canvas. This runs once per "is there an icon at all", so a
	// nudge never tears the observers down and builds them again — it only
	// re-measures the icon that is already there.
	useEffect( () => {
		if ( ! show ) {
			removeEditorIcon();

			return undefined;
		}

		let frame = 0;
		const watched = new Set();
		const observers = [];
		const resizers = [];

		/**
		 * Insert, move or keep the icon, and re-watch whatever moved.
		 *
		 * @return {void}
		 */
		const run = () => {
			frame = 0;
			watch();

			if ( placement.current ) {
				syncEditorIcon( placement.current );
			}
		};

		/**
		 * Follow every document the title could be rendered into.
		 *
		 * @return {void}
		 */
		function watch() {
			canvasDocuments().forEach( ( doc ) => {
				if ( watched.has( doc ) ) {
					return;
				}

				// The canvas iframe is replaced while the editor boots, and its
				// replacement may be an empty document for a frame. Skip it
				// for this pass rather than throwing; the next mutation after
				// it has loaded retries, and the icon is placed then.
				const root = doc.body || doc.documentElement;

				if ( ! root ) {
					return;
				}

				watched.add( doc );

				// Taken from the document's own realm: inside the canvas
				// iframe the observers must belong to that window, not the
				// admin one.
				const view = doc.defaultView || window;

				const mutations = new view.MutationObserver( schedule );
				mutations.observe( root, {
					childList: true,
					// A text node is mutated in place as the title is typed,
					// which is not a childList change.
					characterData: true,
					subtree: true,
				} );

				observers.push( mutations );

				// Opening the editor sidebar resizes the canvas without
				// changing its DOM, so watching mutations alone would leave
				// the icon stranded.
				if ( view.ResizeObserver ) {
					resizers.push( new view.ResizeObserver( schedule ) );
				}
			} );

			const target = editorTitleTarget();

			if ( target ) {
				resizers.forEach( ( resize ) => {
					resize.observe( target.wrapper );
					resize.observe( target.title );
				} );
			}
		}

		/**
		 * Coalesce a burst of mutations into one pass.
		 *
		 * @return {void}
		 */
		function schedule() {
			if ( ! frame ) {
				frame = window.requestAnimationFrame( run );
			}
		}

		watch();
		run();

		// Ask again while the canvas is still coming up. A title on screen is
		// not proof the canvas has settled: WordPress re-centres the title as
		// the window narrows, and a placement measured during that transition
		// stays where it was until something moves the icon. `run` is
		// idempotent, so a retry costs one measurement, never a rebuilt icon.
		const retry = window.setInterval( run, RETRY_MS );
		const giveUp = window.setTimeout(
			() => window.clearInterval( retry ),
			RETRY_WINDOW_MS
		);

		return () => {
			if ( frame ) {
				window.cancelAnimationFrame( frame );
			}

			window.clearInterval( retry );
			window.clearTimeout( giveUp );
			observers.forEach( ( observer ) => observer.disconnect() );
			resizers.forEach( ( resize ) => resize.disconnect() );
			removeEditorIcon();
		};
	}, [ show ] );

	return null;
};

export default EditorTitleIcon;
