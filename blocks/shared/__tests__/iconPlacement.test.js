/**
 * Frontend icon placement separates a post's own title nudge from its widgets.
 */

import {
	ICON_MIN_CLEARANCE,
	iconGap,
	offsetScale,
	offsetsWithMinimumGap,
	scaleOffset,
} from '../editorTitleDom';
import { iconPlacementForEntry } from '../frontendTitleDom';

const ENTRY = {
	id: 281,
	position: 'right-top',
	offsetX: -28,
	offsetY: -18,
	marker: 'widget-281',
	widgetIds: [ 'block-3' ],
	widgetPositions: { 'block-3': 'right' },
	widgetOffsets: {
		'block-3': { x: 6, y: -4 },
	},
};

describe( 'per-title icon placement', () => {
	it( 'keeps the author nudge on the post title', () => {
		expect( iconPlacementForEntry( '281', ENTRY ) ).toEqual( {
			position: 'right-top',
			offset: { offsetX: -28, offsetY: -18 },
		} );
	} );

	it( 'uses the widget position and its own offsets for the widget icon', () => {
		expect( iconPlacementForEntry( 'widget-281-block-3', ENTRY ) ).toEqual(
			{
				position: 'right',
				offset: { offsetX: 6, offsetY: -4 },
			}
		);
	} );

	it( 'uses an explicit widget position with its matching widget offset', () => {
		expect(
			iconPlacementForEntry( 'widget-281-block-3', ENTRY, 'right-top' )
		).toEqual( {
			position: 'right-top',
			offset: { offsetX: 6, offsetY: -4 },
		} );
	} );

	it( 'uses a widget-specific offset even when its position differs from the stage', () => {
		expect(
			iconPlacementForEntry( 'widget-281-block-3', ENTRY, 'left' )
		).toEqual( {
			position: 'left',
			offset: { offsetX: 6, offsetY: -4 },
		} );
	} );

	it( 'uses the widget position as a fallback when the title position is invalid', () => {
		expect(
			iconPlacementForEntry( 'widget-281-block-3', {
				...ENTRY,
				position: 'invalid',
			} )
		).toEqual( {
			position: 'right',
			offset: { offsetX: 6, offsetY: -4 },
		} );
	} );

	it( 'falls back to the post offset for cached data without widget-specific offsets', () => {
		const legacyEntry = { ...ENTRY };
		delete legacyEntry.widgetOffsets;

		expect(
			iconPlacementForEntry( 'widget-281-block-3', legacyEntry, 'left' )
		).toEqual( {
			position: 'left',
			offset: { offsetX: -28, offsetY: -18 },
		} );
	} );

	it( 'falls back to the stage position when a widget position is invalid', () => {
		expect(
			iconPlacementForEntry(
				'widget-281-block-3',
				{ ...ENTRY, position: 'right-top' },
				'invalid'
			)
		).toEqual( {
			position: 'right-top',
			offset: { offsetX: 6, offsetY: -4 },
		} );
	} );

	it( 'returns no placement for an icon outside the entry', () => {
		expect( iconPlacementForEntry( 'other', ENTRY ) ).toBeNull();
	} );

	it( 'still allows an inward nudge when the gap is under the clearance', () => {
		// A 10px title has a 1.5px gap, less than the 2px clearance, so the old
		// arithmetic left no room at all and the field did nothing beside a very
		// small heading. Half the gap stays clear, and the rest is the nudge.
		const fontSize = 10;
		const gap = iconGap( fontSize );
		const safe = offsetsWithMinimumGap(
			'left',
			{ offsetX: 100, offsetY: 0 },
			fontSize,
			ICON_MIN_CLEARANCE
		);
		// Stored pixels, so the rendered half-gap goes back through the scale
		// the title's own size produces.
		const room = ( gap - gap / 2 ) / offsetScale( fontSize );

		expect( gap ).toBeLessThan( ICON_MIN_CLEARANCE );
		expect( safe.offsetX ).toBeCloseTo( room, 5 );
		expect( safe.offsetX ).toBeGreaterThan( 0 );
		// Half the gap is still left between the icon and the words.
		expect( gap - safe.offsetX * offsetScale( fontSize ) ).toBeCloseTo(
			gap / 2,
			5
		);
	} );

	it( "clamps a growth-limited nudge in the icon's own scale", () => {
		// A title-following icon whose bands stopped growing moves its nudge
		// more slowly than the title grows, so the clearance has to be spent
		// at that same rate or the limit lands in the wrong place.
		const fontSize = 40;
		const growth = 0.5;
		const measuredGap = 10;
		const safe = offsetsWithMinimumGap(
			'right',
			{ offsetX: -100, offsetY: 0 },
			fontSize,
			ICON_MIN_CLEARANCE,
			measuredGap,
			growth
		);

		// Applied as the placement applies it: the room is exactly what the
		// rendered gap could spare, no more and no less.
		expect( scaleOffset( safe.offsetX, fontSize, growth ) ).toBeCloseTo(
			-( measuredGap - ICON_MIN_CLEARANCE ),
			5
		);
	} );

	it.each( [ 'left', 'right', 'top', 'bottom', 'left-top', 'right-bottom' ] )(
		'%s: widget inward movement preserves the same title-relative clearance',
		( position ) => {
			const fontSize = 24;
			const inwardX = position.startsWith( 'left' ) ? 100 : -100;
			const inwardY =
				position.endsWith( 'top' ) || 'top' === position ? 100 : -100;
			const requested = { offsetX: inwardX, offsetY: inwardY };
			const safe = offsetsWithMinimumGap(
				position,
				requested,
				fontSize,
				ICON_MIN_CLEARANCE
			);
			// The clearance never takes more than half the gap, so a title small
			// enough that its gap is under the clearance still has room to nudge.
			const gap = iconGap( fontSize );
			const inwardRoom = Math.max(
				0,
				gap - Math.min( ICON_MIN_CLEARANCE, gap / 2 )
			);
			const room = ( inwardRoom * 32 ) / fontSize;
			const hasSide =
				position.startsWith( 'left' ) || position.startsWith( 'right' );
			const hasEdge =
				/top$|bottom$/.test( position ) ||
				[ 'top', 'bottom' ].includes( position );

			expect( safe ).toEqual( {
				offsetX:
					hasSide && ! hasEdge
						? Math.sign( inwardX ) * room
						: requested.offsetX,
				// The vertical axis is a free slide, so the number is used as is.
				offsetY: requested.offsetY,
			} );
		}
	);
} );
