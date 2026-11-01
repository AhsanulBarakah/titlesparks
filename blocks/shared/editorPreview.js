/**
 * Shared editor preview state.
 *
 * The canvas icon and plugin sidebar are rendered in different places, so the
 * sidebar subscribes to the state the canvas actually resolved (stage,
 * position, asset). That keeps the live readout and stage highlight tied to the
 * timeline, never to whichever controls the author is editing.
 *
 * A module-level store rather than React context: the sidebar's children are
 * rendered by their slot rather than at the point they are declared, so context
 * created next to the icon would not reliably reach them.
 */

import { useEffect, useState } from '@wordpress/element';

/**
 * What the canvas icon is showing. `stage` is 0 when nothing is showing.
 */
const NOTHING_SHOWING = {
	show: false,
	stage: 0,
	position: 'left',
	label: '',
};

let published = NOTHING_SHOWING;

const publishedListeners = new Set();

/**
 * The state the canvas icon last resolved to.
 *
 * @return {Object} Published state.
 */
export const getPreviewState = () => published;

/**
 * Record what the canvas icon is showing.
 *
 * Called by the canvas component itself rather than derived again in the
 * sidebar, so what the panel reports is what the canvas really did — two
 * independent derivations of the same value can disagree, and then the readout
 * would hide the very bug it exists to expose.
 *
 * @param {Object}  state
 * @param {boolean} state.show     Whether an icon is on the title.
 * @param {number}  state.stage    Stage being shown (0 when nothing is).
 * @param {string}  state.position Position keyword.
 * @param {string}  state.label    Name of the asset being shown.
 * @return {void}
 */
export const publishPreview = ( state ) => {
	const { show, stage, position, label } = state;
	const next = show
		? { show: true, stage, position, label }
		: NOTHING_SHOWING;

	// Publish is called from an effect on every relevant change; bail out when
	// nothing differs so subscribers are not woken for no reason.
	if (
		next.show === published.show &&
		next.stage === published.stage &&
		next.position === published.position &&
		next.label === published.label
	) {
		return;
	}

	published = next;

	publishedListeners.forEach( ( listener ) => listener() );
};

/**
 * Subscribe to the published canvas state.
 *
 * @return {Object} Current state.
 */
export const usePreviewState = () => {
	const [ value, setValue ] = useState( getPreviewState );

	useEffect( () => {
		const listener = () => setValue( getPreviewState() );

		publishedListeners.add( listener );

		// The canvas may have published before this subscriber mounted, so take
		// the current value too rather than showing an empty readout.
		listener();

		return () => publishedListeners.delete( listener );
	}, [] );

	return value;
};
