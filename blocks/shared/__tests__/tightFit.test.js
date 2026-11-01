/**
 * The answer for an icon that has no room inside its card.
 *
 * A widget icon is drawn inside a card, and the theme clips whatever leaves it.
 * On a narrow card there is no room for the icon and its gap at all, so the
 * answer is a smaller icon: the card draws the picture at the size that fits,
 * down to 8px. What must never happen is the icon being drawn over the words,
 * which is what the old "clamp it to the card edge" rule did (measured 22.4px on
 * a real trending-news slide). Nor may the answer indend the title: `wrap` once
 * reserved room beside the words and moved them, which pushed a recent posts
 * title 28px right for an icon that was never clipped at all.
 *
 * The default answer is the one that changes nothing. The retired hiding plan
 * stays checkable for pages built by older versions.
 */

import {
	TIGHT_FIT_DEFAULT,
	TIGHT_FIT_MIN_ICON,
	clipsOverflow,
	fitLimits,
	placeIcon,
	tightFitPlan,
} from '../editorTitleDom';
import {
	TIGHT_FITS,
	TIGHT_FIT_DEFAULT as SETTING_DEFAULT,
	TIGHT_FIT_VALUES,
	tightFitMode,
} from '../constants';

const base = { room: 30, gap: 4, iconWidth: 24 };

describe( 'the edges a card offers', () => {
	it( 'lets the icon use the card padding and stops at the border', () => {
		// A recent posts title has no padding of its own, but its widget has
		// 30px and clips at the outer edge. Treating the content edge as the
		// boundary reserved that padding on the title and indented it. The card
		// padding belongs to the card, so the icon may use it.
		expect(
			fitLimits(
				{ left: 100, right: 500 },
				{
					borderLeftWidth: '1px',
					borderRightWidth: '2px',
					paddingLeft: '30px',
					paddingRight: '20px',
				}
			)
		).toEqual( { left: 101, right: 498 } );
	} );

	it( 'has no edges of its own when the card has no border', () => {
		expect(
			fitLimits( { left: 100, right: 500 }, { padding: '30px' } )
		).toEqual( { left: 100, right: 500 } );
	} );
} );

describe( 'whether a card would hide the icon', () => {
	it( 'only counts a box that clips', () => {
		[ 'hidden', 'clip', 'scroll', 'auto' ].forEach( ( overflow ) => {
			expect(
				clipsOverflow( { overflowX: overflow, overflowY: overflow } )
			).toBe( true );
		} );
		expect(
			clipsOverflow( { overflowX: 'visible', overflowY: 'visible' } )
		).toBe( false );
		expect( clipsOverflow( {} ) ).toBe( false );
	} );

	it( 'counts a single axis that clips', () => {
		expect(
			clipsOverflow( { overflowX: 'hidden', overflowY: 'visible' } )
		).toBe( true );
	} );
} );

describe( 'what the fit answer may change', () => {
	const CARD = { left: 50, top: 0, width: 300, height: 40 };

	/**
	 * A widget card whose title has an icon to its left, with no room beside it.
	 *
	 * Twenty pixels sit between the words and the card's left edge, and the
	 * icon and its gap need 28.8, so the card must either clip the icon or
	 * draw it smaller.
	 *
	 * @param {string} overflow Card's overflow on both axes.
	 * @param {Object} [extra]  Extra placement options, such as a title-following
	 *                          icon's sizing rules.
	 * @return {{card: Element, title: Element, icon: Element}} The scene.
	 */
	const scene = ( overflow, extra = {} ) => {
		document.body.innerHTML =
			'<div id="card"><div id="w"><span id="i"></span><h2 id="t">Recent post title</h2></div></div>';

		const card = document.getElementById( 'card' );
		const wrapper = document.getElementById( 'w' );
		const icon = document.getElementById( 'i' );
		const title = document.getElementById( 't' );
		const rect = {
			...CARD,
			right: CARD.left + CARD.width,
			bottom: CARD.height,
		};

		card.getBoundingClientRect = () => rect;
		wrapper.getBoundingClientRect = () => rect;
		Object.defineProperty( icon, 'offsetWidth', {
			value: 24,
			configurable: true,
		} );
		// The icon is measured at whatever width and side the placement has
		// given it, so a fitted icon really converges instead of asking for the
		// same shrink on every pass. A left-side icon inside a card is written
		// as `right`, measured back from the card's own box.
		icon.getBoundingClientRect = () => {
			const width = parseFloat( icon.style.width ) || 24;
			const left = icon.style.left
				? parseFloat( icon.style.left )
				: CARD.left +
					CARD.width -
					( parseFloat( icon.style.right ) || 0 ) -
					width;

			return {
				left,
				right: left + width,
				top: 0,
				bottom: width,
				width,
				height: width,
			};
		};
		document.createRange = () => ( {
			selectNodeContents: () => {},
			setStartAfter: () => {},
			setEndBefore: () => {},
			getBoundingClientRect: () => ( {
				left: CARD.left + 20,
				top: 0,
				width: 200,
				height: 20,
				right: CARD.left + 220,
				bottom: 20,
			} ),
		} );

		const real = window.getComputedStyle.bind( window );
		jest.spyOn( window, 'getComputedStyle' ).mockImplementation(
			( node ) => {
				const style = real( node );

				return node === card
					? {
							...style,
							overflowX: overflow,
							overflowY: overflow,
							borderLeftWidth: '0px',
							borderRightWidth: '0px',
						}
					: style;
			}
		);

		placeIcon( document, icon, wrapper, title, 'left', {
			fontSize: '32px',
			fit: { mode: 'shrink', boundary: card },
			...extra,
		} );

		return { card, title, icon, wrapper };
	};

	afterEach( () => {
		jest.restoreAllMocks();
		document.body.innerHTML = '';
	} );

	it( 'leaves the icon at its own size when the card would show it anyway', () => {
		const { title, icon, wrapper } = scene( 'visible' );

		expect( icon.style.width ).toBe( '' );
		expect( title.style.paddingLeft ).toBe( '' );
		expect( wrapper.style.paddingLeft ).toBe( '' );
	} );

	it( 'draws a clipped icon smaller, and never indents the title', () => {
		const { title, icon, wrapper } = scene( 'hidden' );
		const width = parseFloat( icon.style.width );

		// Twenty pixels of room less the 4.8px gap at 32px, floored.
		expect( width ).toBe( 15 );
		expect( width ).toBeLessThan( 24 );
		// The whole point of the answer: the words stay where they are.
		expect( title.style.paddingLeft ).toBe( '' );
		expect( wrapper.style.paddingLeft ).toBe( '' );
	} );

	it( 'keeps the fitted width through the re-measure of an adaptive icon', () => {
		// A title-following icon is written to its band's size on every pass.
		// Writing it over the fitted width put a 26px icon back at 26px each
		// time, so the card shrank it again and never settled: six passes, and
		// the icon was still clipped.
		const { icon } = scene( 'hidden', {
			adaptive: true,
			sizingRules: [ { font: 32, icon: 26 } ],
		} );

		expect( parseFloat( icon.style.width ) ).toBe( 15 );
	} );
} );

describe( 'the tight-card plan', () => {
	it( 'leaves an icon that fits alone, in every mode', () => {
		[ 'keep', 'shrink', 'hide' ].forEach( ( mode ) => {
			expect( tightFitPlan( { ...base, mode, overflow: -3 } ) ).toEqual( {
				width: null,
				hide: false,
			} );
		} );
	} );

	it( 'ignores a sub-pixel overflow', () => {
		expect(
			tightFitPlan( { ...base, mode: 'hide', overflow: 0.4 } )
		).toEqual( { width: null, hide: false } );
	} );

	it( 'never answers with room to reserve', () => {
		// Nothing about the plan may touch the title's layout, whatever the
		// mode is called.
		[ 'keep', 'shrink', 'hide', undefined ].forEach( ( mode ) => {
			expect(
				tightFitPlan( { ...base, mode, overflow: 22.41 } )
			).not.toHaveProperty( 'reserve' );
		} );
	} );

	it( 'draws the icon at the room that is left', () => {
		// 22.8px of room, one 4px gap, so an 18px icon is the widest that fits.
		expect(
			tightFitPlan( {
				mode: 'shrink',
				room: 22.8,
				gap: 4,
				iconWidth: 27,
				overflow: 8.2,
			} )
		).toEqual( { width: 18, hide: false } );
	} );

	it( 'uses the whole room, because a fitted icon sits at the gap', () => {
		// The anchor correction that centres small icons is dropped while a card
		// is being fitted (`sideStyle`), so room - gap is exactly the width that
		// reaches the card edge.
		const room = 16;
		const gap = 4;

		expect(
			tightFitPlan( {
				mode: 'shrink',
				room,
				gap,
				iconWidth: 19.5,
				overflow: 7.7,
			} ).width
		).toBe( 12 );
	} );

	it( 'keeps the gap rather than cover the words when shrinking cannot fit', () => {
		// 1.59px of room cannot hold even the smallest icon plus the gap.
		expect(
			tightFitPlan( {
				mode: 'shrink',
				room: 1.59,
				gap: 4,
				iconWidth: 24,
				overflow: 26.41,
			} )
		).toEqual( { width: null, hide: false } );
	} );

	it( 'never shrinks an icon below the floor', () => {
		const width = TIGHT_FIT_MIN_ICON - 1;

		expect(
			tightFitPlan( {
				mode: 'shrink',
				room: width + base.gap,
				gap: base.gap,
				iconWidth: 24,
				overflow: 10,
			} )
		).toEqual( { width: null, hide: false } );
	} );

	it( 'never grows an icon the card already holds', () => {
		expect(
			tightFitPlan( {
				mode: 'shrink',
				room: 400,
				gap: 4,
				iconWidth: 24,
				overflow: 1,
			} )
		).toEqual( { width: null, hide: false } );
	} );

	it( 'changes nothing when the site leaves the icon alone', () => {
		expect(
			tightFitPlan( { ...base, mode: 'keep', overflow: 26.41 } )
		).toEqual( { width: null, hide: false } );
	} );

	it( 'hides the icon on a card that cannot hold it', () => {
		expect(
			tightFitPlan( { ...base, mode: 'hide', overflow: 26.41 } )
		).toEqual( { width: null, hide: true } );
	} );

	it( 'leaves the icon alone when the mode is missing, which is the shipped default', () => {
		expect( TIGHT_FIT_DEFAULT ).toBe( 'keep' );
		expect(
			tightFitPlan( { ...base, mode: undefined, overflow: 9 } )
		).toEqual( { width: null, hide: false } );
	} );

	// The setting and the placement are separate modules on purpose (the
	// placement imports nothing), so the words they agree on are asserted
	// rather than assumed: a choice added to one and forgotten in the other
	// would otherwise reach the page as a silent fallback.
	it( 'agrees with the setting about the two answers and the default', () => {
		expect( TIGHT_FIT_VALUES ).toEqual( [ 'keep', 'shrink' ] );
		expect( TIGHT_FITS ).toHaveLength( 2 );
		expect( SETTING_DEFAULT ).toBe( TIGHT_FIT_DEFAULT );
		expect( tightFitMode( 'nonsense' ) ).toBe( TIGHT_FIT_DEFAULT );
		// The retired hiding answer cannot drop an icon any more.
		expect( tightFitMode( 'hide' ) ).toBe( 'keep' );
	} );
} );
