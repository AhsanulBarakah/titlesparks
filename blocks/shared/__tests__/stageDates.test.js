/**
 * A stage is edited by the moment its icon stops, not by a number of days.
 *
 * The two have to agree exactly, and they are not the same kind of value: what
 * the author picks is a date and a time on the site's clock, and what the decay
 * maths reads is a length in seconds counted from where the stage starts —
 * which is the sum of the lengths before it, because the stages are contiguous.
 * Nothing at run time compares the two: the picker writes a length and the
 * front end reads it.
 *
 * The time part is the part worth pinning down. A stage that ends at 14:30 has
 * to store a length that lands back on 14:30, in minutes rather than a rounded
 * number of days, and the moment has to be read on the *site's* clock: the
 * strings the server inlines carry no offset, so parsing them against the
 * browser's own timezone would print a different time — and, near midnight, a
 * different day — than the one the author typed.
 */

import {
	editorAnchor,
	emptyStage,
	emptyTimeline,
	formatSeconds,
	formatStageWindow,
	formatTotal,
	maxForUnit,
	stageSeconds,
	unitSeconds,
} from '../constants';
import {
	anchorValue,
	durationParts,
	stageEndOffset,
	stageEndValue,
	stageStartOffset,
	stageStartValue,
	timelineEndLabel,
	timelineRemainingSeconds,
	withStageEnd,
} from '../stageDates';

/**
 * Build a timeline whose stages last for the given numbers of minutes.
 *
 * @param {...number} minutes One length per stage.
 * @return {Object} Timeline.
 */
const timelineOf = ( ...minutes ) => {
	const timeline = emptyTimeline( {} );

	minutes.forEach( ( value, position ) => {
		timeline[ `stage_${ position + 1 }` ] = {
			...emptyStage( {} ),
			duration: value,
			unit: 'minutes',
		};
	} );

	return timeline;
};

const ANCHOR = '2026-10-20 09:00:00';

describe( 'the minutes unit', () => {
	it( 'is a real length, not a rounded day', () => {
		expect( stageSeconds( { duration: 90, unit: 'minutes' } ) ).toBe(
			5400
		);
		expect( unitSeconds( 'minutes' ) ).toBe( 60 );
	} );

	it( 'is allowed as deep as the other units', () => {
		expect( maxForUnit( 'minutes' ) ).toBe( 3650 * 24 * 60 );
	} );

	it( 'survives normalisation', () => {
		expect( emptyStage( { duration: 45, unit: 'minutes' } ) ).toEqual( {
			asset_id: '',
			position: 'left',
			flip: false,
			duration: 45,
			unit: 'minutes',
			size: '',
			size_mode: 'fixed',
			sizing_rules: [],
		} );
	} );

	it( 'reads as minutes in the timeline total', () => {
		expect( formatSeconds( 5400 ) ).toBe( '1 hour 30 minutes' );
		expect( formatTotal( timelineOf( 30, 0, 60 ) ) ).toBe(
			'1 hour 30 minutes'
		);
	} );

	it( 'keeps a half hour from being called an hour', () => {
		expect( formatSeconds( 1800 ) ).toBe( '30 minutes' );
	} );
} );

describe( 'the end of a stage', () => {
	it( 'is the anchor plus everything before it', () => {
		const timeline = timelineOf( 60, 30, 15 );

		expect( stageStartOffset( timeline, 1 ) ).toBe( 0 );
		expect( stageStartOffset( timeline, 2 ) ).toBe( 3600 );
		expect( stageEndOffset( timeline, 3 ) ).toBe( 6300 );
	} );

	it( 'reads on the site clock, not the browser one', () => {
		const timeline = timelineOf( 90 );

		// 09:00 + 90 minutes is 10:30 wherever the visitor happens to be.
		expect( stageEndValue( timeline, 1, ANCHOR ) ).toBe(
			'2026-10-20T10:30'
		);
	} );

	it( 'rolls over midnight', () => {
		const timeline = timelineOf( 3 * 24 * 60 );

		expect( stageEndValue( timeline, 1, ANCHOR ) ).toBe(
			'2026-10-23T09:00'
		);
	} );

	it( 'starts a stage where the one before it ended', () => {
		const timeline = timelineOf( 90, 30 );

		expect( stageStartValue( timeline, 2, ANCHOR ) ).toBe(
			'2026-10-20T10:30'
		);
	} );

	it( 'has no value without an anchor to count from', () => {
		expect( stageEndValue( timelineOf( 90 ), 1, '' ) ).toBe( '' );
		expect( stageStartValue( timelineOf( 90 ), 1, '' ) ).toBe( '' );
	} );
} );

describe( 'picking a new end', () => {
	it( 'stores the length the picked moment implies', () => {
		const timeline = timelineOf( 60 );

		expect(
			withStageEnd( timeline, 1, ANCHOR, '2026-10-22T09:00' )
		).toEqual( {
			asset_id: '',
			position: 'left',
			flip: false,
			duration: 2,
			unit: 'days',
			size: '',
			size_mode: 'fixed',
			sizing_rules: [],
		} );
	} );

	it( 'measures the stage, not the whole timeline', () => {
		// Stage 1 runs for an hour; stage 2 ends two hours after the anchor, so
		// stage 2 itself is an hour long — not the two hours the whole timeline
		// would measure.
		const timeline = timelineOf( 60, 60 );

		expect(
			withStageEnd( timeline, 2, ANCHOR, '2026-10-20T11:00' )
		).toEqual( {
			asset_id: '',
			position: 'left',
			flip: false,
			duration: 1,
			unit: 'hours',
			size: '',
			size_mode: 'fixed',
			sizing_rules: [],
		} );
	} );

	it( 'stays exact to the minute', () => {
		const timeline = timelineOf( 60 );

		expect(
			withStageEnd( timeline, 1, ANCHOR, '2026-10-20T14:37' )
		).toEqual( {
			asset_id: '',
			position: 'left',
			flip: false,
			duration: 337,
			unit: 'minutes',
			size: '',
			size_mode: 'fixed',
			sizing_rules: [],
		} );
	} );

	it( 'keeps the largest unit that divides the length exactly', () => {
		expect( durationParts( 2 * 86400 ) ).toEqual( {
			duration: 2,
			unit: 'days',
		} );
		expect( durationParts( 30 * 3600 ) ).toEqual( {
			duration: 30,
			unit: 'hours',
		} );
		expect( durationParts( 90 * 60 ) ).toEqual( {
			duration: 90,
			unit: 'minutes',
		} );
	} );

	it( 'skips the stage when the field is cleared', () => {
		const timeline = timelineOf( 60, 60 );

		expect( withStageEnd( timeline, 2, ANCHOR, '' ) ).toEqual( {
			asset_id: '',
			position: 'left',
			flip: false,
			duration: 0,
			unit: 'minutes',
			size: '',
			size_mode: 'fixed',
			sizing_rules: [],
		} );
	} );

	it( 'skips the stage rather than ending before it starts', () => {
		const timeline = timelineOf( 120, 60 );

		expect(
			withStageEnd( timeline, 2, ANCHOR, '2026-10-20T09:30' )
		).toEqual( {
			asset_id: '',
			position: 'left',
			flip: false,
			duration: 0,
			unit: 'minutes',
			size: '',
			size_mode: 'fixed',
			sizing_rules: [],
		} );
	} );

	it( 'round trips: the value it stores reads back as the same moment', () => {
		const before = timelineOf( 60, 60, 60 );
		const next = {
			...before,
			stage_2: withStageEnd( before, 2, ANCHOR, '2026-10-20T11:45' ),
		};

		expect( stageEndValue( next, 2, ANCHOR ) ).toBe( '2026-10-20T11:45' );
	} );

	it( 'answers with nothing when there is no anchor', () => {
		expect(
			withStageEnd( timelineOf( 60 ), 1, '', '2026-10-22T09:00' )
		).toBe( null );
	} );
} );

describe( 'the anchor a timeline resolves from', () => {
	it( 'prefers the one stored on the post', () => {
		expect( anchorValue( { anchor: '2026-01-01 08:00:00' }, ANCHOR ) ).toBe(
			'2026-01-01 08:00:00'
		);
	} );

	it( 'falls back to the one it is handed', () => {
		expect( anchorValue( {}, ANCHOR ) ).toBe( ANCHOR );
		expect( anchorValue( {}, '' ) ).toBe( '' );
	} );

	it( 'prefers the site setting in the editor bootstrap', () => {
		expect(
			editorAnchor( { anchor: ANCHOR, postDate: '2026-01-01 00:00:00' } )
		).toBe( ANCHOR );
		expect( editorAnchor( { postDate: '2026-01-01 00:00:00' } ) ).toBe(
			'2026-01-01 00:00:00'
		);
		expect( editorAnchor( {} ) ).toBe( '' );
	} );
} );

describe( 'the window a stage occupies', () => {
	it( 'prints both ends with the time, on the site clock', () => {
		const label = formatStageWindow( timelineOf( 90 ), 1, ANCHOR );

		expect( label ).toMatch( /09:00/ );
		expect( label ).toMatch( /10:30/ );
		expect( label ).toContain( '2026' );
	} );

	it( 'uses the anchor stored on the timeline when there is one', () => {
		const timeline = { ...timelineOf( 60 ), anchor: ANCHOR };
		const label = formatStageWindow( timeline, 1, '2026-01-01 00:00:00' );

		expect( label ).toMatch( /09:00/ );
		expect( label ).toMatch( /10:00/ );
	} );

	it( 'says so when the stage has no icon at all', () => {
		expect( formatStageWindow( timelineOf( 0 ), 1, ANCHOR ) ).toMatch(
			/ends when the stage before it does/
		);
	} );

	it( 'is empty without an anchor', () => {
		expect( formatStageWindow( timelineOf( 60 ), 1, '' ) ).toBe( '' );
	} );

	it( 'names the moment the last stage ends', () => {
		const label = timelineEndLabel( timelineOf( 60, 60, 60 ), ANCHOR );

		expect( label ).toMatch( /2026/ );
		expect( label ).toMatch( /12:00/ );
	} );

	it( 'counts down to the end from the actual timeline anchor', () => {
		const timeline = { ...timelineOf( 60, 60, 60 ), anchor: ANCHOR };
		const now =
			Math.floor( Date.parse( '2026-10-20T09:00:00Z' ) / 1000 ) + 90 * 60;

		expect(
			timelineRemainingSeconds( timeline, '2026-01-01 00:00:00', now )
		).toBe( 90 * 60 );
		expect(
			timelineRemainingSeconds( timeline, '', now + 3 * 60 * 60 )
		).toBe( 0 );
		expect( timelineRemainingSeconds( timelineOf( 60 ), '', now ) ).toBe(
			null
		);
	} );
} );
