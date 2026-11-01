/**
 * The icon's own styles, and what they must not do.
 *
 * The icon is dropped into whatever the theme's title element is, so a forced
 * box — `!important` margins, a cleared background, a locked display — would
 * override the site's own design. The plugin therefore sizes the image and, in
 * text flow, carries the gap the title needs. Everything else (colours,
 * borders, padding, background, shadow, visibility, margins) stays the
 * theme's.
 *
 * These tests read the stylesheet and the injected canvas stylesheet, and
 * check the icons the script builds, so a reset or an `!important` cannot come
 * back unnoticed.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { buildIcon, ensureEditorStyles } from '../editorTitleDom';

const CSS = readFileSync(
	join( __dirname, '../../../assets/css/title-icons.css' ),
	'utf8'
);

const FRONTEND = readFileSync(
	join( __dirname, '../../frontend/index.js' ),
	'utf8'
);

/** CSS with its comments removed, so prose about `!important` is not a rule. */
const CODE = CSS.replace( /\/\*[\s\S]*?\*\//g, '' );

/**
 * Declarations of one rule, keyed by property.
 *
 * @param {string} source   CSS text to read.
 * @param {string} selector Rule selector, e.g. `.titlesparks-icon`.
 * @return {Object} Property to value, as written.
 */
const declarations = ( source, selector ) => {
	const escaped = selector.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
	// Anchored to the start of a line, so `.titlesparks-icon` does not match
	// `.titlesparks-icon--left`.
	const match = new RegExp( `(?:^|\\n)${ escaped }\\s*\\{([^}]*)\\}` ).exec(
		source
	);

	expect( match ).not.toBeNull();

	const found = {};

	match[ 1 ].split( ';' ).forEach( ( declaration ) => {
		const parts = declaration.split( ':' );

		if ( parts.length < 2 ) {
			return;
		}

		const value = parts.slice( 1 ).join( ':' ).trim();

		if ( value ) {
			found[ parts[ 0 ].trim() ] = value;
		}
	} );

	return found;
};

describe( 'the icon stylesheet', () => {
	it( 'uses no !important declarations', () => {
		expect( CODE ).not.toMatch( /!\s*important/i );
	} );

	it( 'does not hide the icon', () => {
		expect( CODE ).not.toMatch(
			/(?:^|[;{])\s*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0)\b/i
		);
	} );

	it( 'declares only the flow gap on the icon element', () => {
		expect( declarations( CODE, '.titlesparks-icon' ) ).toEqual( {
			'--titlesparks-gap': '0.15em',
		} );
	} );

	it( 'sizes the image without resetting its presentation', () => {
		expect( declarations( CODE, '.titlesparks-icon__img' ) ).toEqual( {
			width: '100%',
			height: 'auto',
		} );
	} );

	it( 'lays a positioned icon out as its picture, not a line of text', () => {
		// A block image keeps the icon's box equal to the picture and outranks
		// a theme's broad `... img { display: none }` thumbnail rule.
		//
		// The size is repeated at the same specificity, because a theme's
		// previous/next thumbnail rule lands on this image too: the reference
		// theme writes `:is(.nav-previous, .nav-next) img { width: 80px;
		// height: 80px; object-fit: cover }`, which outranked
		// `.titlesparks-icon__img`. Its own `img { max-width: 100% }` capped
		// that width against the icon's 20px box while the height was left
		// free, so the icon drew 20x80 and the size mode looked ignored.
		expect(
			declarations(
				CODE,
				'.titlesparks-icon[class*="titlesparks-icon--"] .titlesparks-icon__img'
			)
		).toEqual( {
			display: 'block',
			width: '100%',
			height: 'auto',
		} );
	} );

	it( 'gives in-flow icons a box without forcing display on positioned ones', () => {
		expect( CODE ).toMatch(
			/\.titlesparks-icon--inline,[\s\S]*?\.titlesparks-icon--flow\s*\{\s*display: inline-block;\s*\}/
		);
		expect( CODE ).not.toMatch(
			/(?:^|[;{])\s*display\s*:\s*(?:none|flex|grid)\b/i
		);
	} );

	it( 'leaves theme presentation alone', () => {
		[
			'line-height',
			'padding',
			'border',
			'box-sizing',
			'max-width',
			'min-width',
			'background',
			'box-shadow',
			'margin',
		].forEach( ( property ) => {
			const shorthand = new RegExp(
				`(?:^|[;{])\s*${ property }\s*:`,
				'g'
			);

			expect( CODE.match( shorthand ) || [] ).toHaveLength( 0 );
		} );

		// The only margins are the flow gap, on in-flow icons.
		expect(
			CODE.match( /margin-(?:left|right|top|bottom)\s*:/g )
		).toHaveLength( 8 );
	} );
} );

describe( 'the icon the script builds', () => {
	it( 'sets only the chosen width and no !important styles', () => {
		const doc = document.implementation.createHTMLDocument( '' );
		const built = buildIcon( doc, {
			url: 'https://example.test/a.gif',
			size: '20px',
		} );

		expect( built.style.width ).toBe( '20px' );
		expect( built.getAttribute( 'style' ) ).not.toMatch( /important/i );
		expect( built.querySelector( 'img' ).className ).toBe(
			'titlesparks-icon__img'
		);
	} );

	it( 'draws the fixed size and names it in the rebuild signature', () => {
		const doc = document.implementation.createHTMLDocument( '' );
		const built = buildIcon( doc, {
			url: 'https://example.test/a.gif',
			size: '40px',
			fixedSize: '40px',
			sizeMode: 'fixed',
		} );

		expect( built.style.width ).toBe( '40px' );
		// The signature names the size actually drawn, so choosing a second
		// fixed size rebuilds the icon instead of keeping the first.
		expect( built.getAttribute( 'data-titlesparks-size-signature' ) ).toBe(
			'fixed|40px'
		);
	} );

	it( 'starts a title-following icon at its size and lets the placement size it', () => {
		const doc = document.implementation.createHTMLDocument( '' );
		const built = buildIcon( doc, {
			url: 'https://example.test/a.gif',
			size: '24px',
			sizeMode: 'advanced',
		} );

		// The bands need a measured title, so the node is built at the asset's
		// size and `positionIcon` writes the band's width on its first pass.
		expect( built.style.width ).toBe( '24px' );
		expect( built.getAttribute( 'data-titlesparks-size-signature' ) ).toBe(
			'advanced|24px'
		);
	} );

	it( 'injects a canvas stylesheet that sizes the image and keeps its box tight', () => {
		const doc = document.implementation.createHTMLDocument( '' );

		ensureEditorStyles( doc );

		const injected = doc.getElementById(
			'titlesparks-editor-title-css'
		).textContent;

		expect( injected ).not.toMatch( /!\s*important/i );
		expect( injected ).not.toMatch(
			/(?:^|[;{])\s*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0)\b/i
		);
		expect(
			declarations( injected, '.titlesparks-title-icon img' )
		).toEqual( {
			width: '100%',
			height: 'auto',
			display: 'block',
		} );
	} );

	it( 'is not styled by the front end orchestrator', () => {
		// The front end decides where the icon goes; the icon's own presentation
		// must not be written a second time there.
		expect( FRONTEND ).not.toMatch( /\bicon\.style\./ );
		expect( FRONTEND ).not.toMatch( /!\s*important/i );
	} );
} );
