/**
 * The icon's stacking order.
 *
 * An icon is positioned already, so it normally paints above the title's words.
 * A theme can still stack its own layers over the heading — a ribbon, a badge,
 * a hover overlay — and the site's answer says where the icon belongs among
 * them. `0` is the page's normal order, which is what an untouched site has
 * always had, so adding the setting cannot move an icon that was already
 * visible.
 *
 * The setting is a CSS `z-index`: a whole number, signed, and bounded by what
 * the property accepts. The placement writes it on every pass, so changing it
 * moves an icon that is already on the title without rebuilding it.
 */

import {
	ICON_Z_INDEX_DEFAULT,
	ICON_Z_INDEX_MAX,
	ICON_Z_INDEX_MIN,
	iconZIndex,
} from '../constants';
import { placeIcon } from '../editorTitleDom';

describe( 'the stacking-order setting', () => {
	it( 'defaults to the page’s normal order', () => {
		expect( ICON_Z_INDEX_DEFAULT ).toBe( 0 );
		expect( iconZIndex( undefined ) ).toBe( 0 );
	} );

	it( 'reads a whole number, including a negative one', () => {
		expect( iconZIndex( '12' ) ).toBe( 12 );
		expect( iconZIndex( -3 ) ).toBe( -3 );
		expect( iconZIndex( 7.9 ) ).toBe( 7 );
	} );

	it( 'falls back for a value that is not a number', () => {
		[ null, '', 'auto', 'z-index', NaN, {} ].forEach( ( value ) => {
			expect( iconZIndex( value ) ).toBe( ICON_Z_INDEX_DEFAULT );
		} );
	} );

	it( 'clamps to the range CSS accepts', () => {
		expect( iconZIndex( ICON_Z_INDEX_MAX + 10 ) ).toBe( ICON_Z_INDEX_MAX );
		expect( iconZIndex( ICON_Z_INDEX_MIN - 10 ) ).toBe( ICON_Z_INDEX_MIN );
	} );
} );

describe( 'placing an icon with a stacking order', () => {
	const BOX = { left: 50, top: 200, width: 800, height: 40 };
	const originalRange = document.createRange;

	/**
	 * An inline title with an icon in it, in the shape `placeIcon` measures.
	 *
	 * @return {{title: Element, icon: Element}} The scene.
	 */
	const scene = () => {
		document.body.innerHTML =
			'<h1 id="t" style="display:inline">Breaking News Story</h1>';

		const title = document.getElementById( 't' );
		const rect = {
			...BOX,
			right: BOX.left + BOX.width,
			bottom: BOX.top + BOX.height,
		};

		title.getBoundingClientRect = () => rect;

		// jsdom cannot measure text, so the title's one line is supplied.
		document.createRange = () => ( {
			selectNodeContents: () => {},
			setStartAfter: () => {},
			setEndBefore: () => {},
			getBoundingClientRect: () => rect,
			getClientRects: () => [ rect ],
		} );

		const icon = document.createElement( 'span' );

		title.insertBefore( icon, title.firstChild );
		Object.defineProperty( icon, 'offsetWidth', {
			value: 24,
			configurable: true,
		} );

		jest.spyOn( window, 'getComputedStyle' ).mockReturnValue( {
			fontSize: '32px',
		} );

		return { title, icon };
	};

	afterEach( () => {
		jest.restoreAllMocks();
		document.createRange = originalRange;
		document.body.innerHTML = '';
	} );

	it( 'writes the site’s number into the icon’s own style', () => {
		const { title, icon } = scene();

		placeIcon( document, icon, title, title, 'left', { zIndex: 30 } );

		expect( icon.style.zIndex ).toBe( '30' );
	} );

	it( 'keeps a negative number, which puts the icon behind the page', () => {
		const { title, icon } = scene();

		placeIcon( document, icon, title, title, 'right', { zIndex: -1 } );

		expect( icon.style.zIndex ).toBe( '-1' );
	} );

	it( 'replaces the previous number instead of adding to it', () => {
		const { title, icon } = scene();

		placeIcon( document, icon, title, title, 'left', { zIndex: 5 } );
		placeIcon( document, icon, title, title, 'left', { zIndex: 9 } );

		expect( icon.style.zIndex ).toBe( '9' );
	} );

	it( 'leaves the normal order to the theme when the site asks for 0', () => {
		const { title, icon } = scene();

		// An icon that carried a number from an earlier pass has to lose it,
		// or turning the setting back to 0 would leave the old layer behind.
		icon.style.zIndex = '5';

		placeIcon( document, icon, title, title, 'left', { zIndex: 0 } );

		expect( icon.style.zIndex ).toBe( '' );
	} );

	it( 'leaves the icon alone when the site has no number to give', () => {
		const { title, icon } = scene();

		placeIcon( document, icon, title, title, 'left' );

		expect( icon.style.zIndex ).toBe( '' );
	} );
} );
