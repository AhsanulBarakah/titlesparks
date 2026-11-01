/**
 * The stage card, rendered.
 *
 * The maths behind a stage is checked elsewhere; this checks the controls that
 * write it, because those are the part an author actually touches — and the
 * part a helper cannot prove. Rendering the card is the only way to know that
 * the size fields describe the asset's size when the stage has none of its own,
 * that typing a number writes a length the server will keep, and that clearing
 * the end of a stage really does skip it.
 */

import { createRoot } from '@wordpress/element';
import { act } from 'react';

import StageEditor from '../StageEditor';
import { emptyOffsets, emptyStage, emptyTimeline } from '../constants';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock( '@wordpress/i18n', () => ( {
	__: ( text ) => text,
	sprintf: ( format, ...args ) =>
		args.reduce(
			( text, value, index ) =>
				text.replace(
					new RegExp( `%${ index + 1 }\\$[sd]|%[sd]` ),
					value
				),
			format
		),
} ) );

const ASSETS = [
	{
		id: 'a1',
		url: 'https://example.test/one.gif',
		label: 'One',
		size: '24px',
	},
	{
		id: 'a2',
		url: 'https://example.test/two.svg',
		label: 'Two',
		size: '16px',
	},
	{
		id: 'a3',
		url: 'https://example.test/three.jpg',
		label: 'Three',
		size: '32px',
	},
];

const ANCHOR = '2026-10-01 12:00:00';

/**
 * Set a control's value the way a browser does.
 *
 * React tracks the last value it rendered and ignores a change it believes it
 * already knows about, so the value is written through the native setter before
 * the event is dispatched — otherwise the field would look editable and never
 * report anything.
 *
 * @param {Element} element Input or select.
 * @param {string}  value   Next value.
 * @return {void}
 */
const type = ( element, value ) => {
	const prototype =
		'SELECT' === element.tagName
			? window.HTMLSelectElement.prototype
			: window.HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor( prototype, 'value' ).set;

	act( () => {
		setter.call( element, value );
		element.dispatchEvent( new window.Event( 'input', { bubbles: true } ) );
		element.dispatchEvent(
			new window.Event( 'change', { bubbles: true } )
		);
	} );
};

/**
 * Render the card and hand back its container.
 *
 * @param {Object}  stage                 Overrides for stage 1.
 * @param {Object}  [moved]               Offsets keyed by position.
 * @param {Object}  [options]             Render options.
 * @param {boolean} [options.expanded]    Open the card before returning it.
 *                                        Defaults to true, because the controls
 *                                        live behind the header now.
 * @param {boolean} [options.isLiveStage] Whether this stage is shown on the title.
 * @return {Object} Container, props, the header toggle, rerender and unmount.
 */
const renderCard = (
	stage = {},
	moved,
	{ expanded = true, isLiveStage = false } = {}
) => {
	const timeline = emptyTimeline( {
		enabled: true,
		stage_1: {
			asset_id: 'a1',
			position: 'left',
			duration: 1,
			unit: 'days',
			...stage,
		},
	} );
	const props = {
		timeline,
		index: 1,
		stage: timeline.stage_1,
		assets: ASSETS,
		anchorDate: ANCHOR,
		offsets: moved || emptyOffsets(),
		isLiveStage,
		onChange: jest.fn(),
		onOffsetChange: jest.fn(),
		disabled: false,
	};
	const container = document.createElement( 'div' );

	document.body.appendChild( container );

	const root = createRoot( container );

	act( () => root.render( <StageEditor { ...props } /> ) );

	const toggle = container.querySelector( '[aria-expanded]' );

	if ( expanded ) {
		act( () => toggle.click() );
	}

	return {
		container,
		props,
		toggle,
		rerender: ( nextProps = {} ) =>
			act( () =>
				root.render( <StageEditor { ...props } { ...nextProps } /> )
			),
		unmount: () => act( () => root.unmount() ),
	};
};

afterEach( () => {
	document.body.innerHTML = '';
	delete window.titleSparksEditorData;
} );

describe( 'the live stage header', () => {
	it( 'uses a yellow-gold fill only while the live stage is collapsed', () => {
		const { toggle, unmount } = renderCard( {}, undefined, {
			expanded: false,
			isLiveStage: true,
		} );

		expect( toggle.className ).toContain( 'titlesparks:bg-amber-300' );

		act( () => toggle.click() );

		expect( toggle.className ).toContain( 'titlesparks:bg-brand-50' );

		unmount();
	} );

	it( 'keeps a non-live collapsed stage in the normal color', () => {
		const { toggle, unmount } = renderCard( {}, undefined, {
			expanded: false,
			isLiveStage: false,
		} );

		expect( toggle.className ).toContain( 'titlesparks:bg-brand-50' );
		expect( toggle.className ).not.toContain( 'titlesparks:bg-amber-300' );

		unmount();
	} );
} );

describe( 'the position picker', () => {
	it( 'offers the two sides only', () => {
		const { container, unmount } = renderCard( { position: 'left' } );
		const select = container.querySelector( 'select' );
		const options = [ ...select.options ];

		expect( options.map( ( option ) => option.value ) ).toEqual( [
			'left',
			'right',
		] );
		expect( options.map( ( option ) => option.textContent ) ).toEqual( [
			'Left of title',
			'Right of title',
		] );

		unmount();
	} );
} );

describe( 'the size control', () => {
	it( 'mirrors the icon for this stage only', () => {
		const { container, props, unmount } = renderCard();
		const box = container.querySelector( 'input[type="checkbox"]' );

		expect( box.checked ).toBe( false );

		act( () => box.click() );

		expect( props.onChange.mock.calls[ 0 ][ 0 ] ).toEqual( {
			...emptyStage( props.stage ),
			flip: true,
		} );

		unmount();
	} );

	it( 'describes the asset size while the stage has none of its own', () => {
		const { container, unmount } = renderCard();
		const number = container.querySelector( '#titlesparks-size-1' );
		const unit = container.querySelector( '[aria-label="Icon size unit"]' );

		// Empty, with the asset's size as the placeholder: the field shows the
		// size that will be drawn while still saying it is not this stage's own.
		expect( number.value ).toBe( '' );
		expect( number.placeholder ).toBe( '24' );
		expect( unit.value ).toBe( 'px' );
		// No hint line: the placeholder already shows the size that will be
		// drawn, and a second line saying "asset" was one label too many.
		expect( container.textContent ).not.toContain( 'Asset' );

		unmount();
	} );

	it( 'writes a CSS length when a number is typed', () => {
		const { container, props, unmount } = renderCard();

		type( container.querySelector( '#titlesparks-size-1' ), '30' );

		expect( props.onChange ).toHaveBeenCalledTimes( 1 );
		expect( props.onChange.mock.calls[ 0 ][ 0 ] ).toEqual( {
			...emptyStage( props.stage ),
			size: '30px',
		} );

		unmount();
	} );

	it( 'keeps the number when only the unit changes', () => {
		const { container, props, unmount } = renderCard( { size: '20px' } );

		expect( container.querySelector( '#titlesparks-size-1' ).value ).toBe(
			'20'
		);

		type(
			container.querySelector( '[aria-label="Icon size unit"]' ),
			'em'
		);

		expect( props.onChange.mock.calls[ 0 ][ 0 ].size ).toBe( '20em' );

		unmount();
	} );

	it( 'shows a size of its own', () => {
		const { container, unmount } = renderCard( { size: '1.5em' } );

		expect( container.querySelector( '#titlesparks-size-1' ).value ).toBe(
			'1.5'
		);
		expect(
			container.querySelector( '[aria-label="Icon size unit"]' ).value
		).toBe( 'em' );
		// The number and unit carry it; there is no second line saying so.
		expect( container.textContent ).not.toContain( 'Own size' );

		unmount();
	} );

	it( 'goes back to the asset size when the number is cleared', () => {
		const { container, props, unmount } = renderCard( { size: '30px' } );

		type( container.querySelector( '#titlesparks-size-1' ), '' );

		expect( props.onChange.mock.calls[ 0 ][ 0 ].size ).toBe( '' );

		unmount();
	} );

	it( 'refuses a number the server would not keep', () => {
		const { container, props, unmount } = renderCard();

		type( container.querySelector( '#titlesparks-size-1' ), '12345' );

		expect( props.onChange.mock.calls[ 0 ][ 0 ].size ).toBe( '' );

		unmount();
	} );
} );

describe( 'the size label', () => {
	/**
	 * The label on the size field.
	 *
	 * @param {Element} container Rendered card.
	 * @return {string} The label text.
	 */
	const sizeLabel = ( container ) =>
		container.querySelector( 'label[for="titlesparks-size-1"]' )
			.textContent;

	it( 'names the kind of asset the stage sizes', () => {
		const cases = [
			[ 'a1', 'GIF size' ],
			[ 'a2', 'Icon size' ],
			[ 'a3', 'Image size' ],
		];

		cases.forEach( ( [ assetId, expected ] ) => {
			const { container, unmount } = renderCard( {
				asset_id: assetId,
			} );

			expect( sizeLabel( container ) ).toBe( expected );

			unmount();
		} );
	} );

	it( 'falls back to plain "Size" before an asset is picked', () => {
		const { container, unmount } = renderCard( { asset_id: '' } );

		expect( sizeLabel( container ) ).toBe( 'Size' );

		unmount();
	} );
} );

describe( 'the end of a stage', () => {
	it( 'shows the end the stage actually has', () => {
		const { container, unmount } = renderCard();
		const end = container.querySelector( '#titlesparks-end-1' );

		expect( end.value ).toBe( '2026-10-02T12:00' );
		expect( end.min ).toBe( '2026-10-01T12:00' );

		unmount();
	} );

	it( 'skips the stage when the end is cleared', () => {
		const { container, props, unmount } = renderCard();

		type( container.querySelector( '#titlesparks-end-1' ), '' );

		expect( props.onChange.mock.calls[ 0 ][ 0 ].duration ).toBe( 0 );

		unmount();
	} );
} );

describe( 'the stage date badge', () => {
	it( 'uses yellow text without a background fill', () => {
		const { container, unmount } = renderCard();
		const dateWindow = [ ...container.querySelectorAll( 'p' ) ].find(
			( paragraph ) => paragraph.textContent.includes( '→' )
		);

		expect( dateWindow ).not.toBeNull();
		expect( dateWindow.className ).toContain(
			'titlesparks:text-yellow-600'
		);
		expect( dateWindow.className ).toContain( 'titlesparks:text-center' );
		expect( dateWindow.className ).not.toContain( 'titlesparks-bg-' );

		unmount();
	} );
} );

describe( 'the asset preview row', () => {
	it( 'puts the change button on the left and a larger preview on the right', () => {
		const { container, unmount } = renderCard();
		const image = container.querySelector( 'img[alt="One"]' );
		const preview = image.parentElement;
		const row = preview.parentElement;
		const change = [ ...row.querySelectorAll( 'button' ) ].find(
			( button ) => 'Change' === button.textContent
		);

		expect( row.className ).toContain( 'titlesparks:justify-between' );
		expect( row.children[ 0 ] ).toBe( change );
		expect( row.children[ 1 ] ).toBe( preview );
		expect( preview.className ).toContain( 'titlesparks:h-12' );
		expect( preview.className ).toContain( 'titlesparks:w-16' );
		expect( image.className ).toContain( 'titlesparks:max-h-10' );
		expect( image.className ).toContain( 'titlesparks:max-w-14' );

		unmount();
	} );
} );

describe( 'the offset reset', () => {
	it( 'is always visible, including when both offsets are zero', () => {
		const still = renderCard();

		expect( still.container.textContent ).toContain( 'Reset' );
		still.unmount();

		const shown = renderCard(
			{},
			{
				...emptyOffsets(),
				left: { x: -6, y: 0 },
			}
		);

		expect( shown.container.textContent ).toContain( 'Reset' );

		act( () => {
			[ ...shown.container.querySelectorAll( 'button' ) ]
				.find( ( button ) => 'Reset' === button.textContent )
				.click();
		} );

		expect( shown.props.onOffsetChange ).toHaveBeenCalledWith( 'left', {
			x: 0,
			y: 0,
		} );

		shown.unmount();
	} );

	it( 'keeps Reset in the header above the two offset columns', () => {
		const { container, unmount } = renderCard(
			{},
			{
				...emptyOffsets(),
				left: { x: -6, y: 0 },
			}
		);
		const x = container.querySelector( '#titlesparks-offset-1-x' );
		// The utility's class name contains the prefix's colon, so the selector
		// has to escape it: `.titlesparks\:grid`.
		const grid = x.closest( '.titlesparks\\:grid' );
		const header = grid.previousElementSibling;
		const named = ( tag, text ) =>
			[ ...container.querySelectorAll( tag ) ].find(
				( element ) => text === element.textContent
			);

		// The two columns share the row below the header whether Reset is
		// visible or not; Reset stays on the header line rather than moving
		// into a column and shifting the fields.
		expect( grid.children ).toHaveLength( 2 );
		expect( header.className ).toContain( 'titlesparks:flex' );
		expect( named( 'button', 'Reset' ).parentElement ).toBe( header );
		expect(
			[ ...header.children ].some(
				( child ) => 'Offset' === child.textContent
			)
		).toBe( true );

		unmount();
	} );
} );

describe( 'a stage that opens and closes', () => {
	it( 'stays shut until the header is clicked', () => {
		const { container, toggle, unmount } = renderCard( {}, undefined, {
			expanded: false,
		} );

		// Shut: the header is the summary, and none of the controls exist yet.
		expect( toggle.getAttribute( 'aria-expanded' ) ).toBe( 'false' );
		expect( container.querySelector( '#titlesparks-size-1' ) ).toBeNull();
		expect( container.textContent ).toContain( 'Initial Icon' );
		// The icon already chosen is named while the card is closed, so a
		// collapsed stage still says what it will show.
		expect( container.textContent ).toContain( 'One' );

		act( () => toggle.click() );

		expect( toggle.getAttribute( 'aria-expanded' ) ).toBe( 'true' );
		expect(
			container.querySelector( '#titlesparks-size-1' )
		).not.toBeNull();

		unmount();
	} );

	it( 'shuts again on a second click', () => {
		const { container, toggle, unmount } = renderCard();

		expect( toggle.getAttribute( 'aria-expanded' ) ).toBe( 'true' );

		act( () => toggle.click() );

		expect( toggle.getAttribute( 'aria-expanded' ) ).toBe( 'false' );
		expect( container.querySelector( '#titlesparks-size-1' ) ).toBeNull();

		unmount();
	} );
} );

describe( 'the two blocks', () => {
	/**
	 * The block a field belongs to: the nearest ancestor that is a direct child
	 * of the card body.
	 *
	 * @param {Element} body    The card body element.
	 * @param {Element} element A field inside it.
	 * @return {Element} The block wrapper.
	 */
	const blockOf = ( body, element ) => {
		let node = element;

		while ( node.parentElement && node.parentElement !== body ) {
			node = node.parentElement;
		}

		return node;
	};

	it( 'pairs the end with the position, and the offset with the size', () => {
		const { container, unmount } = renderCard();
		const body = container.querySelector( '#titlesparks-stage-1' );

		const end = container.querySelector( '#titlesparks-end-1' );
		const size = container.querySelector( '#titlesparks-size-1' );
		const offset = container.querySelector( '#titlesparks-offset-1-x' );
		const endBlock = blockOf( body, end );
		const sizeBlock = blockOf( body, size );

		// Position and the end share the first block; the size control is not in
		// that one.
		expect( endBlock ).not.toBe( sizeBlock );
		expect( endBlock.querySelector( 'select' ) ).not.toBeNull();
		expect( endBlock.contains( size ) ).toBe( false );

		// Size and the offset share the second.
		expect( sizeBlock.contains( offset ) ).toBe( true );

		unmount();
	} );

	it( 'stacks a block on top of itself rather than onto one line', () => {
		const { container, unmount } = renderCard();
		const body = container.querySelector( '#titlesparks-stage-1' );
		// The body's children are the icon row, then the position/end block.
		const firstBlock = body.children[ 1 ];

		// jsdom has no layout engine, so the stacking is read from the block's
		// own classes: a column, and not the two-column grid the fields used to
		// share.
		expect( firstBlock.className ).toContain( 'titlesparks:flex-col' );
		expect( firstBlock.className ).not.toContain(
			'titlesparks:grid-cols-2'
		);

		unmount();
	} );
} );

describe( 'the offset inputs', () => {
	it( 'are labelled x and y, with no prose beside them', () => {
		const { container, unmount } = renderCard();
		const label = ( axis ) =>
			container.querySelector(
				`label[for="titlesparks-offset-1-${ axis }"]`
			).textContent;

		expect( label( 'x' ) ).toBe( 'x' );
		expect( label( 'y' ) ).toBe( 'y' );
		// The words that used to sit here ("Space right", "Slide up/down") now
		// live in the field's tooltip.
		expect( container.textContent ).not.toContain( 'Space ' );
		expect( container.textContent ).not.toContain( 'Slide ' );

		unmount();
	} );

	it( 'puts each axis label in the same column as its input', () => {
		const { container, unmount } = renderCard(
			{},
			{
				...emptyOffsets(),
				left: { x: -6, y: 3 },
			}
		);
		const x = container.querySelector( '#titlesparks-offset-1-x' );
		const y = container.querySelector( '#titlesparks-offset-1-y' );
		// The utility's class name contains the prefix's colon, so the selector
		// has to escape it: `.titlesparks\:grid`.
		const grid = x.closest( '.titlesparks\\:grid' );
		const header = grid.previousElementSibling;
		const labelFor = ( axis ) =>
			container.querySelector(
				`label[for="titlesparks-offset-1-${ axis }"]`
			);
		const xColumn = x.parentElement;
		const yColumn = y.parentElement;

		// Two equal columns, each one a label directly above its field, so the
		// letters sit over the numbers they name instead of being spread across
		// the header row while the inputs sit elsewhere.
		expect( grid.className ).toContain( 'titlesparks:grid-cols-2' );
		expect( grid.children ).toHaveLength( 2 );
		expect( xColumn ).toBe( grid.children[ 0 ] );
		expect( yColumn ).toBe( grid.children[ 1 ] );
		expect( xColumn.className ).toContain( 'titlesparks:flex-col' );
		expect( yColumn.className ).toContain( 'titlesparks:flex-col' );
		expect( labelFor( 'x' ).parentElement ).toBe( xColumn );
		expect( labelFor( 'y' ).parentElement ).toBe( yColumn );
		expect( labelFor( 'x' ).nextElementSibling ).toBe( x );
		expect( labelFor( 'y' ).nextElementSibling ).toBe( y );

		// The header names the group and owns Reset; the axis letters live with
		// their fields.
		expect( header.textContent ).toContain( 'Offset' );
		expect( header.textContent ).toContain( 'Reset' );
		expect( header.textContent ).not.toContain( 'x' );
		expect( header.textContent ).not.toContain( 'y' );

		unmount();
	} );

	it( 'still saves an edited axis without changing the other offset', () => {
		const { container, props, unmount } = renderCard(
			{},
			{
				...emptyOffsets(),
				left: { x: -6, y: 3 },
			}
		);

		type( container.querySelector( '#titlesparks-offset-1-x' ), '12' );

		expect( props.onOffsetChange ).toHaveBeenCalledWith( 'left', {
			x: 12,
			y: 3,
		} );

		unmount();
	} );

	it( 'lets a negative offset be typed one keystroke at a time', () => {
		const { container, props, unmount } = renderCard();
		const xInput = container.querySelector( '#titlesparks-offset-1-x' );

		props.onOffsetChange.mockClear();

		// A browser reports a half-typed number — a lone minus included — as an
		// empty value for `type="number"`. Writing that back as 0 is what used
		// to erase the sign before the digits could arrive, so a negative
		// offset could not be entered at all.
		type( xInput, '' );

		expect( props.onOffsetChange ).not.toHaveBeenCalled();
		expect( xInput.value ).toBe( '' );

		type( xInput, '-1' );
		type( xInput, '-16' );

		expect( props.onOffsetChange ).toHaveBeenLastCalledWith( 'left', {
			x: -16,
			y: 0,
		} );

		unmount();
	} );

	it( 'starts a fresh number after the field is cleared', () => {
		const { container, props, unmount } = renderCard(
			{},
			{
				...emptyOffsets(),
				left: { x: -6, y: 3 },
			}
		);
		const xInput = container.querySelector( '#titlesparks-offset-1-x' );

		props.onOffsetChange.mockClear();

		// Clearing the field is not a request to save 0: the author is about to
		// type the number they want, and the other axis must keep its value.
		type( xInput, '' );
		expect( props.onOffsetChange ).not.toHaveBeenCalled();

		type( xInput, '4' );

		expect( props.onOffsetChange ).toHaveBeenLastCalledWith( 'left', {
			x: 4,
			y: 3,
		} );

		unmount();
	} );
} );

describe( 'the sizing mode', () => {
	const modeSelect = ( container ) =>
		container.querySelector( '#titlesparks-size-mode-1' );
	const ruleField = ( container, row, key ) =>
		container.querySelector(
			`[aria-label="Stage 1 size ${ row } ${
				'font' === key ? 'title font' : 'icon'
			} size in pixels"]`
		);
	const button = ( container, label ) =>
		[ ...container.querySelectorAll( 'button' ) ].find(
			( item ) => label === item.textContent.trim()
		);

	it( 'offers a fixed size and a custom title-following one', () => {
		const { container, unmount } = renderCard();
		const options = [ ...modeSelect( container ).options ];

		expect( options.map( ( option ) => option.value ) ).toEqual( [
			'fixed',
			'advanced',
		] );
		expect( options.map( ( option ) => option.textContent ) ).toEqual( [
			'Fixed size',
			'Advanced (custom sizes)',
		] );
		expect( modeSelect( container ).value ).toBe( 'fixed' );

		unmount();
	} );

	it( 'switches to the title-following mode and keeps the fixed size', () => {
		// The mode is a switch, not a conversion: going back to a fixed size
		// must find the number the author last typed still there.
		const { container, props, unmount } = renderCard( { size: '30px' } );

		type( modeSelect( container ), 'advanced' );

		expect( props.onChange.mock.calls[ 0 ][ 0 ] ).toEqual( {
			...emptyStage( props.stage ),
			size_mode: 'advanced',
		} );

		unmount();
	} );

	it( 'shows the saved table instead of the fixed size', () => {
		const { container, unmount } = renderCard( {
			size: '30px',
			size_mode: 'advanced',
			sizing_rules: [
				{ font: 16, icon: 12 },
				{ font: 32, icon: 24 },
			],
		} );

		// A fixed size is not in play in this mode, so its field is gone —
		// leaving it on screen invited the author to set a size that is not
		// drawn.
		expect( container.querySelector( '#titlesparks-size-1' ) ).toBeNull();
		expect( ruleField( container, 1, 'font' ).value ).toBe( '16' );
		expect( ruleField( container, 1, 'icon' ).value ).toBe( '12' );
		expect( ruleField( container, 2, 'font' ).value ).toBe( '32' );
		expect( ruleField( container, 2, 'icon' ).value ).toBe( '24' );

		unmount();
	} );

	it( 'keeps the table out of the way until the custom mode is chosen', () => {
		const { container, unmount } = renderCard();

		// Fixed size draws the number in the field beside it, so there is no
		// table here to set up or read.
		expect( ruleField( container, 1, 'font' ) ).toBeNull();
		expect( modeSelect( container ).value ).toBe( 'fixed' );

		unmount();
	} );

	it( 'starts a custom table from the site\u2019s numbers', () => {
		const { container, unmount } = renderCard( { size_mode: 'advanced' } );

		// The stage has no rows yet, so the fields show the ones it would
		// follow; the first edit writes them as the stage's own.
		expect( ruleField( container, 1, 'font' ).value ).toBe( '12' );
		expect( ruleField( container, 6, 'icon' ).value ).toBe( '30' );
		expect( modeSelect( container ).value ).toBe( 'advanced' );

		unmount();
	} );

	it( 'writes one row at a time and leaves the rest alone', () => {
		const { container, props, unmount } = renderCard( {
			size_mode: 'advanced',
			sizing_rules: [
				{ font: 16, icon: 12 },
				{ font: 32, icon: 24 },
			],
		} );

		type( ruleField( container, 2, 'icon' ), '30' );

		const next = props.onChange.mock.calls[ 0 ][ 0 ];

		expect( next.sizing_rules ).toEqual( [
			{ font: 16, icon: 12 },
			{ font: 32, icon: 30 },
		] );
		expect( next.size_mode ).toBe( 'advanced' );

		unmount();
	} );

	it( 'lets a two-digit size be typed one key at a time', () => {
		// The field holds what was typed while the timeline holds the rows that
		// are usable, so `4` on the way to `45` cannot blank the row and steal
		// the caret.
		const { container, props, unmount } = renderCard( {
			size_mode: 'advanced',
			sizing_rules: [ { font: 16, icon: 12 } ],
		} );
		const field = ruleField( container, 1, 'icon' );

		type( field, '4' );

		expect( field.value ).toBe( '4' );

		type( field, '45' );

		expect( field.value ).toBe( '45' );
		expect(
			props.onChange.mock.calls[
				props.onChange.mock.calls.length - 1
			][ 0 ].sizing_rules
		).toEqual( [ { font: 16, icon: 45 } ] );

		unmount();
	} );

	it( 'adds a row and removes it again', () => {
		const { container, props, unmount } = renderCard( {
			size_mode: 'advanced',
			sizing_rules: [ { font: 16, icon: 12 } ],
		} );

		act( () => button( container, 'Add size' ).click() );

		// The empty row is on screen and left out of the timeline until both of
		// its numbers are there.
		expect( ruleField( container, 2, 'font' ).value ).toBe( '' );

		act( () =>
			container
				.querySelector( '[aria-label="Remove stage 1 size 2"]' )
				.click()
		);

		expect( ruleField( container, 2, 'font' ) ).toBeNull();
		expect(
			props.onChange.mock.calls[
				props.onChange.mock.calls.length - 1
			][ 0 ].sizing_rules
		).toEqual( [ { font: 16, icon: 12 } ] );

		unmount();
	} );

	it( 'keeps the table when switching back to a fixed size', () => {
		const { container, props, unmount } = renderCard( {
			size_mode: 'advanced',
			sizing_rules: [ { font: 16, icon: 12 } ],
		} );

		type( modeSelect( container ), 'fixed' );

		expect( props.onChange.mock.calls[ 0 ][ 0 ] ).toEqual( {
			...emptyStage( props.stage ),
			size_mode: 'fixed',
		} );

		unmount();
	} );
} );

describe( 'the help text', () => {
	it( 'keeps the sentences the Guide owns out of the visible lines', () => {
		const { container, unmount } = renderCard();

		// Both are explained on the Guide tab, and each one used to cost a line
		// under its field — which is the bulk of what made the card read long.
		expect( container.textContent ).not.toContain( 'Clear to skip' );
		expect( container.textContent ).not.toContain( 'minus the other way' );

		unmount();
	} );

	it( 'exposes the offset sign rules as a tooltip on the field', () => {
		const { container, unmount } = renderCard();
		const field = container
			.querySelector( '#titlesparks-offset-1-x' )
			.closest( '[title]' );

		// Still reachable — just not on a line of its own any more. The wording
		// follows the position, so the sentence is what is asserted, not a
		// direction whose side is the stage's own business.
		expect( field ).not.toBeNull();
		expect( field.getAttribute( 'title' ) ).toContain(
			'minus the other way'
		);

		unmount();
	} );
} );
