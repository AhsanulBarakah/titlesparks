/**
 * Choosing the live stage of a cached timeline.
 *
 * A page can sit in a full-page cache for hours, so the server cannot decide
 * which stage a reader should see: it writes every stage's start and end into
 * the page, and the browser compares them with its own clock. The rules mirror
 * `Title_Sparks\Decay::resolve()` — a zero length stage is skipped, the timeline
 * starts at the anchor, and once every stage has elapsed the `keep` behaviour
 * shows the newest stage that has an icon while `remove` draws nothing.
 */

/**
 * Fields a stage contributes to its entry.
 *
 * The choice is made on every pass, so an icon that has changed stage has to be
 * described by the stage that is live rather than by the one the server saw.
 */
const STAGE_FIELDS = [
	'url',
	'still',
	'size',
	'sizeMode',
	'sizingRules',
	'position',
	'offsetX',
	'offsetY',
	'flip',
	'alt',
];

/**
 * The entry as one stage describes it.
 *
 * @param {Object} entry Entry the server wrote.
 * @param {Object} stage Stage row from `entry.stages`.
 * @return {Object} Entry with the stage's own values.
 */
const withStage = ( entry, stage ) =>
	STAGE_FIELDS.reduce(
		( merged, field ) =>
			undefined === stage[ field ]
				? merged
				: { ...merged, [ field ]: stage[ field ] },
		{ ...entry }
	);

/**
 * The entry a reader should see at one moment.
 *
 * @param {Object} entry Entry the server wrote.
 * @param {number} now   Current time, in seconds.
 * @return {Object|null} The entry with its live stage, or null when the
 *                       timeline shows nothing.
 */
export const entryAt = ( entry, now ) => {
	const stages = entry && Array.isArray( entry.stages ) ? entry.stages : [];

	// A payload without the stage list is drawn from the fields the server
	// resolved, which is what the editor preview builds.
	if ( ! stages.length ) {
		return entry && entry.url ? entry : null;
	}

	const live = stages.find(
		( stage ) => stage.end > stage.start && now < stage.end
	);

	if ( live ) {
		return live.url ? withStage( entry, live ) : null;
	}

	if ( 'remove' === entry.stage3Behaviour ) {
		return null;
	}

	for ( let index = stages.length - 1; index >= 0; index-- ) {
		if ( stages[ index ].url ) {
			return withStage( entry, stages[ index ] );
		}
	}

	return null;
};

/**
 * The next stage boundary after a moment, in Unix time.
 *
 * @param {Array}  entries Entries the server wrote.
 * @param {number} now     Current time, in seconds.
 * @return {number|null} The nearest boundary ahead, or null when none is.
 */
export const nextBoundary = ( entries, now ) => {
	let next = null;

	( Array.isArray( entries ) ? entries : [] ).forEach( ( entry ) => {
		const stages = Array.isArray( entry.stages ) ? entry.stages : [];

		stages.forEach( ( stage ) => {
			if ( stage.end > now && ( null === next || stage.end < next ) ) {
				next = stage.end;
			}
		} );
	} );

	return next;
};
