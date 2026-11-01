/**
 * The front end must space the icon as the editor does, at every title size.
 *
 * The editor places the icon `ICON_GAP_EM` of the title's font size away from
 * the text. The front end spaces it with the plugin's own stylesheet, for the
 * four inline positions and as the no-script fallback for a corner — so that
 * stylesheet has to describe the same gap, in the same unit.
 *
 * The unit is the part worth pinning down. A gap in pixels looked wrong at every
 * title size but one: themes scale headings with the viewport, so the front end
 * at a wide window, the editor's narrower canvas and a 175% zoom are all
 * different sizes, and a fixed gap is *proportionally* smaller the bigger the
 * title gets. Both sides have to be font-relative, and both have to agree on the
 * fraction, which nothing at run time compares: one lives in CSS and the other
 * in JS.
 *
 * Neither side may hold a pixel floor. It looks like a safety net for a tiny
 * heading, but it is really a second rule: at a 15px widget title it kept the
 * gap at 4px where the fraction asks for 2.25px, so the smallest titles on a
 * page were pushed away from their words while every other title kept the
 * proportion the author tuned.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { ICON_GAP, ICON_GAP_EM, iconGap } from '../editorTitleDom';

const CSS = readFileSync(
	join( __dirname, '../../../assets/css/title-icons.css' ),
	'utf8'
);

describe( 'the gap for one title', () => {
	it( 'is a fraction of the font size', () => {
		expect( iconGap( 40 ) ).toBeCloseTo( 40 * ICON_GAP_EM, 5 );
		expect( iconGap( '40px' ) ).toBeCloseTo( 6, 5 );
	} );

	it( 'grows with the title, so the space stays the same to the eye', () => {
		const small = iconGap( 30 );
		const large = iconGap( 60 );

		expect( large ).toBeGreaterThan( small );
		expect( large / 60 ).toBeCloseTo( small / 30, 5 );
	} );

	it( 'keeps the same fraction on a small title instead of a floor', () => {
		// The sizes a page actually draws copies at: a widget title, a card
		// title, the editor's canvas. All of them keep one gap-to-letters
		// ratio, so a small copy is spaced like the title it was tuned beside.
		[ 15, 17, 24, 32, 48 ].forEach( ( size ) => {
			expect( iconGap( size ) / size ).toBeCloseTo( ICON_GAP_EM, 5 );
		} );

		// Where the old 4px floor used to take over and hold the gap still.
		expect( iconGap( 20 ) ).toBeLessThan( 4 );
		expect( iconGap( 15 ) ).toBeCloseTo( 2.25, 5 );
	} );

	it( 'falls back to the reference gap when there is no size to scale', () => {
		expect( iconGap( 0 ) ).toBe( ICON_GAP );
		expect( iconGap( 'not a size' ) ).toBe( ICON_GAP );
	} );
} );

describe( 'front end icon gap', () => {
	it( 'is declared once, and relative to the font', () => {
		const declarations = CSS.match( /--titlesparks-gap:/g ) || [];

		expect( declarations ).toHaveLength( 1 );
		expect( CSS ).toMatch( /--titlesparks-gap:\s*\d+(?:\.\d+)?em\s*;/ );
	} );

	it( 'carries no pixel floor, so a small title still scales', () => {
		const declaration = /--titlesparks-gap:\s*([^;]+);/.exec( CSS );

		expect( declaration ).not.toBeNull();
		expect( declaration[ 1 ] ).not.toMatch( /\d+px/ );
	} );

	it( 'matches the gap the editor places the icon with', () => {
		const declared = /--titlesparks-gap:\s*(\d+(?:\.\d+)?)em\s*;/.exec(
			CSS
		);

		expect( declared ).not.toBeNull();
		// Mirrors the JS fraction; changing one without the other would put the
		// front end's no-script layout out of step with the placed one.
		expect( Number( declared[ 1 ] ) ).toBe( ICON_GAP_EM );
	} );

	it( 'uses that value for every position', () => {
		const positions = [
			'left',
			'right',
			'top',
			'bottom',
			'left-top',
			'left-bottom',
			'right-top',
			'right-bottom',
		];

		positions.forEach( ( position ) => {
			const rule = new RegExp(
				`\\.titlesparks-icon--inline\\.titlesparks-icon--${ position }[^{]*\\{[^}]*margin[^;]*:\\s*var\\(\\s*--titlesparks-gap\\s*\\)`,
				's'
			);

			expect( CSS ).toMatch( rule );
		} );
	} );

	it( 'leaves no pixel margin behind, which is what drifted before', () => {
		const code = CSS.replace( /\/\*[\s\S]*?\*\//g, '' );

		expect( code ).not.toMatch( /margin[^;:]*:\s*[^;]*\d+px\b/ );
	} );
} );
