/**
 * The stage a cached page chooses for itself.
 *
 * The page carries every stage's boundaries, so these assertions are the
 * browser's half of `Decay::resolve()`: the same moment has to pick the same
 * stage in both places, or a cached page drifts from the editor preview.
 */

import { entryAt, nextBoundary } from '../stageTimeline';

const base = ( overrides = {} ) => ( {
	id: 7,
	title: 'A title',
	permalink: 'https://example.test/a',
	url: 'https://example.test/served.gif',
	stage3Behaviour: 'keep',
	...overrides,
} );

const stage = ( number, start, end, url ) => ( {
	stage: number,
	start,
	end,
	url,
} );

describe( 'choosing the live stage', () => {
	it( 'uses the stage whose window contains the moment', () => {
		const entry = base( {
			stages: [
				stage( 1, 100, 200, 'one.gif' ),
				stage( 2, 200, 300, 'two.gif' ),
				stage( 3, 300, 400, 'three.gif' ),
			],
		} );

		expect( entryAt( entry, 150 ).url ).toBe( 'one.gif' );
		expect( entryAt( entry, 250 ).url ).toBe( 'two.gif' );
		expect( entryAt( entry, 350 ).url ).toBe( 'three.gif' );
	} );

	it( 'skips a stage with no length', () => {
		const entry = base( {
			stages: [
				stage( 1, 100, 200, 'one.gif' ),
				stage( 2, 200, 200, 'two.gif' ),
				stage( 3, 200, 300, 'three.gif' ),
			],
		} );

		expect( entryAt( entry, 250 ).url ).toBe( 'three.gif' );
	} );

	it( 'shows a future timeline as its first stage', () => {
		const entry = base( { stages: [ stage( 1, 200, 300, 'one.gif' ) ] } );

		expect( entryAt( entry, 150 ).url ).toBe( 'one.gif' );
	} );

	it( 'keeps the newest stage that has an icon once every stage has elapsed', () => {
		const entry = base( {
			stages: [
				stage( 1, 100, 200, 'one.gif' ),
				stage( 2, 200, 300, 'two.gif' ),
				stage( 3, 300, 400, '' ),
			],
		} );

		expect( entryAt( entry, 500 ).url ).toBe( 'two.gif' );
	} );

	it( 'draws nothing once the timeline has elapsed and the answer is remove', () => {
		const entry = base( {
			stage3Behaviour: 'remove',
			stages: [ stage( 1, 100, 200, 'one.gif' ) ],
		} );

		expect( entryAt( entry, 500 ) ).toBeNull();
	} );

	it( 'draws nothing while the live stage has no icon', () => {
		const entry = base( {
			stages: [
				stage( 1, 100, 200, 'one.gif' ),
				stage( 2, 200, 300, '' ),
			],
		} );

		expect( entryAt( entry, 250 ) ).toBeNull();
	} );

	it( 'carries the live stage’s own position and size', () => {
		const entry = base( {
			position: 'left',
			size: '20px',
			stages: [
				{
					...stage( 1, 100, 200, 'one.gif' ),
					position: 'left',
					size: '20px',
					offsetX: 2,
					offsetY: -3,
					flip: false,
				},
				{
					...stage( 2, 200, 300, 'two.gif' ),
					position: 'right',
					size: '32px',
					offsetX: 5,
					offsetY: 1,
					flip: true,
				},
			],
		} );

		const live = entryAt( entry, 250 );

		expect( live.position ).toBe( 'right' );
		expect( live.size ).toBe( '32px' );
		expect( live.offsetX ).toBe( 5 );
		expect( live.flip ).toBe( true );
	} );

	it( 'falls back to the fields the server resolved without a stage list', () => {
		expect( entryAt( base(), 500 ).url ).toBe(
			'https://example.test/served.gif'
		);
		expect( entryAt( base( { url: '' } ), 500 ) ).toBeNull();
	} );
} );

describe( 'the next stage boundary', () => {
	it( 'is the nearest boundary ahead', () => {
		const entries = [
			base( {
				stages: [
					stage( 1, 100, 200, 'a' ),
					stage( 2, 200, 900, 'b' ),
				],
			} ),
			base( { id: 8, stages: [ stage( 1, 100, 400, 'c' ) ] } ),
		];

		expect( nextBoundary( entries, 150 ) ).toBe( 200 );
		expect( nextBoundary( entries, 250 ) ).toBe( 400 );
	} );

	it( 'is null when no boundary is ahead', () => {
		expect(
			nextBoundary(
				[ base( { stages: [ stage( 1, 100, 200, 'a' ) ] } ) ],
				300
			)
		).toBeNull();
	} );

	it( 'ignores entries without a stage list', () => {
		expect( nextBoundary( [ base() ], 0 ) ).toBeNull();
	} );
} );
