/**
 * Calendar and time helpers for a stage's end.
 *
 * A stage stores how long it runs, but an author thinks in "this icon until
 * the 20th at 14:30". Stages are contiguous — each one starts where the last
 * ended — so the end of a stage is the whole story: pick it and the length
 * falls out, measured from the point the timeline starts.
 *
 * Everything here works in site-clock seconds: the wall clock the site runs
 * on, worn as a UTC label. `siteTimeToSeconds()` builds one from the strings
 * the server inlines, and `siteMomentValue()` prints one back for a
 * `datetime-local` input, so a value the author types is the value the front
 * end will decay against — the browser's own timezone never enters into it.
 */

import {
	STAGE_INDEXES,
	emptyStage,
	formatSiteMoment,
	siteTimeToSeconds,
	stageSeconds,
	totalSeconds,
	unitSeconds,
} from './constants';

/**
 * The last stage of a timeline.
 */
const LAST_STAGE = STAGE_INDEXES[ STAGE_INDEXES.length - 1 ];

/**
 * The anchor a timeline resolves from: its own if it has one, else the one
 * handed in (the site's "timeline starts" setting, or the post date).
 *
 * @param {Object} timeline   Timeline.
 * @param {string} anchorDate Fallback anchor (`Y-m-d H:i:s`).
 * @return {string} Anchor, or an empty string when there is none.
 */
export const anchorValue = ( timeline, anchorDate ) =>
	( timeline || {} ).anchor || anchorDate || '';

/**
 * Print site-clock seconds as a `datetime-local` value.
 *
 * @param {number} seconds Site-clock seconds.
 * @return {string} e.g. "2026-10-20T14:32", or an empty string.
 */
export const siteMomentValue = ( seconds ) =>
	Number.isFinite( seconds )
		? new Date( seconds * 1000 ).toISOString().slice( 0, 16 )
		: '';

/**
 * Read a `datetime-local` value back into site-clock seconds.
 *
 * @param {string} value e.g. "2026-10-20T14:32".
 * @return {number|null} Seconds, or null when the field is empty.
 */
export const siteMomentSeconds = ( value ) => {
	if ( ! value ) {
		return null;
	}

	return siteTimeToSeconds( `${ String( value ).slice( 0, 16 ) }:00` );
};

/**
 * Seconds from the anchor to the start of a stage.
 *
 * A stage starts where the one before it ends, so this is the sum of the
 * lengths that come before it. Stage 1 starts at the anchor itself.
 *
 * @param {Object} timeline Timeline.
 * @param {number} index    Stage index (1-3).
 * @return {number} Seconds (never negative).
 */
export const stageStartOffset = ( timeline, index ) => {
	let offset = 0;

	for ( let step = 1; step < index; step++ ) {
		offset += stageSeconds( timeline[ `stage_${ step }` ] );
	}

	return offset;
};

/**
 * Seconds from the anchor to the end of a stage.
 *
 * @param {Object} timeline Timeline.
 * @param {number} index    Stage index (1-3).
 * @return {number} Seconds.
 */
export const stageEndOffset = ( timeline, index ) =>
	stageStartOffset( timeline, index ) +
	stageSeconds( timeline[ `stage_${ index }` ] );

/**
 * The end of a stage, as a `datetime-local` value.
 *
 * A zero length stage is not an exception: it ends when the stage before it
 * does, which is exactly the moment this returns.
 *
 * @param {Object} timeline   Timeline.
 * @param {number} index      Stage index (1-3).
 * @param {string} anchorDate Anchor (`Y-m-d H:i:s`), when the timeline has none.
 * @return {string} e.g. "2026-10-20T14:32", or an empty string without an anchor.
 */
export const stageEndValue = ( timeline, index, anchorDate ) => {
	const anchor = siteTimeToSeconds( anchorValue( timeline, anchorDate ) );

	if ( anchor === null ) {
		return '';
	}

	return siteMomentValue( anchor + stageEndOffset( timeline, index ) );
};

/**
 * The moment a stage starts, as a `datetime-local` value.
 *
 * @param {Object} timeline   Timeline.
 * @param {number} index      Stage index (1-3).
 * @param {string} anchorDate Anchor (`Y-m-d H:i:s`), when the timeline has none.
 * @return {string} e.g. "2026-10-20T14:32", or an empty string without an anchor.
 */
export const stageStartValue = ( timeline, index, anchorDate ) => {
	const anchor = siteTimeToSeconds( anchorValue( timeline, anchorDate ) );

	if ( anchor === null ) {
		return '';
	}

	return siteMomentValue( anchor + stageStartOffset( timeline, index ) );
};

/**
 * Split a length in seconds into a whole duration and the unit to store it in.
 *
 * The largest unit that divides the length exactly wins, so a stage that runs
 * for two days stays "2 days" rather than becoming 2880 minutes; the finer
 * units appear only when one of them is what the end date actually needs.
 *
 * @param {number} seconds Length in seconds.
 * @return {{duration: number, unit: string}} Duration and unit.
 */
export const durationParts = ( seconds ) => {
	const whole = Math.max( 0, Math.round( seconds / 60 ) * 60 );

	if ( whole > 0 && whole % unitSeconds( 'days' ) === 0 ) {
		return { duration: whole / unitSeconds( 'days' ), unit: 'days' };
	}

	if ( whole > 0 && whole % unitSeconds( 'hours' ) === 0 ) {
		return { duration: whole / unitSeconds( 'hours' ), unit: 'hours' };
	}

	return { duration: whole / unitSeconds( 'minutes' ), unit: 'minutes' };
};

/**
 * A stage rebalanced so that it ends at the picked date and time.
 *
 * The length is stored in the timeline's own terms, because that is what the
 * decay maths reads: the picked moment becomes a number of seconds from where
 * the stage starts, which is the sum of the lengths before it.
 *
 * An empty `value` — or one at or before the start of the stage — makes the
 * stage zero length, which is how an author leaves a stage out: it ends when
 * the stage before it does, and the timeline skips straight past it.
 *
 * @param {Object} timeline   Timeline.
 * @param {number} index      Stage index (1-3).
 * @param {string} anchorDate Anchor (`Y-m-d H:i:s`), when the timeline has none.
 * @param {string} value      `datetime-local` value for the end.
 * @return {Object|null} The next stage value, or null when it cannot be worked out.
 */
export const withStageEnd = ( timeline, index, anchorDate, value ) => {
	const anchor = siteTimeToSeconds( anchorValue( timeline, anchorDate ) );

	if ( anchor === null ) {
		return null;
	}

	const stage = emptyStage( timeline[ `stage_${ index }` ] );
	const end = siteMomentSeconds( value );

	if ( end === null ) {
		return { ...stage, duration: 0, unit: 'minutes' };
	}

	const length = end - anchor - stageStartOffset( timeline, index );

	// A stage that would end before it starts is not a stage: the end picker
	// offers no such moment, so this is the field being driven by something
	// else — an old saved value, or a stage moved earlier than its start.
	if ( length <= 0 ) {
		return { ...stage, duration: 0, unit: 'minutes' };
	}

	return { ...stage, ...durationParts( length ) };
};

/**
 * The moment the last stage ends, for the sidebar's timeline readout.
 *
 * The last stage is the end of the timeline even when the icon is kept: that
 * is the moment it stops changing.
 *
 * @param {Object} timeline   Timeline.
 * @param {string} anchorDate Anchor (`Y-m-d H:i:s`), when the timeline has none.
 * @return {string} e.g. "Oct 25, 2026, 14:32", or an empty string.
 */
export const timelineEndLabel = ( timeline, anchorDate ) => {
	const anchor = siteTimeToSeconds( anchorValue( timeline, anchorDate ) );

	if ( anchor === null ) {
		return '';
	}

	return formatSiteMoment( anchor + stageEndOffset( timeline, LAST_STAGE ) );
};

/**
 * Seconds until the timeline ends, measured from its actual anchor.
 *
 * The editor passes its site-clock "now" so the number agrees with the canvas
 * stage resolver and can be refreshed on a timer. A missing/invalid anchor is
 * distinct from an elapsed timeline: the former returns null, the latter zero.
 *
 * @param {Object} timeline   Timeline.
 * @param {string} anchorDate Anchor (`Y-m-d H:i:s`), when the timeline has none.
 * @param {number} now        Current site-clock seconds.
 * @return {number|null} Remaining seconds, clamped to zero, or null without an anchor.
 */
export const timelineRemainingSeconds = ( timeline, anchorDate, now ) => {
	const anchor = siteTimeToSeconds( anchorValue( timeline, anchorDate ) );

	if ( anchor === null || ! Number.isFinite( now ) ) {
		return null;
	}

	return Math.max( 0, anchor + totalSeconds( timeline ) - now );
};
