/**
 * The author's nudge, at the title size being drawn.
 *
 * The two offset fields are typed while watching the editor's canvas, where
 * WordPress gives the post title 2rem. The front end draws the same title at a
 * size the theme chooses — larger on a wide window, smaller on a phone — and
 * the nudge is spent covering *letters*, so a value left in raw pixels covers a
 * different part of the same letter at every one of those sizes. Measured with
 * the author's own values on a real theme: the two sides agreed in the rule's
 * own terms and the icon still sat a few pixels further off the first letter on
 * the page than in the canvas. The nudge is scaled by the title's font size, so
 * a card copy covers the same share of its letters as the post's own page; only
 * the top of the range is held, inside `OFFSET_SCALE_MAX`, where a display
 * headline would grow the nudge until the icon cleared a whole line.
 * A positioned post-title icon honours the number exactly, inward or outward;
 * only an inline widget icon keeps the shared minimum clearance that stops it
 * covering the words beside it. The placement is read back through `placeIcon`
 * — the call both sides make — because `positionIcon` applies that scale.
 */

import {
	OFFSET_REFERENCE_PX,
	OFFSET_SCALE_MAX,
	iconGap,
	offsetScale,
	placeIcon,
	scaleOffset,
} from '../editorTitleDom';

describe( 'the author\u2019s nudge at a title size', () => {
	it( 'is the number the author wrote, at the size the canvas draws it', () => {
		expect( scaleOffset( -33, OFFSET_REFERENCE_PX ) ).toBe( -33 );
		expect( scaleOffset( -33, `${ OFFSET_REFERENCE_PX }px` ) ).toBe( -33 );
		expect( scaleOffset( 12, 32 ) ).toBe( 12 );
	} );

	it( 'grows with the title, in proportion, between the limits', () => {
		const large = scaleOffset( -33, 40 );
		const small = scaleOffset( -33, 24 );

		expect( large ).toBeCloseTo( -41.25, 5 );
		expect( small ).toBeCloseTo( -24.75, 5 );
		expect( large / 40 ).toBeCloseTo( small / 24, 5 );
	} );

	it( 'scales a small title exactly proportionally', () => {
		// No floor: a widget title drawn at 15px gets 15/32 of the nudge, so the
		// icon covers the same share of the same letters as on the post's page.
		expect( offsetScale( 15 ) ).toBeCloseTo( 15 / OFFSET_REFERENCE_PX, 10 );
		expect( scaleOffset( -33, 15 ) ).toBeCloseTo( -33 * ( 15 / 32 ), 5 );
		[ 6, 8, 10, 12 ].forEach( ( size ) => {
			expect( offsetScale( size ) ).toBeCloseTo(
				size / OFFSET_REFERENCE_PX,
				10
			);
			expect( scaleOffset( -33, size ) ).toBeCloseTo(
				-33 * ( size / 32 ),
				10
			);
			// The gap keeps its fraction there too; neither number goes
			// negative or becomes a fraction the stylesheet cannot use.
			expect( iconGap( size ) ).toBeCloseTo( 0.15 * size, 10 );
		} );
	} );

	it( 'stops following the title once it is far larger', () => {
		// A 64px headline would otherwise get 2x the nudge: past 1.4 the scale
		// holds, so the number cannot run away however large the title is.
		expect( offsetScale( 64 ) ).toBe( OFFSET_SCALE_MAX );
		[ 72, 96, 120, 160 ].forEach( ( size ) => {
			expect( offsetScale( size ) ).toBe( OFFSET_SCALE_MAX );
			expect( scaleOffset( -33, size ) ).toBeCloseTo(
				-33 * OFFSET_SCALE_MAX,
				10
			);
			expect( iconGap( size ) ).toBeCloseTo( 0.15 * size, 10 );
		} );
		expect( scaleOffset( -33, 64 ) ).toBeCloseTo(
			-33 * OFFSET_SCALE_MAX,
			5
		);
		// Flat at the top: two very large titles get the same scale.
		expect( scaleOffset( -33, 64 ) ).toBeCloseTo(
			scaleOffset( -33, 96 ),
			5
		);
	} );

	it( 'leaves every ordinary title exactly proportional', () => {
		[ 20, 24, 32, 36, 42, 44 ].forEach( ( size ) => {
			expect( offsetScale( size ) ).toBeCloseTo(
				size / OFFSET_REFERENCE_PX,
				10
			);
		} );
	} );

	it( 'stops growing where the icon itself stops growing', () => {
		// A 40px title asks for 1.25. An adaptive icon held at its own 45px
		// maximum grew 1.125x from the canvas, so the nudge grows 1.125x: the
		// icon no longer covers a larger share of the line, and a nudge still at
		// 1.25 would drift off the spot the author arranged.
		expect( offsetScale( 40, 1.125 ) ).toBeCloseTo( 1.125, 5 );
		expect( scaleOffset( -33, 40, 1.125 ) ).toBeCloseTo( -37.125, 5 );

		// The title still wins when the icon grew as much as it did.
		expect( offsetScale( 40, 1.25 ) ).toBeCloseTo( 1.25, 5 );
		expect( offsetScale( 40, 2 ) ).toBeCloseTo( 1.25, 5 );

		// And with no icon to measure, nothing changes: a fixed-size icon keeps
		// following the letters, which is what the nudge is for.
		expect( offsetScale( 40 ) ).toBeCloseTo( 1.25, 5 );
		expect( scaleOffset( -33, 40, null ) ).toBeCloseTo( -41.25, 5 );
	} );

	it( 'follows an icon that shrank, all the way down', () => {
		// The growth limit belongs to the answer, not to the title alone: a stage
		// whose bands draw a smaller icon beside a large title (0.4x the canvas
		// here) keeps a nudge of 0.4x, so the icon covers the share of the letters
		// its own size asks for. Only the ceiling is left to hold it back.
		expect( offsetScale( 60, 0.4 ) ).toBeCloseTo( 0.4, 5 );
		expect( offsetScale( 60, 0.5 ) ).toBeCloseTo( 0.5, 5 );
		expect( offsetScale( 60, 0.6 ) ).toBeCloseTo( 0.6, 5 );
		expect( offsetScale( 60, 0.9 ) ).toBeCloseTo( 0.9, 5 );
		// Even an icon that somehow grew far past the title stops at the ceiling.
		expect( offsetScale( 60, 5 ) ).toBe( OFFSET_SCALE_MAX );
	} );

	it( 'keeps the sign, so the fields still mean what they say', () => {
		expect( scaleOffset( -29, 36 ) ).toBeLessThan( 0 );
		expect( scaleOffset( 29, 36 ) ).toBeGreaterThan( 0 );
		expect( scaleOffset( 0, 36 ) ).toBe( 0 );
	} );

	it( 'still produces a usable number when the size cannot be read', () => {
		// A detached document, or a stylesheet that has not applied yet, must
		// not silently drop the author's nudge to zero.
		expect( scaleOffset( -33, '' ) ).toBe( -33 );
		expect( scaleOffset( -33, 'not a size' ) ).toBe( -33 );
		expect( scaleOffset( -33, 0 ) ).toBe( -33 );
		expect( scaleOffset( -33, -8 ) ).toBe( -33 );
	} );

	it( 'falls back to nothing for a value that is not a number', () => {
		expect( scaleOffset( '', 32 ) ).toBe( 0 );
		expect( scaleOffset( null, 32 ) ).toBe( 0 );
		expect( scaleOffset( 'abc', 32 ) ).toBe( 0 );
		expect( scaleOffset( undefined, 32 ) ).toBe( 0 );
	} );
} );

describe( 'the same nudge at two title sizes', () => {
	// The shape `positionIcon` measures: a wrapper with room on every side, the
	// title's text starting `TEXT_LEFT` inside it, and an icon whose own width
	// is read from the style it was built with — jsdom has no layout.
	const WIDTH = 900;
	// The anchor size on purpose: the middle-anchor rule then contributes
	// nothing to these numbers, which are the author's nudge alone.
	const ICON_SIZE = 20;
	const TEXT_LEFT = 120;
	const TEXT_WIDTH = 420;
	const TEXT_HEIGHT = 60;

	/**
	 * Build the scene and place the icon in it, at one title size.
	 *
	 * @param {number} fontSize   Title font size, in pixels.
	 * @param {Object} offset     `{ offsetX, offsetY }` as the author stored it.
	 * @param {Object} [settings] Adaptive bounds and the reference title size.
	 * @return {{overlap: number, centre: number}} Pixels the icon reaches into
	 *         the text, and the distance of its middle from the text's middle.
	 */
	const place = ( fontSize, offset, settings = {} ) => {
		document.body.innerHTML =
			'<div id="w"><span id="i"></span><h1 id="t">Breaking News Story</h1></div>';

		const wrapper = document.getElementById( 'w' );
		const icon = document.getElementById( 'i' );
		const title = document.getElementById( 't' );

		wrapper.getBoundingClientRect = () => ( {
			left: 100,
			top: 0,
			width: WIDTH,
			height: 200,
			right: 100 + WIDTH,
			bottom: 200,
		} );
		// The rect above is the box `positionIcon` places against: it is measured
		// from the element's own geometry, which works for a block wrapper and an
		// inline one alike.
		document.createRange = () => ( {
			selectNodeContents: () => {},
			setStartAfter: () => {},
			setEndBefore: () => {},
			getBoundingClientRect: () => ( {
				left: 100 + TEXT_LEFT,
				top: 40,
				width: TEXT_WIDTH,
				height: TEXT_HEIGHT,
				right: 100 + TEXT_LEFT + TEXT_WIDTH,
				bottom: 40 + TEXT_HEIGHT,
			} ),
		} );

		// Only the two things `positionIcon` asks a stylesheet for.
		jest.spyOn( window, 'getComputedStyle' ).mockReturnValue( {
			fontSize: `${ fontSize }px`,
		} );

		const ElementType = document.defaultView.HTMLElement;
		const original = Object.getOwnPropertyDescriptor(
			ElementType.prototype,
			'offsetWidth'
		);

		Object.defineProperty( ElementType.prototype, 'offsetWidth', {
			configurable: true,
			get() {
				const width = this.style && this.style.width;

				return width ? parseFloat( width ) : 0;
			},
		} );

		try {
			// The stage's bands travel with the placement, as they do on a page.
			// No bands means a fixed icon, which keeps its own size and lets the
			// nudge follow the title.
			icon.style.width = `${ ICON_SIZE }px`;
			placeIcon( document, icon, wrapper, title, 'left', {
				...offset,
				adaptive: Boolean( settings.rules ),
				sizingRules: settings.rules || null,
			} );
		} finally {
			if ( original ) {
				Object.defineProperty(
					ElementType.prototype,
					'offsetWidth',
					original
				);
			} else {
				delete ElementType.prototype.offsetWidth;
			}
		}

		// `right` is measured from the wrapper's far edge, so the icon's own
		// left edge is the same arithmetic in reverse. An adaptive pass writes a
		// width of its own, so the placed icon's size is read back.
		const width = parseFloat( icon.style.width ) || ICON_SIZE;
		const left = WIDTH - parseFloat( icon.style.right ) - width;

		// A side placement anchors the icon with `top` and lifts it by half its
		// height, so `top` is already the icon's own middle.
		const centre = parseFloat( icon.style.top ) - ( 40 + TEXT_HEIGHT / 2 );

		return {
			overlap: left + width - TEXT_LEFT,
			centre,
			// The size the placement actually drew, which an adaptive pass sets.
			width,
		};
	};

	afterEach( () => {
		jest.restoreAllMocks();
		document.body.innerHTML = '';
	} );

	it( 'covers the same fraction of the title at every size', () => {
		const atCanvas = place( OFFSET_REFERENCE_PX, {
			offsetX: -33,
			offsetY: -29,
		} );
		const atTheme = place( 36, { offsetX: -33, offsetY: -29 } );

		// The icon reaches the same part of the same letter, so the author's
		// tuning while watching the canvas is what the page shows.
		expect( atTheme.overlap / 36 ).toBeCloseTo(
			atCanvas.overlap / OFFSET_REFERENCE_PX,
			5
		);
		expect( atTheme.centre / 36 ).toBeCloseTo(
			atCanvas.centre / OFFSET_REFERENCE_PX,
			5
		);
	} );

	it( 'gives a small title its own fraction of the nudge', () => {
		// The centre offset is the author's -29 seen at 15px: 15/32 of it, the
		// same fraction the icon covers on the post's own page.
		const placed = place( 15, { offsetX: 0, offsetY: -29 } );

		expect( placed.centre ).toBeCloseTo( -29 * ( 15 / 32 ), 5 );
	} );

	it( 'honours an outward nudge from the canvas to the page', () => {
		const placed = place( OFFSET_REFERENCE_PX, {
			offsetX: -33,
			offsetY: -29,
		} );

		// Positive X is right, so a negative number on a left-hand icon opens
		// the gap by exactly the stored distance.
		expect( placed.overlap ).toBeCloseTo( -( 0.15 * 32 ) - 33, 5 );
		expect( placed.centre ).toBeCloseTo( -29, 5 );
	} );

	it( 'honours an inward nudge too, so both directions are free', () => {
		const placed = place( OFFSET_REFERENCE_PX, {
			offsetX: 33,
			offsetY: -29,
		} );

		// Positive X moves a left-hand icon right, towards the words. The
		// number is applied as written, so unlike the old clearance stop it
		// can bring the icon over the text.
		expect( placed.overlap ).toBeCloseTo( -( 0.15 * 32 ) + 33, 5 );
		expect( placed.centre ).toBeCloseTo( -29, 5 );
	} );

	it( 'stops the nudge where the bands stop growing the icon', () => {
		// The bands draw 45px beside both the 32px canvas and the 40px title,
		// so the icon does not grow and the nudge stays at the authored -33
		// rather than stretching with the text to -41.25.
		const capped = place(
			40,
			{ offsetX: -33, offsetY: 0 },
			{
				rules: [
					{ font: 32, icon: 45 },
					{ font: 40, icon: 45 },
				],
			}
		);
		// Bands that keep growing with the title grow the nudge too.
		const uncapped = place(
			40,
			{ offsetX: -33, offsetY: 0 },
			{
				rules: [
					{ font: 32, icon: 48 },
					{ font: 40, icon: 60 },
				],
			}
		);

		expect( capped.overlap ).toBeCloseTo( -( 0.15 * 40 ) - 33, 5 );
		expect( uncapped.overlap ).toBeCloseTo( -( 0.15 * 40 ) - 33 * 1.25, 5 );
	} );

	it( 'holds the nudge still when the bands stop growing at a larger title', () => {
		// The icon is 60px beside both a 40px and a 60px title, so it grows not
		// at all between those two copies and neither must the nudge. The
		// scale is the icon's growth from the canvas — 48px at 32px to 60px,
		// 1.25x — not the title's 1.875x.
		const bands = {
			rules: [
				{ font: 32, icon: 48 },
				{ font: 40, icon: 60 },
				{ font: 60, icon: 60 },
			],
		};
		const atReference = place( 40, { offsetX: 37, offsetY: 0 }, bands );
		const copy = place( 60, { offsetX: 37, offsetY: 0 }, bands );
		const appliedAt = ( placed, font ) => placed.overlap + 0.15 * font;

		// The icon is at the same size beside both titles, which is what makes
		// the equal nudges meaningful rather than a coincidence.
		expect( atReference.width ).toBeCloseTo( 60, 5 );
		expect( copy.width ).toBeCloseTo( 60, 5 );
		expect( appliedAt( atReference, 40 ) ).toBeCloseTo( 37 * 1.25, 5 );
		expect( appliedAt( copy, 60 ) ).toBeCloseTo( 37 * 1.25, 5 );
	} );

	it( 'keeps the icon clear of the words with no nudge, at any size', () => {
		[ 6, 8, 26, 32, 36, 60, 96, 160 ].forEach( ( fontSize ) => {
			const clear = place( fontSize, { offsetX: 0, offsetY: 0 } );

			expect( clear.overlap ).toBeLessThanOrEqual( 0 );
		} );
	} );

	it( 'applies the proportional scale and the ceiling on the page', () => {
		// The two ends end to end: the icon's clearance is the title's own gap
		// plus the authored 33px at 8/32 of it beside an 8px title and at 1.4x
		// beside a 120px one.
		const tiny = place( 8, { offsetX: -33, offsetY: 0 } );
		const huge = place( 120, { offsetX: -33, offsetY: 0 } );

		expect( tiny.overlap ).toBeCloseTo(
			-( 0.15 * 8 ) - 33 * ( 8 / 32 ),
			5
		);
		expect( huge.overlap ).toBeCloseTo(
			-( 0.15 * 120 ) - 33 * OFFSET_SCALE_MAX,
			5
		);
	} );
} );
