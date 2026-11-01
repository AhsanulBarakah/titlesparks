/**
 * The scope the plugin's stylesheet is confined to.
 *
 * This plugin shares wp-admin with every other plugin on the page, so its
 * Tailwind build is scoped three ways: prefixed classes, no preflight, and an
 * `important` selector. The last one is the one that is easy to lose, because
 * without it the stylesheet is scoped but toothless. wp-admin describes form
 * controls by element — `input[type="text"]`, `select:focus` — and those rules
 * are (0,1,1) against a utility's (0,1,0): a control came out with WordPress'
 * 2px radius, its own grey and no vertical padding while its class list said
 * `titlesparks:rounded-lg titlesparks:border-gray-300 titlesparks:py-2`. It looked like a plugin that had
 * not been styled at all, which is exactly what a reader would have concluded.
 *
 * `important: '.titlesparks-app'` writes every utility as `.titlesparks-app .titlesparks-…`, which carries
 * it over those rules. That only holds if the app really renders inside that
 * element, and the class is named in files that never see each other: the config
 * that generates the CSS, the page that mounts the admin app, the sidebar that
 * mounts the editor's panel. Nothing at run time compares them, so this test
 * does — and it also pins the border reset, which has to stay in the layer
 * behind the utilities and be a plain class selector. A `:where()` scope reads
 * as tidier and is what must not be used: it would drop to (0,0,0) and hand
 * `button { border: 2px outset }` back the width.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import config from '../../../tailwind.config';

const read = ( ...parts ) =>
	readFileSync( join( __dirname, ...parts ), 'utf8' );

const CSS = read( '../tailwind.css' );
const ADMIN_PAGE = read( '../../../includes/admin/class-ts-settings-page.php' );
const SIDEBAR = read( '../../sidebar/index.js' );
const FRONTEND = read( '../../frontend/index.js' );

/** The class the config scopes every utility to, without its dot. */
const SCOPE = String( config.important ).replace( /^\./, '' );

/**
 * The border reset, as written.
 *
 * Never throws and never asserts: a `describe` body runs while the file is
 * still being collected, so a helper that threw here would report an empty
 * suite instead of the assertion that actually failed. A missing rule comes
 * back empty, and the tests below fail on it in the ordinary way.
 *
 * @return {Object} `selectors` as a list, `declarations` by property, and
 *                  `text` as the rule is written.
 */
const borderReset = () => {
	const match = new RegExp(
		`(?:^|\\n)\\s*(\\.${ SCOPE } \\*[^{]*)\\{([^}]*)\\}`
	).exec( CSS );

	if ( ! match ) {
		return { selectors: [], declarations: {}, text: '' };
	}

	const declarations = {};

	// Comments carry prose, including colons; only declarations are compared.
	match[ 2 ]
		.replace( /\/\*[\s\S]*?\*\//g, '' )
		.split( ';' )
		.forEach( ( declaration ) => {
			const parts = declaration.split( ':' );

			if ( parts.length > 1 ) {
				declarations[ parts[ 0 ].trim() ] = parts
					.slice( 1 )
					.join( ':' )
					.trim();
			}
		} );

	return {
		selectors: match[ 1 ]
			.split( ',' )
			.map( ( selector ) => selector.trim() )
			.filter( Boolean ),
		declarations,
		text: match[ 0 ],
	};
};

describe( 'the scope the config declares', () => {
	it( 'is a class of its own, not `!important` on every declaration', () => {
		// `important: true` would win too, and would also make each utility
		// unbeatable from the outside — including by the site, which is free to
		// restyle the front end's icon and cannot restyle a control it can see.
		expect( typeof config.important ).toBe( 'string' );
		expect( config.important ).toMatch( /^\.[A-Za-z][\w-]*$/ );
	} );

	it( 'leaves preflight out, which is why the reset below is hand-written', () => {
		// v4 has no `corePlugins` switch: preflight is simply the `base` layer,
		// and the entry imports only `theme` and `utilities`.
		expect( config.corePlugins ).toBeUndefined();
		expect(
			readFileSync( join( __dirname, '../tailwind.css' ), 'utf8' )
		).not.toMatch( /tailwindcss\/preflight/ );
	} );
} );

describe( 'the surfaces that render the UI', () => {
	it( 'mounts the admin app inside the scope', () => {
		expect( ADMIN_PAGE ).toMatch(
			new RegExp(
				`id="titlesparks-admin-root"[^>]*class="[^"]*\\b${ SCOPE }\\b`
			)
		);
	} );

	it( 'wraps the editor sidebar in the scope', () => {
		expect( SIDEBAR ).toMatch(
			new RegExp(
				`className="${ SCOPE }"[\\s\\S]{0,240}?<NewsTitleSidebar`
			)
		);
	} );

	it( 'leaves the front end out of it, because it is not our page', () => {
		// The published page belongs to the theme: its icon is placed by the
		// shared code and styled inline, and a stylesheet scoped to an element
		// no theme renders would only be a file to download.
		expect( FRONTEND ).not.toMatch( /tailwind\.css/ );
	} );
} );

describe( 'the border reset', () => {
	it( 'is declared at all', () => {
		expect( borderReset().selectors.length ).toBeGreaterThan( 0 );
	} );

	it( 'covers the element and the two pseudo-elements', () => {
		expect( borderReset().selectors ).toEqual( [
			`.${ SCOPE } *`,
			`.${ SCOPE } *::before`,
			`.${ SCOPE } *::after`,
		] );
	} );

	it( 'is what makes a `titlesparks:border` hairline draw at all', () => {
		// `titlesparks:border` is a width. On anything but a form control the browser's
		// initial `border-style: none` applies and nothing is painted, which is
		// how the cards, the checkbox and the dashed drop zone all came out
		// borderless while their class lists said otherwise.
		expect( borderReset().declarations ).toEqual( {
			'border-width': '0',
			'border-style': 'solid',
		} );
	} );

	it( 'is a plain class selector, because `:where()` would lose', () => {
		// (0,1,0) outranks wp-admin's element rules and still stays behind the
		// page's own skeleton classes, which are written after this sheet.
		expect( borderReset().text ).not.toMatch( /:where\(/ );
	} );

	it( 'is unlayered, and leaves the utilities able to win', () => {
		// Both halves matter. Inside a cascade layer the reset loses to wp-admin's
		// own unlayered `button { border: 2px outset }`, whatever its specificity;
		// `!important` would flip that and also beat `titlesparks:border` at (0,2,0),
		// so the width is decided by the utility and nothing else.
		expect( borderReset().text ).not.toMatch( /@layer/ );
		expect( borderReset().text ).not.toMatch( /!important/ );
	} );
} );
