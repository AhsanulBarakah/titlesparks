/**
 * Show a still frame now, the animation shortly after.
 *
 * A library of animated GIFs is the point of this plugin, and an animated GIF
 * is routinely several megabytes: the ones on this site are 3.9 MB and 743 KB
 * for images that are drawn 64 pixels tall in a grid. Waiting for them is what
 * makes the library tab feel slow, and painting them at full size costs the
 * same bytes whether they are above or below the fold.
 *
 * So a grid draws WordPress' own intermediate size first — one frame, a
 * fraction of the bytes — and swaps in the original once the page has nothing
 * more urgent to do. The card looks finished immediately, the animation follows
 * when the browser is idle, and nothing about the file the front end uses
 * changes: that is still the original.
 *
 * Cards upgrade one at a time. Firing every multi-megabyte request in the same
 * frame would queue the whole library at once and hand back the stall the
 * previews were meant to remove.
 */

import { useEffect, useState } from '@wordpress/element';

/**
 * Gap between two cards starting their upgrade, in milliseconds.
 */
const STAGGER = 150;

/**
 * How many slots the stagger runs to before wrapping.
 */
const SLOTS = 8;

/**
 * Next stagger slot handed out on this page.
 *
 * @type {number}
 */
let slots = 0;

/**
 * Run a callback when the browser is idle.
 *
 * @param {Function} callback Work to run.
 * @return {Function} Cancels the pending callback.
 */
const whenIdle = ( callback ) => {
	if (
		typeof window !== 'undefined' &&
		typeof window.requestIdleCallback === 'function'
	) {
		const handle = window.requestIdleCallback( callback, {
			timeout: 3000,
		} );

		return () => window.cancelIdleCallback( handle );
	}

	const handle = setTimeout( callback, STAGGER );

	return () => clearTimeout( handle );
};

/**
 * The source a preview should draw right now.
 *
 * @param {string} preview  Small still copy, if the server found one.
 * @param {string} original The file itself.
 * @return {string} The source to render.
 */
export const useDeferredPreview = ( preview, original ) => {
	const still = preview || original || '';
	const [ src, setSrc ] = useState( still );

	useEffect( () => {
		// The card can be reused for another asset after a save, in which case
		// the still frame is the honest thing to draw again.
		setSrc( preview || original || '' );

		const target = original || '';

		// Nothing to upgrade to, or the still copy *is* the original.
		if ( ! target || target === preview ) {
			return undefined;
		}

		const slot = slots++ % SLOTS;
		let cancelIdle = null;
		let cancelled = false;

		const timer = setTimeout( () => {
			cancelIdle = whenIdle( () => {
				if ( ! cancelled ) {
					setSrc( target );
				}
			} );
		}, slot * STAGGER );

		return () => {
			cancelled = true;
			clearTimeout( timer );

			if ( cancelIdle ) {
				cancelIdle();
			}
		};
	}, [ preview, original ] );

	return src;
};

export default useDeferredPreview;
