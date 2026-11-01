/**
 * Position offsets.
 *
 * An offset is kept per position and is a screen delta on both axes: a positive
 * number moves the icon right or down, a negative one left or up, whichever
 * position is selected. The direction words live in `constants.js`, because the
 * sidebar's offset tooltip is built from them; the two inputs themselves are
 * labelled only "x" and "y".
 *
 * So these tests do not restate the placement: they take those words and check
 * the icon really moves that way, and that a positive number always opens the gap
 * between the icon and the title, on every position. A fixed pixel offset with a
 * fixed pixel gap is what made the same numbers look right on one position and
 * wrong on the next.
 */

import {
	ICON_ANCHORS as ANCHOR_SETTING,
	ICON_ANCHOR_DEFAULT as ANCHOR_SETTING_DEFAULT,
	ICON_ANCHOR_VALUES,
	ICON_SPACINGS as SPACING_SETTING,
	ICON_SPACING_VALUES,
	OFFSET_DIRECTIONS,
	OFFSET_MAX,
	POSITION_VALUES,
	emptyOffset,
	emptyTimeline,
	iconAnchorMode,
	iconSpacingMode,
	resolveIconSpacing,
	emptyOffsets,
	offsetDirections,
	offsetHint,
	sanitizeOffset,
} from '../constants';
import {
	ICON_ANCHOR_DEFAULT,
	ICON_ANCHOR_SIZE,
	ICON_ANCHORS,
	ICON_GAP,
	ICON_MIN_CLEARANCE,
	buildIcon,
	computeIconStyle,
	iconAnchorShift,
	iconAnchorShiftCss,
	iconGap,
	offsetGap,
	offsetsWithMinimumGap,
	placeInlineIcon,
	scaleOffset,
	iconOffscreen,
	placeIcon,
	resolveIconAnchor,
	syncEditorIcon,
} from '../editorTitleDom';

describe( 'the anchor the placement and the setting agree on', () => {
	// The placement imports nothing (so it can be checked without a browser),
	// and the settings module owns the labels. A value added to one and
	// forgotten in the other would reach the page as a silent fallback.
	it( 'offers the same values in both modules', () => {
		expect( ICON_ANCHOR_VALUES ).toEqual( ICON_ANCHORS );
		expect( ANCHOR_SETTING.map( ( option ) => option.value ) ).toEqual(
			ICON_ANCHORS
		);
		expect( ANCHOR_SETTING_DEFAULT ).toBe( ICON_ANCHOR_DEFAULT );
		expect( ICON_ANCHOR_DEFAULT ).toBe( 'first_line' );
	} );

	it( 'falls back to the first line for anything it does not know', () => {
		[ undefined, null, '', 'middle', 'FIRST_LINE' ].forEach( ( value ) => {
			expect( resolveIconAnchor( value ) ).toBe( ICON_ANCHOR_DEFAULT );
			expect( iconAnchorMode( value ) ).toBe( ICON_ANCHOR_DEFAULT );
		} );
	} );

	it( 'keeps every answer', () => {
		expect( resolveIconAnchor( 'first_line' ) ).toBe( 'first_line' );
		expect( resolveIconAnchor( 'last_line' ) ).toBe( 'last_line' );
		expect( resolveIconAnchor( 'block' ) ).toBe( 'block' );
	} );
} );

describe( 'the per-post answers a timeline carries', () => {
	it( 'offers the same spacing values in both modules', () => {
		expect( ICON_SPACING_VALUES ).toEqual(
			SPACING_SETTING.map( ( option ) => option.value )
		);
	} );

	it( 'falls back to the gap for anything it does not know', () => {
		[ undefined, null, '', 'none', 'FLUSH' ].forEach( ( value ) => {
			expect( iconSpacingMode( value ) ).toBe( 'gap' );
		} );
	} );

	it( 'keeps both answers through a save', () => {
		const timeline = emptyTimeline( {
			icon_anchor: 'last_line',
			icon_spacing: 'flush',
		} );

		expect( timeline.icon_anchor ).toBe( 'last_line' );
		expect( timeline.icon_spacing ).toBe( 'flush' );
	} );

	it( 'leaves a post that chose nothing following the site', () => {
		const timeline = emptyTimeline( {
			icon_anchor: 'somewhere_else',
			icon_spacing: 'wide',
		} );

		// An empty answer means "use the site setting" rather than the
		// placement's own fallback, so a site that moves to another line or
		// to flush spacing still moves the posts that never picked one.
		expect( timeline.icon_anchor ).toBe( '' );
		expect( timeline.icon_spacing ).toBe( '' );
	} );

	it( 'resolves a post’s space from the site when it chose none', () => {
		expect( resolveIconSpacing( '', 'flush' ) ).toBe( 'flush' );
		expect( resolveIconSpacing( undefined, 'flush' ) ).toBe( 'flush' );
		expect( resolveIconSpacing( 'gap', 'flush' ) ).toBe( 'gap' );
		expect( resolveIconSpacing( 'flush', 'gap' ) ).toBe( 'flush' );
		// A value this version does not know is not a choice, so the site's
		// answer applies rather than a silent fall back to the gap.
		expect( resolveIconSpacing( 'wide', 'flush' ) ).toBe( 'flush' );
		expect( resolveIconSpacing( '', undefined ) ).toBe( 'gap' );
	} );
} );

/**
 * A heading inside a wrapper, in the shape `positionIcon` measures — with room
 * on every side, so no placement is pulled back inside.
 *
 * The text box is deliberately taller than one line would be, so a placement
 * that centres on the first line instead of on the title cannot pass unnoticed.
 */
const BOX = {
	titleBox: { left: 120, top: 40, width: 260, height: 90 },
	wrapperBox: { width: 640, height: 200 },
};

const ICON = { width: 20, height: 20 };

/**
 * Where the icon ends up, read back from the CSS the rules produced.
 *
 * `left`/`top` anchor the icon's own edges, `right`/`bottom` anchor it to the
 * far edges, and `translateY(-50%)` lifts it by half its height to centre it on
 * the line.
 *
 * @param {string} position Position keyword.
 * @param {number} offsetX  Horizontal nudge in pixels.
 * @param {number} offsetY  Vertical nudge in pixels.
 * @return {{left: number, top: number, style: Object}} Icon box and its style.
 */
const place = ( position, offsetX = 0, offsetY = 0 ) => {
	const style = computeIconStyle( {
		...BOX,
		iconWidth: ICON.width,
		position,
		offsetX,
		offsetY,
	} );

	let left = 0;
	let top = 0;

	if ( undefined !== style.left ) {
		left = parseFloat( style.left );
	} else if ( undefined !== style.right ) {
		left = BOX.wrapperBox.width - parseFloat( style.right ) - ICON.width;
	}

	if ( undefined !== style.top ) {
		top = parseFloat( style.top );
	} else if ( undefined !== style.bottom ) {
		top = BOX.wrapperBox.height - parseFloat( style.bottom ) - ICON.height;
	}

	if ( 'translateY(-50%)' === style.transform ) {
		top -= ICON.height / 2;
	}

	return { left, top, style };
};

const base = ( position ) => place( position );

/**
 * Screen direction as a sign, to read the words in `OFFSET_DIRECTIONS` back.
 */
const SCREEN = { left: -1, right: 1, up: -1, down: 1 };

/**
 * How far the icon moved on one axis for a given offset.
 *
 * @param {string} position Position keyword.
 * @param {number} offsetX  Horizontal offset.
 * @param {number} offsetY  Vertical offset.
 * @param {string} axis     `x` or `y`.
 * @return {number} Pixels moved, signed in screen terms.
 */
const shift = ( position, offsetX, offsetY, axis ) => {
	const moved = place( position, offsetX, offsetY );

	return 'x' === axis
		? moved.left - base( position ).left
		: moved.top - base( position ).top;
};

/**
 * The axis each position places the icon on, mirroring the placement rules.
 */
const AXES = {
	left: { side: 'left' },
	right: { side: 'right' },
	top: { edge: 'top' },
	bottom: { edge: 'bottom' },
	'left-top': { side: 'left', edge: 'top' },
	'left-bottom': { side: 'left', edge: 'bottom' },
	'right-top': { side: 'right', edge: 'top' },
	'right-bottom': { side: 'right', edge: 'bottom' },
};

/**
 * The gap between the icon and the title's text, read back out of the CSS the
 * rules produced.
 *
 * `right`/`bottom` anchor the icon to the wrapper's far edges, `left`/`top` to
 * its near ones, so what is left between the anchor and the text is the gap —
 * and it is only meaningful on the axis the position actually places on.
 *
 * @param {string} position Position keyword.
 * @param {number} offsetX  Horizontal offset.
 * @param {number} offsetY  Vertical offset.
 * @return {Object} `{ x?, y? }` gaps, present only where the position uses them.
 */
const gaps = ( position, offsetX = 0, offsetY = 0 ) => {
	const { side, edge } = AXES[ position ];
	const style = computeIconStyle( {
		...BOX,
		iconWidth: ICON.width,
		position,
		offsetX,
		offsetY,
	} );
	const out = {};

	if ( 'left' === side ) {
		out.x =
			parseFloat( style.right ) -
			( BOX.wrapperBox.width - BOX.titleBox.left );
	}

	if ( 'right' === side ) {
		out.x =
			parseFloat( style.left ) -
			( BOX.titleBox.left + BOX.titleBox.width );
	}

	if ( 'top' === edge ) {
		out.y =
			parseFloat( style.bottom ) -
			( BOX.wrapperBox.height - BOX.titleBox.top );
	}

	if ( 'bottom' === edge ) {
		out.y =
			parseFloat( style.top ) -
			( BOX.titleBox.top + BOX.titleBox.height );
	}

	return out;
};

describe( 'the placement with no offset', () => {
	it.each( POSITION_VALUES )(
		'%s: sits one gap away from the title, only on the axes its name uses',
		( position ) => {
			const { side, edge } = AXES[ position ];
			const used = [ side && 'x', edge && 'y' ].filter( Boolean );
			const measured = gaps( position );

			expect( Object.keys( measured ).sort() ).toEqual(
				[ ...used ].sort()
			);
			used.forEach( ( axis ) => {
				expect( measured[ axis ] ).toBeCloseTo( ICON_GAP, 5 );
			} );
		}
	);

	it.each( [ 'left', 'right' ] )(
		'%s: centres on the title, not on the first line of it',
		( position ) => {
			const placed = place( position );
			const center = placed.top + ICON.height / 2;

			expect( center ).toBeCloseTo(
				BOX.titleBox.top + BOX.titleBox.height / 2,
				5
			);
		}
	);

	it.each( [ 'top', 'bottom' ] )(
		'%s: lines the icon up with the start of the title',
		( position ) => {
			expect( parseFloat( place( position ).style.left ) ).toBeCloseTo(
				BOX.titleBox.left,
				5
			);
		}
	);

	it.each( [ 'left-top', 'left-bottom', 'right-top', 'right-bottom' ] )(
		'%s: takes the corner, the gap away on both axes',
		( position ) => {
			const measured = gaps( position );

			expect( measured.x ).toBeCloseTo( ICON_GAP, 5 );
			expect( measured.y ).toBeCloseTo( ICON_GAP, 5 );
		}
	);
} );

describe( 'resizing the icon', () => {
	/**
	 * The icon's middle, read back from the placement.
	 *
	 * `top` is already the middle (`translateY(-50%)` does the lifting), so only
	 * the horizontal axis needs the icon's own width taken off `left`/`right`.
	 *
	 * @param {string} position Position keyword.
	 * @param {number} width    Icon width in pixels.
	 * @return {{x: number, y: number}} Middle of the icon, in wrapper pixels.
	 */
	const middle = ( position, width ) => {
		const style = computeIconStyle( {
			...BOX,
			iconWidth: width,
			position,
		} );
		const left =
			undefined !== style.left
				? parseFloat( style.left )
				: BOX.wrapperBox.width - parseFloat( style.right ) - width;

		return { x: left + width / 2, y: parseFloat( style.top ) };
	};

	it.each( [ 'left', 'right' ] )(
		'%s: keeps the middle on the same spot at or below the anchor size',
		( position ) => {
			const first = middle( position, 8 );

			[ 12, 16, ICON_ANCHOR_SIZE ].forEach( ( width ) => {
				const middleAt = middle( position, width );

				expect( middleAt.x ).toBeCloseTo( first.x, 5 );
				expect( middleAt.y ).toBeCloseTo( first.y, 5 );
			} );
		}
	);

	it.each( [ 'left', 'right' ] )(
		'%s: shrinks about the middle and grows away from the title',
		( position ) => {
			// Below the anchor the icon narrows about its middle; at and above
			// it the edge facing the words is what stays put, so the icon can
			// never creep over the title however large it is drawn.
			const nearDistance = ( width ) => {
				const style = computeIconStyle( {
					...BOX,
					iconWidth: width,
					position,
				} );

				return 'left' === position
					? BOX.titleBox.left -
							( BOX.wrapperBox.width - parseFloat( style.right ) )
					: parseFloat( style.left ) -
							( BOX.titleBox.left + BOX.titleBox.width );
			};

			expect( nearDistance( 16 ) - nearDistance( 8 ) ).toBeCloseTo(
				-( 16 - 8 ) / 2,
				5
			);
			[ 24, 54, 96 ].forEach( ( width ) => {
				expect( nearDistance( width ) ).toBeCloseTo(
					nearDistance( ICON_ANCHOR_SIZE ),
					5
				);
			} );
		}
	);

	it( 'leaves the icon at its usual gap at the anchor size', () => {
		const placed = gaps( 'left' );

		expect( ICON_ANCHOR_SIZE ).toBe( ICON.width );
		expect( placed.x ).toBeCloseTo( ICON_GAP, 5 );
	} );

	it( 'backs a small icon off its middle and holds a large one at the gap', () => {
		expect( iconAnchorShift( 8 ) ).toBe( 6 );
		expect( iconAnchorShift( 20 ) ).toBe( 0 );
		expect( iconAnchorShift( 54 ) ).toBe( 0 );
		expect( iconAnchorShift( 0 ) ).toBe( 10 );
	} );

	it( 'writes the same correction as CSS for the previews', () => {
		// The previews know their width as a length, not a number, so the
		// correction has to travel as CSS. Multiplication by 0.5 keeps it
		// inside `calc()` on engines that never learned to divide lengths.
		expect( iconAnchorShiftCss( '20px' ) ).toBe( '' );
		expect( iconAnchorShiftCss( '12px' ) ).toBe(
			' + max(0px, (20px - 12px) * 0.5)'
		);
		expect( iconAnchorShiftCss( '32px' ) ).toBe(
			' + max(0px, (20px - 32px) * 0.5)'
		);
		expect( iconAnchorShiftCss( 'clamp(8px, 1.5em, 256px)' ) ).toBe(
			' + max(0px, (20px - clamp(8px, 1.5em, 256px)) * 0.5)'
		);
	} );
} );

describe( 'the icon at a zero offset while its size changes', () => {
	// The rule the author sees: with X and Y at 0 the icon has not been moved,
	// so resizing it must not move it either — it should shrink and grow about
	// its own middle, and never end up on top of the title. This goes through
	// `placeIcon`, the call both the canvas and the page make, rather than
	// restating the maths of `computeIconStyle`.
	const WIDTH = 900;
	const TEXT_LEFT = 300;
	const TEXT_WIDTH = 300;
	const TEXT_HEIGHT = 60;
	const FONT_SIZE = '32px';
	const SIZES = [ 8, 16, 20, 24, 32, 48, 67, 96 ];

	/**
	 * Place one icon of a given size and read its middle back.
	 *
	 * @param {number} size     Icon width in pixels.
	 * @param {string} position Position keyword.
	 * @param {Object} [offset] `{ offsetX, offsetY }` as the author stored it.
	 * @return {{x: number, y: number}} Middle of the icon, in wrapper pixels.
	 */
	const placed = ( size, position, offset = {} ) => {
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

		jest.spyOn( window, 'getComputedStyle' ).mockReturnValue( {
			fontSize: FONT_SIZE,
		} );

		Object.defineProperty( icon, 'offsetWidth', {
			configurable: true,
			value: size,
		} );
		icon.style.width = `${ size }px`;

		placeIcon( document, icon, wrapper, title, position, offset );

		const left = icon.style.right
			? WIDTH - parseFloat( icon.style.right ) - size
			: parseFloat( icon.style.left );

		// A side placement sets `top` to the text's middle and lifts the icon
		// by half its own height, so `top` is where its middle is drawn.
		return {
			x: left + size / 2,
			y: parseFloat( icon.style.top ),
			left,
			right: left + size,
		};
	};

	afterEach( () => {
		jest.restoreAllMocks();
		document.body.innerHTML = '';
	} );

	it.each( [ 'left', 'right' ] )(
		'%s: does not move at all from 8px up to the anchor size, at 0/0',
		( position ) => {
			const small = SIZES.filter( ( size ) => size <= ICON_ANCHOR_SIZE );
			const first = placed( small[ 0 ], position );

			small.slice( 1 ).forEach( ( size ) => {
				const middle = placed( size, position );

				expect( middle.x ).toBeCloseTo( first.x, 5 );
				expect( middle.y ).toBeCloseTo( first.y, 5 );
			} );
		}
	);

	it.each( [ 'left', 'right' ] )(
		'%s: stays clear of the words at every size, so nothing overlaps them',
		( position ) => {
			const gap = iconGap( FONT_SIZE );
			// `placed` reports wrapper coordinates, and the text starts
			// `TEXT_LEFT` inside that same wrapper.
			const textLeft = TEXT_LEFT;
			const textRight = textLeft + TEXT_WIDTH;

			SIZES.filter( ( size ) => size >= ICON_ANCHOR_SIZE ).forEach(
				( size ) => {
					const box = placed( size, position );
					const measuredGap =
						'left' === position
							? textLeft - box.right
							: box.left - textRight;

					expect( measuredGap ).toBeCloseTo( gap, 5 );
				}
			);
		}
	);

	it.each( [
		[ 'left', TEXT_LEFT ],
		[ 'right', TEXT_LEFT + TEXT_WIDTH ],
	] )(
		'%s: sits against the words when asked to be flush',
		( position, words ) => {
			// At the 32px reference the gap is 4.8px; flush leaves none of it,
			// and the 8px icon's own edge is what touches the letters.
			const flush = placed( 8, position, { spacing: 'flush' } );
			const spaced = placed( 8, position );
			// How far the icon's near edge stands from the words it labels.
			const clearance = ( box ) =>
				Math.abs(
					( 'left' === position ? box.right : box.left ) - words
				);

			expect( clearance( flush ) ).toBeCloseTo( 0, 5 );
			expect( clearance( spaced ) ).toBeGreaterThan( 1 );
		}
	);

	it.each( SIZES )(
		'%spx: keeps the author\u2019s nudge exact, so offsets still mean what they say',
		( size ) => {
			const resting = placed( size, 'left' );
			const nudged = placed( size, 'left', {
				offsetX: 12,
				offsetY: -7,
			} );

			expect( nudged.x - resting.x ).toBeCloseTo( 12, 5 );
			expect( nudged.y - resting.y ).toBeCloseTo( -7, 5 );
		}
	);
} );

describe( 'inline widget offset geometry', () => {
	it.each( [
		[ 'right', 12, 18 ],
		[ 'right', -12, 2 ],
		[ 'left', 12, 2 ],
		[ 'left', -12, 18 ],
	] )(
		'%s: keeps a measured minimum gap after an inward nudge',
		( position, offset, expectedGap ) => {
			const fontSize = 32;
			const initialGap = 6;
			const safe = offsetsWithMinimumGap(
				position,
				{ offsetX: offset, offsetY: 0 },
				fontSize,
				2,
				initialGap
			);
			// Positive X moves right: that opens the gap after a right-hand icon
			// and closes the one before a left-hand icon.
			const resultingGap =
				initialGap +
				( 'left' === position ? -1 : 1 ) *
					scaleOffset( safe.offsetX, fontSize );

			expect( resultingGap ).toBe( expectedGap );
		}
	);

	it.each( [ 'left', 'right' ] )(
		'%s: applies a measured inward clamp idempotently in the browser geometry',
		( position ) => {
			const title = document.createElement( 'a' );
			const icon = document.createElement( 'span' );
			const text = document.createTextNode( 'Breaking News Story' );
			const textRect =
				'right' === position
					? { left: 30, right: 150, width: 120, height: 20 }
					: { left: 200, right: 320, width: 120, height: 20 };
			const naturalLeft = 'right' === position ? 156 : 174;

			if ( 'left' === position ) {
				title.appendChild( icon );
				title.appendChild( text );
			} else {
				title.appendChild( text );
				title.appendChild( icon );
			}
			document.body.appendChild( title );
			icon.getBoundingClientRect = () => {
				const left =
					naturalLeft + ( parseFloat( icon.style.left ) || 0 );

				return { left, right: left + 20, width: 20, height: 20 };
			};

			const originalCreateRange = document.createRange;
			document.createRange = () => ( {
				selectNodeContents: () => {},
				setStartAfter: () => {},
				setEndBefore: () => {},
				getClientRects: () => [ textRect ],
			} );

			try {
				const offsets = {
					offsetX: 'left' === position ? 10 : -10,
					offsetY: 3,
					fontSize: '32px',
				};
				placeInlineIcon( icon, title, position, offsets );

				const firstLeft = parseFloat( icon.style.left );
				const safeOffset = 'right' === position ? -4 : 4;
				const measuredGap =
					'right' === position
						? icon.getBoundingClientRect().left - textRect.right
						: textRect.left - icon.getBoundingClientRect().right;

				expect( firstLeft ).toBe( safeOffset );
				expect( measuredGap ).toBe( 2 );

				// The gap comes from the stylesheet, which the site can override;
				// placement writes only its own coordinates, with no `!important`.
				expect( icon.style.marginLeft ).toBe( '' );
				expect( icon.style.marginRight ).toBe( '' );
				expect( icon.getAttribute( 'style' ) ).not.toMatch(
					/important/i
				);

				placeInlineIcon( icon, title, position, offsets );
				expect( parseFloat( icon.style.left ) ).toBe( safeOffset );
			} finally {
				document.createRange = originalCreateRange;
				title.remove();
			}
		}
	);

	it.each( [
		[ 'left', '2px' ],
		[ 'right', '-20px' ],
	] )(
		'%s: keeps a wrapping icon on the title line',
		( position, expectedMargin ) => {
			const title = document.createElement( 'a' );
			const icon = document.createElement( 'span' );
			title.appendChild(
				document.createTextNode( 'Breaking News Story' )
			);
			title.appendChild( icon );
			document.body.appendChild( title );

			Object.defineProperty( icon, 'offsetWidth', {
				configurable: true,
				value: 16,
			} );
			icon.style.marginLeft = '4px';
			icon.style.marginRight = '2px';

			// The icon starts on a line of its own, to the left of the text's
			// last line, which is what a narrow title produces.
			icon.getBoundingClientRect = () => ( {
				left: 0,
				right: 16,
				top: 24,
				bottom: 40,
				width: 16,
				height: 16,
			} );

			const originalCreateRange = document.createRange;
			document.createRange = () => ( {
				selectNodeContents: () => {},
				setStartAfter: () => {},
				setEndBefore: () => {},
				getClientRects: () => [
					{
						left: 0,
						right: 300,
						top: 0,
						bottom: 20,
						width: 300,
						height: 20,
					},
				],
			} );

			try {
				placeInlineIcon( icon, title, position, {
					offsetX: 0,
					offsetY: 0,
					fontSize: '16px',
				} );

				// A right-hand icon gets a negative margin equal to its width plus
				// the leading margin, so it no longer counts towards the line
				// width and stays after the text. Left icons are untouched.
				expect( icon.style.marginRight ).toBe( expectedMargin );
			} finally {
				document.createRange = originalCreateRange;
				title.remove();
			}
		}
	);

	it( 'measures the natural icon-to-text gap from browser rectangles', () => {
		const title = document.createElement( 'a' );
		const icon = document.createElement( 'span' );
		const text = document.createTextNode( 'Breaking News Story' );
		title.appendChild( icon );
		title.appendChild( text );
		document.body.appendChild( title );

		const originalCreateRange = document.createRange;
		document.createRange = () => ( {
			selectNodeContents: () => {},
			setStartAfter: () => {},
			setEndBefore: () => {},
			getClientRects: () => [
				{ left: 30, right: 150, width: 120, height: 20 },
			],
		} );
		icon.getBoundingClientRect = () => ( {
			left: 156,
			right: 176,
			width: 20,
			height: 20,
		} );

		try {
			expect( offsetGap( icon, title, 'right' ) ).toBe( 6 );
		} finally {
			document.createRange = originalCreateRange;
			title.remove();
		}
	} );
} );

describe( 'position offsets', () => {
	it.each( POSITION_VALUES )(
		'%s: horizontal clearance never extends through the title',
		( position ) => {
			const fontSize = 40;
			const clearance = 2;
			const gap = iconGap( fontSize );
			const axes = AXES[ position ];
			const inwardX = 'left' === axes.side ? 100 : -100;
			const inwardY = 'top' === axes.edge ? 100 : -100;
			const inwardRoom = ( ( gap - clearance ) * 32 ) / fontSize;
			const safe = offsetsWithMinimumGap(
				position,
				{ offsetX: inwardX, offsetY: inwardY },
				fontSize,
				clearance
			);

			expect( safe ).toEqual( {
				offsetX:
					axes.side && ! axes.edge
						? Math.sign( inwardX ) * inwardRoom
						: inwardX,
				// The vertical axis is a free slide, so the number is used as is.
				offsetY: inwardY,
			} );
		}
	);

	it( 'leaves all offsets alone when no clearance is requested', () => {
		expect(
			offsetsWithMinimumGap( 'right', { offsetX: -100, offsetY: 8 }, 40 )
		).toEqual( { offsetX: -100, offsetY: 8 } );
	} );

	it( 'does not alter outward nudges when a minimum gap is requested', () => {
		expect(
			offsetsWithMinimumGap(
				'right-top',
				{ offsetX: 12, offsetY: -9 },
				40,
				2
			)
		).toEqual( { offsetX: 12, offsetY: -9 } );
	} );

	it( 'describes every position the server accepts', () => {
		expect( Object.keys( OFFSET_DIRECTIONS ).sort() ).toEqual(
			[ ...POSITION_VALUES ].sort()
		);
	} );

	it.each( POSITION_VALUES )(
		'%s: no offset leaves the placement alone',
		( position ) => {
			const zero = place( position, 0, 0 );

			expect( zero.left ).toBeCloseTo( base( position ).left, 5 );
			expect( zero.top ).toBeCloseTo( base( position ).top, 5 );
		}
	);

	it.each( POSITION_VALUES )(
		'%s: a positive number moves the icon where the field says',
		( position ) => {
			const words = offsetDirections( position );

			expect( Math.abs( shift( position, 7, 0, 'x' ) ) ).toBeCloseTo(
				7,
				5
			);
			expect( Math.sign( shift( position, 7, 0, 'x' ) ) ).toBe(
				SCREEN[ words.x ]
			);
			expect( Math.abs( shift( position, 0, 7, 'y' ) ) ).toBeCloseTo(
				7,
				5
			);
			expect( Math.sign( shift( position, 0, 7, 'y' ) ) ).toBe(
				SCREEN[ words.y ]
			);
		}
	);

	it.each( POSITION_VALUES )(
		'%s: minus moves it the same distance the other way',
		( position ) => {
			const words = offsetDirections( position );

			expect( shift( position, -7, 0, 'x' ) ).toBeCloseTo(
				-7 * SCREEN[ words.x ],
				5
			);
			expect( shift( position, 0, -7, 'y' ) ).toBeCloseTo(
				-7 * SCREEN[ words.y ],
				5
			);
		}
	);

	it.each( POSITION_VALUES )(
		'%s: the two axes do not interfere',
		( position ) => {
			const words = offsetDirections( position );

			expect( shift( position, 9, 4, 'x' ) ).toBeCloseTo(
				9 * SCREEN[ words.x ],
				5
			);
			expect( shift( position, 9, 4, 'y' ) ).toBeCloseTo(
				4 * SCREEN[ words.y ],
				5
			);
		}
	);

	it.each( POSITION_VALUES )(
		'%s: the number changes the gap in the direction it names',
		( position ) => {
			const { side, edge } = AXES[ position ];
			const still = gaps( position );
			const axes = [ side && 'x', edge && 'y' ].filter( Boolean );
			// A right-hand or below-title icon moves away from the words as a
			// positive number is entered; a left-hand or above-title icon moves
			// towards them, because positive is always right and down.
			const outwardX = 'right' === side ? 1 : -1;
			const outwardY = 'bottom' === edge ? 1 : -1;

			axes.forEach( ( axis ) => {
				const direction = 'x' === axis ? outwardX : outwardY;
				const grown = gaps(
					position,
					'x' === axis ? 10 : 0,
					'y' === axis ? 10 : 0
				);
				const closed = gaps(
					position,
					'x' === axis ? -10 : 0,
					'y' === axis ? -10 : 0
				);

				expect( grown[ axis ] - still[ axis ] ).toBeCloseTo(
					10 * direction,
					5
				);
				expect( closed[ axis ] - still[ axis ] ).toBeCloseTo(
					-10 * direction,
					5
				);
			} );
		}
	);

	it.each( [ 'left', 'right', 'top', 'bottom' ] )(
		'%s: the other axis only slides, leaving the gap alone',
		( position ) => {
			const { side } = AXES[ position ];
			const words = offsetDirections( position );
			// A plain side or edge places on one axis only; the other is a slide
			// along the title, so it must not change the space being judged.
			const axis = side ? 'y' : 'x';
			const offsetX = 'x' === axis ? 10 : 0;
			const offsetY = 'y' === axis ? 10 : 0;

			expect( shift( position, offsetX, offsetY, axis ) ).toBeCloseTo(
				10 * SCREEN[ words[ axis ] ],
				5
			);
			expect( gaps( position, offsetX, offsetY ) ).toEqual(
				gaps( position )
			);
		}
	);

	// A positive vertical number always moves the icon down, so it opens the
	// gap below the title and closes the one above it.
	it( 'moves "Above title" down for a positive vertical number', () => {
		const still = gaps( 'top' );

		expect( gaps( 'top', 0, 18 ).y - still.y ).toBeCloseTo( -18, 5 );
		expect( gaps( 'top', 0, -18 ).y - still.y ).toBeCloseTo( 18, 5 );
		expect( offsetDirections( 'top' ).y ).toBe( 'down' );
	} );

	it( 'moves "Below title" down for a positive vertical number', () => {
		const still = gaps( 'bottom' );

		expect( gaps( 'bottom', 0, 18 ).y - still.y ).toBeCloseTo( 18, 5 );
		expect( gaps( 'bottom', 0, -18 ).y - still.y ).toBeCloseTo( -18, 5 );
		expect( offsetDirections( 'bottom' ).y ).toBe( 'down' );
	} );
} );

describe( 'offset help text', () => {
	it.each( POSITION_VALUES )(
		'%s: tells the author which way each field moves the icon',
		( position ) => {
			const words = offsetDirections( position );
			const hint = offsetHint( position );

			expect( hint ).toContain( words.x );
			expect( hint ).toContain( words.y );
			expect( hint ).not.toBe( '' );
		}
	);

	it( 'says a positive number moves right and down for every position', () => {
		POSITION_VALUES.forEach( ( position ) => {
			expect( offsetHint( position ) ).toContain( 'right' );
			expect( offsetHint( position ) ).toContain( 'down' );
		} );
	} );
} );

describe( 'a title with no room beside it', () => {
	// The shape that was drawn wrong in the editor: WordPress' post title
	// wrapper puts the title's text almost flush with its own left edge, so the
	// wrapper's box has nowhere to put a left-hand icon. The page around the
	// title does. `allowOutside` is the difference between asking the title's
	// box and asking the page.
	const TIGHT = {
		titleBox: { left: 4, top: 40, width: 500, height: 60 },
		wrapperBox: { width: 900, height: 200 },
	};

	/**
	 * The icon's left edge, in the wrapper's coordinates.
	 *
	 * @param {boolean} allowOutside Whether the page is treated as the room.
	 * @return {number} Pixels from the wrapper's left edge.
	 */
	const iconLeft = ( allowOutside ) => {
		const style = computeIconStyle( {
			...TIGHT,
			iconWidth: ICON.width,
			position: 'left',
			gap: ICON_GAP,
			allowOutside,
		} );

		return TIGHT.wrapperBox.width - parseFloat( style.right ) - ICON.width;
	};

	it( 'keeps the icon clear of the words when it may use the page', () => {
		// Nothing of the icon sits to the right of where the text starts, so it
		// cannot cover the title's first character.
		expect( iconLeft( true ) + ICON.width ).toBeLessThanOrEqual(
			TIGHT.titleBox.left
		);
	} );

	it( 'falls back to the wrapper, on top of the words, when it may not', () => {
		// The last resort, and the bug: confined to the wrapper there is nowhere
		// to go, so the icon lands on the start of the title. This is why both
		// sides of the plugin ask the page instead — `placeIcon`.
		expect( iconLeft( false ) ).toBe( 0 );
		expect( iconLeft( false ) + ICON.width ).toBeGreaterThan(
			TIGHT.titleBox.left
		);
	} );
	it.each( [ 0, 4, 24, 71 ] )(
		'sits one gap plus the nudge clear of text starting %dpx in',
		( left ) => {
			// The rule has to hold for the whole range of title positions that
			// used to overlap, including with an offset applied. On a left
			// position a bigger offset is further from the title, so the icon's
			// right edge ends up `gap + offset` to the left of the words.
			[ -12, 0, 12 ].forEach( ( offsetX ) => {
				const style = computeIconStyle( {
					titleBox: { ...TIGHT.titleBox, left },
					wrapperBox: TIGHT.wrapperBox,
					iconWidth: ICON.width,
					position: 'left',
					gap: ICON_GAP,
					allowOutside: true,
					offsetX,
				} );
				const right =
					TIGHT.wrapperBox.width - parseFloat( style.right );

				expect( right ).toBeCloseTo( left - ICON_GAP + offsetX, 5 );

				// Positive X moves a left-hand icon right, towards the words; a
				// negative or zero nudge stays outside them.
				const shouldStayOutside = offsetX <= 0;

				expect( right <= left ).toBe( shouldStayOutside );
			} );
		}
	);
} );
describe( 'a card icon that is being fitted', () => {
	// A small icon is normally centred on the anchor, which pushes its near
	// edge away from the words. A fitted icon has to use the card's whole room,
	// so it sits at the plain gap instead; without this a 12px icon kept its
	// 4px shift and reached past the card it was meant to fit in.
	const box = {
		titleBox: { left: 10, top: 20, width: 100, height: 40 },
		wrapperBox: { width: 300, height: 100 },
		iconWidth: 8,
		position: 'right',
		gap: 4,
	};

	it( 'sits at the gap instead of the centred anchor', () => {
		expect( parseFloat( computeIconStyle( box ).left ) ).toBe( 120 );
		expect(
			parseFloat(
				computeIconStyle( { ...box, fit: { mode: 'shrink' } } ).left
			)
		).toBe( 114 );
	} );
} );

describe( 'an icon asked to sit flush', () => {
	// Flush is the author saying the picture finishes the word: no gap, and no
	// small-icon centring either, because a narrow icon's middle is held half a
	// box out and that would leave the very space the answer asked to remove.
	const box = {
		titleBox: { left: 10, top: 20, width: 100, height: 40 },
		wrapperBox: { width: 300, height: 100 },
		iconWidth: 8,
		position: 'right',
	};

	it( 'drops the gap and the centring together', () => {
		const flush = computeIconStyle( { ...box, gap: 0, flush: true } );

		expect( parseFloat( flush.left ) ).toBe( 110 );
	} );

	it( 'still centres a narrow icon when only the gap is taken away', () => {
		// What a zero gap alone would do: the 8px icon keeps its 6px shift
		// and so still stands 6px away from the words.
		expect(
			parseFloat( computeIconStyle( { ...box, gap: 0 } ).left )
		).toBe( 116 );
	} );
} );

describe( 'which room the icon is given', () => {
	const WIDTH = 900;
	const ICON_SIZE = 67;
	const TEXT = { left: 4, top: 40, width: 300, height: 60 };

	/**
	 * Build the editor's shape, with a layout jsdom does not provide.
	 *
	 * The wrapper is placed at `wrapperLeft` on the page, and the icon reports
	 * the rect its own inline style puts it in — so the placement under test is
	 * what the off-page test reads back, exactly as in a browser.
	 *
	 * @param {number} wrapperLeft Where the wrapper starts on the page. * @return {Object} Test scene containing the wrapper, icon, and title.
	 */
	const scene = ( wrapperLeft ) => {
		document.body.innerHTML =
			'<div id="w"><span id="i"></span><h1 id="t">Breaking News Story</h1></div>';

		const wrapper = document.getElementById( 'w' );
		const icon = document.getElementById( 'i' );
		const title = document.getElementById( 't' );

		wrapper.getBoundingClientRect = () => ( {
			left: wrapperLeft,
			top: 0,
			width: WIDTH,
			height: 200,
			right: wrapperLeft + WIDTH,
			bottom: 200,
		} );

		// The rect above is the room the icon is placed in: the box is measured
		// from the element's own geometry, not from `clientWidth`, which is 0 on
		// an inline element and would leave jsdom's wrapper — and a theme's
		// inline title — with no box at all.
		Object.defineProperty( icon, 'offsetWidth', {
			value: ICON_SIZE,
			configurable: true,
		} );

		// The title's own text, which jsdom cannot measure either.
		document.createRange = () => ( {
			selectNodeContents: () => {},
			setStartAfter: () => {},
			setEndBefore: () => {},
			getBoundingClientRect: () => ( {
				left: wrapperLeft + TEXT.left,
				top: TEXT.top,
				width: TEXT.width,
				height: TEXT.height,
				right: wrapperLeft + TEXT.left + TEXT.width,
				bottom: TEXT.top + TEXT.height,
			} ),
		} );

		// The icon reports where its own style has just put it.
		icon.getBoundingClientRect = () => {
			const left = icon.style.right
				? wrapperLeft +
					WIDTH -
					parseFloat( icon.style.right ) -
					ICON_SIZE
				: wrapperLeft + parseFloat( icon.style.left || 0 );

			return {
				left,
				right: left + ICON_SIZE,
				top: TEXT.top,
				bottom: TEXT.top + ICON_SIZE,
				width: ICON_SIZE,
				height: ICON_SIZE,
			};
		};

		return { doc: document, icon, wrapper, title };
	};

	/**
	 * The icon's left edge in the wrapper's coordinates.
	 *
	 * @param {Element} icon Icon element.
	 * @return {number} Pixels from the wrapper's left edge.
	 */
	const iconLeft = ( icon ) =>
		icon.style.right
			? WIDTH - parseFloat( icon.style.right ) - ICON_SIZE
			: parseFloat( icon.style.left );

	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'uses the space beside the title when that space is on the page', () => {
		// The wrapper starts well inside the window, so the theme's own padding
		// to its left is room the icon may stand in — which is the case the
		// editor used to get wrong by refusing to leave the wrapper.
		const { doc, icon, wrapper, title } = scene( 200 );

		placeIcon( doc, icon, wrapper, title, 'left' );

		const left = iconLeft( icon );
		const gap = iconGap( window.getComputedStyle( title ).fontSize );

		// The middle is held at one gap plus half the anchor box from the text,
		// so a 67px icon reaches over the start of the title rather than only
		// outwards — the trade for a middle that does not move on resize.
		expect( left ).toBeLessThan( 0 );
		expect( left + ICON_SIZE ).toBeLessThanOrEqual( TEXT.left );
		expect( gap ).toBeGreaterThan( 0 );
	} );

	it( 'lets a widget icon keep its clearance however far inwards it is nudged', () => {
		// The card icon labels the words it sits beside, so the front end passes
		// `minimumGap` for it. The same -100 nudge that buries a post-title icon
		// in the letters stops at the clearance here.
		const { doc, icon, wrapper, title } = scene( 200 );

		// jsdom reports the title's `2em` as a relative length rather than
		// resolving it, so the size the placement scales by is given directly.
		placeIcon( doc, icon, wrapper, title, 'right', {
			offsetX: -100,
			offsetY: 0,
			fontSize: '40px',
			minimumGap: ICON_MIN_CLEARANCE,
		} );

		// `left` is written in the wrapper's coordinates; the text is measured
		// on the page, so the wrapper's own origin goes back on.
		const textRight = 200 + TEXT.left + TEXT.width;
		const clearance = 200 + parseFloat( icon.style.left ) - textRight;

		expect( iconGap( 40 ) ).toBeGreaterThan( ICON_MIN_CLEARANCE );
		expect( clearance ).toBeGreaterThanOrEqual( ICON_MIN_CLEARANCE - 1e-6 );
		expect( clearance ).toBeCloseTo( ICON_MIN_CLEARANCE, 5 );
	} );

	it( "still buries a post-title icon in the words, which is the author's call", () => {
		// No `minimumGap`: the post's own title has no clearance rule, and an
		// offset may deliberately cover the letters.
		const { doc, icon, wrapper, title } = scene( 200 );

		placeIcon( doc, icon, wrapper, title, 'right', {
			offsetX: -100,
			offsetY: 0,
			fontSize: '40px',
		} );

		const textRight = 200 + TEXT.left + TEXT.width;

		expect( parseFloat( icon.style.left ) - textRight ).toBeLessThan( 0 );
	} );

	it( 'moves back only as far as the page\u2019s edge', () => {
		// The wrapper is almost against the window's left edge, so an icon
		// beside the title hangs off the page. It is moved to the page's edge
		// rather than to the wrapper's: only the part that would be clipped is
		// given back, so the overlap with the words the author set stays.
		const { doc, icon, wrapper, title } = scene( 10 );

		placeIcon( doc, icon, wrapper, title, 'left' );

		const wrapperLeft = wrapper.getBoundingClientRect().left;

		// The icon's left edge sits on the window's left edge (0), which is
		// 10px outside the wrapper — not at the wrapper's own edge.
		expect( wrapperLeft + iconLeft( icon ) ).toBeCloseTo( 0, 5 );
		expect( iconLeft( icon ) ).toBeLessThan( 0 );
	} );
} );

describe( 'a title whose own box is its words', () => {
	// A theme is free to shrink-wrap its title — `h1 { display: inline }` — and
	// then the heading's box is the words rather than a full-width line. On an
	// inline element `clientWidth` and `clientHeight` are both 0, so a box read
	// off them collapses, and every placement anchored to a far edge is measured
	// from nothing: measured live, an "above the title" icon landed *below* the
	// title, anchored 0px from the bottom of an empty box. The box therefore
	// comes from the element's own geometry.
	const INLINE_BOX = { left: 50, top: 204.8, width: 828, height: 65 };

	/**
	 * Place an icon against an inline title.
	 *
	 * @param {string}  position Position keyword.
	 * @param {boolean} wrapped  Whether the fake title has multiple text lines.
	 * @param {Object}  options  Placement options, e.g. `iconAnchor`.
	 * @return {{icon: Element, gap: number}} The placed icon, and the gap the
	 *         placement asked for at this title's size.
	 */
	const inlineScene = ( position, wrapped = false, options = {} ) => {
		document.body.innerHTML =
			'<h1 id="t" style="display:inline">Breaking News Story</h1>';

		const title = document.getElementById( 't' );
		const rect = () => ( {
			...INLINE_BOX,
			right: INLINE_BOX.left + INLINE_BOX.width,
			bottom: INLINE_BOX.top + INLINE_BOX.height,
		} );
		const lineRects = [
			{
				left: 120,
				top: INLINE_BOX.top,
				width: 80,
				height: 30,
				right: 200,
				bottom: INLINE_BOX.top + 30,
			},
			{
				left: 180,
				top: INLINE_BOX.top + 33,
				width: 55,
				height: 34,
				right: 235,
				bottom: INLINE_BOX.top + 67,
			},
		];

		title.getBoundingClientRect = rect;

		// What an inline element reports, and what the placement must not use.
		Object.defineProperty( title, 'clientWidth', {
			value: 0,
			configurable: true,
		} );
		Object.defineProperty( title, 'clientHeight', {
			value: 0,
			configurable: true,
		} );

		// The icon goes into the heading, which is where the front end puts it.
		const icon = document.createElement( 'span' );
		icon.style.width = '35px';
		title.insertBefore( icon, title.firstChild );

		Object.defineProperty( icon, 'offsetWidth', {
			value: 35,
			configurable: true,
		} );
		icon.getBoundingClientRect = () => ( {
			left: 0,
			top: 0,
			right: 35,
			bottom: 35,
			width: 35,
			height: 35,
		} );

		// jsdom cannot measure the title's text either.
		document.createRange = () => ( {
			selectNodeContents: () => {},
			setStartAfter: () => {},
			setEndBefore: () => {},
			getBoundingClientRect: rect,
			getClientRects: () => ( wrapped ? lineRects : [ rect() ] ),
		} );

		const gap = iconGap( window.getComputedStyle( title ).fontSize );

		placeIcon( document, icon, title, title, position, options );

		return { icon, gap };
	};

	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'puts "above the title" above it, not below', () => {
		const { icon, gap } = inlineScene( 'top' );

		// `bottom` anchors the icon from the far edge of the box, and the text
		// fills that box here — so the title's own height is what the number is
		// made of, and a box of no height cannot produce it.
		expect( parseFloat( icon.style.bottom ) ).toBeCloseTo(
			INLINE_BOX.height + gap,
			5
		);
	} );

	it( 'keeps a wrapped title\u2019s icon on the first line by default', () => {
		const { icon, gap } = inlineScene( 'left', true );

		// The lines here are 30px and 34px tall. Measured from the first line,
		// the icon's middle is 15px down the heading — where the author put it —
		// not 32.5px, the middle of the two lines together.
		expect( parseFloat( icon.style.top ) ).toBeCloseTo( 15, 5 );
		// The first line starts at x=120 while the box starts at x=50, so the
		// icon belongs before that line's first character, not beside the
		// block's edge: anchored to the block it stood 70px away from the
		// words it labels.
		expect( parseFloat( icon.style.right ) ).toBeCloseTo(
			INLINE_BOX.width - ( 120 - INLINE_BOX.left ) + gap,
			5
		);
	} );

	it( 'puts a wrapped title\u2019s icon after the last word of its own line', () => {
		const { icon, gap } = inlineScene( 'right', true );

		// The first line ends at x=200, the block at x=878. A right icon on the
		// first line is measured from that line's last character.
		expect( parseFloat( icon.style.left ) ).toBeCloseTo(
			200 - INLINE_BOX.left + gap,
			5
		);
	} );

	it( 'centres on all the lines when the site asks for the whole title', () => {
		const { icon } = inlineScene( 'left', true, { iconAnchor: 'block' } );

		// The older rule, kept as a choice: the icon is centred on the
		// paragraph, so a second line pulls it down.
		expect( parseFloat( icon.style.top ) ).toBeCloseTo(
			INLINE_BOX.height / 2,
			5
		);
	} );

	it( 'centres on the last line when the site asks for the end of the words', () => {
		const { icon } = inlineScene( 'left', true, {
			iconAnchor: 'last_line',
		} );

		// The lines here are 30px and 34px tall, and the second starts 33px
		// down, so its middle is at 50px — not 32.5px, the middle of the box.
		expect( parseFloat( icon.style.top ) ).toBeCloseTo( 50, 5 );
	} );

	it( 'puts a right-side icon after the last word of the last line', () => {
		const { icon, gap } = inlineScene( 'right', true, {
			iconAnchor: 'last_line',
		} );

		// The title's own box is far wider than its text here (828px against a
		// last line ending at 235). Anchored to the last line, the icon belongs
		// after that line's last word — not out at the box's edge, which on a
		// real wrapped post left it 208px away from the words it was anchored to.
		expect( parseFloat( icon.style.left ) ).toBeCloseTo(
			235 - INLINE_BOX.left + gap,
			5
		);
	} );
} );

describe( 'the editor\u2019s own placement', () => {
	// The regression this file exists for: the editor placed its icon against
	// the post title wrapper alone, and WordPress' wrapper leaves almost no room
	// to the left of the words, so a left icon was pulled back on top of the
	// title's first character. Nothing here is hypothetical — this is the call
	// the canvas actually makes.
	const WIDTH = 900;

	/**
	 * Build the editor's own markup, with a layout jsdom does not provide.
	 *
	 * The wrapper stands for the heading's own box: the icon is a DOM sibling of
	 * the heading — it cannot be a child, because the heading is
	 * `contenteditable` and a child of it would be saved with the title — so the
	 * wrapper is what the icon is positioned against. WordPress' wrapper holds
	 * nothing but the heading, which is why the two boxes are one box, and why
	 * the same number means the same thing here as on the page.
	 *
	 * @param {boolean} wrapped Whether the title's text takes two lines.
	 * @return {Element} The title wrapper.
	 */
	const editorScene = ( wrapped = false ) => {
		document.body.innerHTML =
			'<div class="editor-visual-editor__post-title-wrapper" id="w">' +
			'<h1 class="editor-post-title__input" id="t">Breaking News Story</h1></div>';

		const wrapper = document.getElementById( 'w' );

		wrapper.getBoundingClientRect = () => ( {
			left: 200,
			top: 0,
			width: WIDTH,
			height: 200,
			right: 200 + WIDTH,
			bottom: 200,
		} );
		// The title's text starts 4px inside the wrapper — a title with no
		// room to its left, which is what WordPress renders.
		document.createRange = () => ( {
			selectNodeContents: () => {},
			setStartAfter: () => {},
			setEndBefore: () => {},
			getBoundingClientRect: () => ( {
				left: 204,
				top: 40,
				width: 300,
				height: 60,
				right: 504,
				bottom: 100,
			} ),
			// Two text lines when wrapped: 30px tall and then 27px, with the
			// gap between them that the union rect already spans.
			getClientRects: () =>
				wrapped
					? [
							{ left: 204, top: 40, width: 300, height: 30 },
							{ left: 204, top: 73, width: 180, height: 27 },
						]
					: [ { left: 204, top: 40, width: 300, height: 60 } ],
		} );

		return wrapper;
	};

	/**
	 * Run `body` with every element reporting the width its own style asks for.
	 *
	 * jsdom has no layout, so `offsetWidth` is otherwise always 0 — and the icon
	 * is built inside the call under test, so it cannot be stubbed up front.
	 *
	 * @param {Function} body Test body.
	 * @return {void} Runs the test body with a measurable icon width.
	 */
	const withIconWidth = ( body ) => {
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
			body();
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
	};

	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'stands the icon clear of the words, in the page\u2019s room', () => {
		editorScene();

		withIconWidth( () => {
			syncEditorIcon( {
				asset: { url: 'https://example.test/a.gif', size: '67px' },
				position: 'left',
				signature: 'sig',
			} );
		} );

		const icon = document.querySelector( '[data-titlesparks-editor-icon]' );

		expect( icon ).not.toBeNull();

		// The icon's left edge in the heading's coordinates.
		const left = WIDTH - parseFloat( icon.style.right ) - 67;

		// Inside the page to the left of the heading, which is where the theme's
		// own padding is — not clamped to the heading's edge. The middle is what
		// the placement holds, so a 67px icon reaches over the beginning of the
		// heading rather than hanging wholly outside it.
		expect( left ).toBeLessThan( 0 );
		expect( left + 67 ).toBeLessThanOrEqual( 4 );
	} );

	it( 'moves an icon that runs off the page back only as far as it must', () => {
		// The canvas at 700px: its title wrapper starts 8px in from the window,
		// so a nudge bigger than that gutter puts the icon's own edge past the
		// window. The nudge is meant to reach over the words, so the fallback
		// may give back only the overhang — pulling the icon to the wrapper's
		// edge instead puts it beside the words, which is what the editor
		// showed while the page showed the overlap.
		const wrapper = editorScene();
		const title = wrapper.querySelector( 'h1' );
		const view = document.defaultView;
		const innerWidth = Object.getOwnPropertyDescriptor(
			view,
			'innerWidth'
		);

		try {
			Object.defineProperty( view, 'innerWidth', {
				configurable: true,
				value: 700,
			} );

			withIconWidth( () => {
				const icon = buildIcon( document, {
					url: 'https://example.test/a.gif',
					size: '42px',
				} );
				wrapper.insertBefore( icon, title );

				// A quarter of a pixel of the icon hangs off the window before the
				// fallback. The second read is the same node once it has moved.
				let reads = 0;

				icon.getBoundingClientRect = () => {
					reads++;
					const left = 1 === reads ? -0.25 : 0;

					return {
						left,
						right: left + 42,
						top: 0,
						bottom: 42,
						width: 42,
						height: 42,
					};
				};

				placeIcon( document, icon, wrapper, title, 'left', {
					fontSize: '32px',
					offsetX: 120,
					offsetY: 0,
				} );

				// The wrapper is 900 wide and its text starts 4px in, so a 120px
				// nudge at a 32px title sits at right = 900 - 4 + 4.8 - 120. Only
				// the quarter-pixel overhang comes off that, while the wrapper's
				// own edge would be 900 - 42 = 858 — more than 70px away, beside
				// the words instead of over them.
				expect( parseFloat( icon.style.right ) ).toBeCloseTo(
					900 - 4 + 4.8 - 120 - 0.25,
					5
				);
				expect( parseFloat( icon.style.right ) ).toBeLessThan( 858 );
			} );
		} finally {
			if ( innerWidth ) {
				Object.defineProperty( view, 'innerWidth', innerWidth );
			}
		}
	} );

	it( 'moves the icon it already has instead of replacing it', () => {
		editorScene();

		withIconWidth( () => {
			const asset = {
				url: 'https://example.test/a.gif',
				size: '20px',
			};

			syncEditorIcon( {
				asset,
				position: 'left',
				signature: 'sig',
				offsetX: 0,
				offsetY: 0,
			} );

			const first = document.querySelector(
				'[data-titlesparks-editor-icon]'
			);
			const resting = {
				right: parseFloat( first.style.right ),
				top: parseFloat( first.style.top ),
			};

			syncEditorIcon( {
				asset,
				position: 'left',
				signature: 'sig',
				offsetX: 12,
				offsetY: -7,
			} );

			const second = document.querySelector(
				'[data-titlesparks-editor-icon]'
			);

			// The same node, moved. A replaced node would restart an animated
			// GIF and lose the frame it had drawn, which is what made nudging
			// the icon look like a flicker rather than a slide.
			expect( second ).toBe( first );
			// Positive X moves the icon right, and `right` counts inwards from
			// the far edge, so the nudge shrinks it. A negative Y moves it up.
			expect( parseFloat( second.style.right ) ).toBeLessThan(
				resting.right
			);
			expect( parseFloat( second.style.top ) ).toBeLessThan(
				resting.top
			);
		} );
	} );

	it( 'keeps a wrapped canvas title\u2019s icon on the first line', () => {
		editorScene( true );

		withIconWidth( () => {
			syncEditorIcon( {
				asset: { url: 'https://example.test/a.gif', size: '20px' },
				position: 'left',
				signature: 'sig',
			} );
		} );

		const icon = document.querySelector( '[data-titlesparks-editor-icon]' );

		// The first line's middle: 40 + 30/2. The canvas and the page agree on
		// this rule, which is the whole point of the shared placement.
		expect( parseFloat( icon.style.top ) ).toBeCloseTo( 55, 5 );
		expect( icon.style.transform ).toBe( 'translateY(-50%)' );
	} );

	it( 'sizes a title-following icon from its bands and leaves a fixed one alone', () => {
		// A stage that follows the title takes the icon size its title's band
		// asks for; a fixed stage keeps the size the author chose, even beside
		// a title the bands would have resized.
		const rules = [
			{ font: 12, icon: 10 },
			{ font: 16, icon: 12 },
			{ font: 32, icon: 24 },
		];
		const wrapper = editorScene();
		const title = wrapper.querySelector( 'h1' );
		const doc = document;
		const icon = buildIcon( doc, {
			url: 'https://example.test/a.gif',
			size: '20px',
		} );

		wrapper.insertBefore( icon, title );

		const placeStage = ( extra ) =>
			withIconWidth( () =>
				placeIcon( doc, icon, wrapper, title, 'left', {
					fontSize: '15px',
					offsetX: 0,
					offsetY: 0,
					...extra,
				} )
			);

		placeStage( { adaptive: false, sizingRules: rules } );
		expect( icon.style.width ).toBe( '20px' );

		// A 15px title is still covered by the 12/10 row, which holds until
		// the 16 row takes over, so the icon is the 10px that row names.
		placeStage( { adaptive: true, sizingRules: rules } );
		expect( icon.style.width ).toBe( '10px' );
	} );

	it( 'centres on the whole title when the site asks for that', () => {
		editorScene( true );

		withIconWidth( () => {
			syncEditorIcon( {
				asset: { url: 'https://example.test/a.gif', size: '20px' },
				position: 'left',
				signature: 'sig',
				iconAnchor: 'block',
			} );
		} );

		const icon = document.querySelector( '[data-titlesparks-editor-icon]' );

		// The text's own middle: 40 + 60/2, the older rule.
		expect( parseFloat( icon.style.top ) ).toBeCloseTo( 70, 5 );
		expect( icon.style.transform ).toBe( 'translateY(-50%)' );
	} );
} );

describe( 'telling whether an icon is off the page', () => {
	it( 'reads the window it is rendered in', () => {
		const icon = document.createElement( 'span' );
		const view = { innerWidth: 1000 };

		document.body.appendChild( icon );

		icon.getBoundingClientRect = () => ( {
			left: 10,
			right: 100,
		} );
		expect( iconOffscreen( icon, view ) ).toBe( false );

		// A negative edge means it starts left of the page, and a right edge
		// past the window means it runs off the near side.
		icon.getBoundingClientRect = () => ( { left: -5, right: 60 } );
		expect( iconOffscreen( icon, view ) ).toBe( true );

		icon.getBoundingClientRect = () => ( { left: 950, right: 1010 } );
		expect( iconOffscreen( icon, view ) ).toBe( true );

		icon.remove();
	} );

	it( 'never calls an icon off screen when it cannot measure the window', () => {
		// An unmeasurable window must not silently take the fallback, which is
		// the placement that sits on the title.
		const icon = document.createElement( 'span' );

		document.body.appendChild( icon );
		icon.getBoundingClientRect = () => ( { left: -50, right: 20 } );

		expect( iconOffscreen( icon, null ) ).toBe( false );
		expect( iconOffscreen( icon, { innerWidth: 0 } ) ).toBe( false );

		icon.remove();
	} );
} );

describe( 'offset sanitising', () => {
	it( 'keeps a signed number of pixels', () => {
		expect( sanitizeOffset( -4 ) ).toBe( -4 );
		expect( sanitizeOffset( '-12' ) ).toBe( -12 );
		expect( sanitizeOffset( 0 ) ).toBe( 0 );
	} );

	it( 'rounds to whole pixels, in both directions', () => {
		expect( sanitizeOffset( -3.7 ) ).toBe( -3 );
		expect( sanitizeOffset( '6.2' ) ).toBe( 6 );
	} );

	it( 'clamps to the range the server enforces', () => {
		expect( sanitizeOffset( -9999 ) ).toBe( -OFFSET_MAX );
		expect( sanitizeOffset( 9999 ) ).toBe( OFFSET_MAX );
		// Mirrors `Security::MAX_OFFSET`; changing one without the other would
		// let the editor write a value the server then rewrites.
		expect( OFFSET_MAX ).toBe( 100 );
	} );

	it( 'falls back to zero for anything unusable', () => {
		expect( sanitizeOffset( '' ) ).toBe( 0 );
		expect( sanitizeOffset( null ) ).toBe( 0 );
		expect( sanitizeOffset( '-' ) ).toBe( 0 );
		expect( sanitizeOffset( 'abc' ) ).toBe( 0 );
		expect( emptyOffset() ).toEqual( { x: 0, y: 0 } );
		expect( emptyOffset( { x: -5 } ) ).toEqual( { x: -5, y: 0 } );
	} );

	it( 'gives every position an offset, however sparse the stored value', () => {
		const offsets = emptyOffsets( { right: { x: -5, y: 3 } } );

		expect( Object.keys( offsets ).sort() ).toEqual(
			[ ...POSITION_VALUES ].sort()
		);
		expect( offsets.right ).toEqual( { x: -5, y: 3 } );
		expect( offsets.left ).toEqual( { x: 0, y: 0 } );
		expect( emptyOffsets().left ).toEqual( { x: 0, y: 0 } );
	} );
} );

describe( 'a line that ends in a space', () => {
	// Chrome gives the space that ends a wrapped line a client rect of its own,
	// so the first line's box reaches a whole space past its last character.
	// An icon asked to sit flush then stands one space away from the words —
	// measured in the block editor, 11px beside a 40px title, which is exactly
	// the gap flush was chosen to remove. The words' own edge is what the
	// placement has to measure.
	const TITLE = { left: 50, top: 0, width: 500, height: 70 };
	const TEXT = 'Breaking News Story';
	const WRAP = TEXT.indexOf( ' Story' );

	/**
	 * Place an icon against a title whose first line ends in a hung space.
	 *
	 * @param {string} position Position keyword.
	 * @return {{icon: Element}} The placed icon.
	 */
	const scene = ( position ) => {
		document.body.innerHTML =
			'<h6 id="t" style="display:block;width:500px">Breaking News Story</h6>';

		const title = document.getElementById( 't' );
		const words = title.firstChild;
		const icon = document.createElement( 'span' );

		icon.style.width = '20px';
		title.insertBefore( icon, words );
		Object.defineProperty( icon, 'offsetWidth', {
			value: 20,
			configurable: true,
		} );
		icon.getBoundingClientRect = () => ( {
			left: 0,
			top: 0,
			right: 20,
			bottom: 20,
			width: 20,
			height: 20,
		} );
		const rect = {
			...TITLE,
			right: TITLE.left + TITLE.width,
			bottom: TITLE.top + TITLE.height,
		};

		title.getBoundingClientRect = () => rect;

		const lineOne = {
			left: 120,
			right: 200,
			top: 0,
			bottom: 30,
			width: 80,
			height: 30,
		};
		const hungSpace = {
			left: 200,
			right: 210,
			top: 0,
			bottom: 30,
			width: 10,
			height: 30,
		};
		const lineTwo = {
			left: 120,
			right: 250,
			top: 33,
			bottom: 66,
			width: 130,
			height: 33,
		};
		const box = ( start, end ) => ( end <= WRAP ? lineOne : lineTwo );

		// A range that answers the two ways the measurement uses it: over the
		// whole title, and over the prefix or suffix a character search asks
		// about. The offsets are what decide which line a probe reaches.
		document.createRange = () => {
			const state = {
				container: null,
				offset: 0,
				probe: false,
				start: 0,
				end: TEXT.length,
			};
			const range = {
				get startContainer() {
					return state.container;
				},
				get startOffset() {
					return state.offset;
				},
				selectNodeContents() {
					state.container = title;
					state.offset = 0;
				},
				setStartAfter() {
					state.container = title;
					state.offset = 1;
				},
				setStart( node, offset ) {
					state.probe = true;
					state.container = node;
					state.start = offset;
				},
				setEnd( node, offset ) {
					state.probe = true;
					state.end = offset;
				},
				toString: () => TEXT,
				getClientRects: () =>
					state.probe
						? [ box( state.start, state.end ) ]
						: [ lineOne, hungSpace, lineTwo ],
				getBoundingClientRect: () =>
					state.probe
						? box( state.start, state.end )
						: {
								left: 120,
								right: 250,
								top: 0,
								bottom: 66,
								width: 130,
								height: 66,
							},
			};

			return range;
		};

		placeIcon( document, icon, title, title, position, {
			fontSize: '32px',
			spacing: 'flush',
		} );

		return { icon };
	};

	it( 'ignores a space typed in front of the title', () => {
		// The same measurement on the other side: a title typed with a leading
		// space must not push a left icon out by the width of that space.
		document.body.innerHTML =
			'<h6 id="t" style="display:block;width:500px"> Breaking News Story</h6>';

		const title = document.getElementById( 't' );
		const words = title.firstChild;
		const icon = document.createElement( 'span' );
		const text = ' Breaking News Story';

		icon.style.width = '20px';
		title.insertBefore( icon, words );
		Object.defineProperty( icon, 'offsetWidth', {
			value: 20,
			configurable: true,
		} );
		icon.getBoundingClientRect = () => ( {
			left: 0,
			top: 0,
			right: 20,
			bottom: 20,
			width: 20,
			height: 20,
		} );
		title.getBoundingClientRect = () => ( {
			left: 50,
			top: 0,
			right: 550,
			bottom: 40,
			width: 500,
			height: 40,
		} );

		// The space occupies 108..120; the words start at 120.
		const rect = ( start ) =>
			start < 1
				? {
						left: 108,
						right: 400,
						top: 0,
						bottom: 30,
						width: 292,
						height: 30,
					}
				: {
						left: 120,
						right: 400,
						top: 0,
						bottom: 30,
						width: 280,
						height: 30,
					};

		document.createRange = () => {
			const state = {
				container: null,
				offset: 0,
				probe: false,
				start: 0,
				end: text.length,
			};

			return {
				get startContainer() {
					return state.container;
				},
				get startOffset() {
					return state.offset;
				},
				selectNodeContents() {
					state.container = title;
					state.offset = 0;
				},
				setStartAfter() {
					state.container = title;
					state.offset = 1;
				},
				setStart( node, offset ) {
					state.probe = true;
					state.container = node;
					state.start = offset;
				},
				setEnd( node, offset ) {
					state.probe = true;
					state.end = offset;
				},
				toString: () => text,
				getClientRects: () => [ rect( 0 ) ],
				getBoundingClientRect: () =>
					state.probe ? rect( state.start ) : rect( 0 ),
			};
		};

		placeIcon( document, icon, title, title, 'left', {
			fontSize: '32px',
			spacing: 'flush',
		} );

		// The words begin at 120; the space runs from 108. Measured to the space
		// the icon's own right edge would sit at 108.
		expect( parseFloat( icon.style.right ) ).toBeCloseTo( 550 - 120, 5 );
	} );

	it( 'measures the first line to its last word, not to the space the wrap leaves', () => {
		const { icon } = scene( 'right-top' );

		// The words end at 200; the hung space reaches 210. Anchored at the box
		// this would be 210 - 50 + the title's width, one space too far.
		expect( parseFloat( icon.style.left ) ).toBeCloseTo(
			200 - TITLE.left,
			5
		);
	} );
} );
