/**
 * The build step that fixes the plugin's design against the root font size.
 *
 * Tailwind writes its scale in `rem`, and `rem` means the document root. The
 * settings page has a 16px root, where the design was drawn; the block editor
 * sets `html { font-size: 10px }`, so every utility in the sidebar came out at
 * 62.5% of its intended size while the 280px panel stayed put. Text at 8.75px
 * and corners at 5px in a full-width panel is what read as a stretched layout.
 *
 * `bin/rem-to-px.js` resolves the whole scale at build time. These tests pin
 * the conversion, the values it must leave alone (`em`, which is deliberately
 * relative to the title on the front end), and — when the bundles have been
 * built — that nothing shipped still carries a `rem`.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import postcss from 'postcss';

import remToPx from '../../../bin/rem-to-px';

/**
 * Run one stylesheet through the transform.
 *
 * @param {string} css CSS text.
 * @return {Promise<string>} Compiled CSS text.
 */
const compile = async ( css ) =>
	( await postcss( [ remToPx() ] ).process( css, { from: undefined } ) ).css;

describe( 'the rem-to-pixel step', () => {
	it( 'resolves every rem length at the 16px design base', async () => {
		const output = await compile(
			'.a{width:1rem;font-size:.875rem;border-radius:.5rem;padding:0.0625rem}'
		);

		expect( output ).toContain( 'width:16px' );
		expect( output ).toContain( 'font-size:14px' );
		expect( output ).toContain( 'border-radius:8px' );
		expect( output ).toContain( 'padding:1px' );
	} );

	it( 'handles negative, fractional and multi-value lengths', async () => {
		const output = await compile(
			'.a{margin:-.5rem 1.5rem 0 2.25rem;transform:translate(-1.25rem,2rem)}'
		);

		expect( output ).toContain( 'margin:-8px 24px 0 36px' );
		expect( output ).toContain( 'translate(-20px,32px)' );
	} );

	it( 'resolves rem inside functions and at-rule parameters', async () => {
		const output = await compile(
			'@media (min-width:40rem){.a{width:calc(100% - 2rem)}}'
		);

		expect( output ).toContain( '(min-width:640px)' );
		expect( output ).toContain( 'calc(100% - 32px)' );
	} );

	it( 'leaves em, px, percentages and unitless values alone', async () => {
		const css =
			'.a{--titlesparks-gap:max(4px,0.15em);width:50%;line-height:1.5;border:1px solid}';

		expect( await compile( css ) ).toBe( css );
	} );

	it( 'prints clean pixels, with no float noise and no rem left', async () => {
		const output = await compile(
			'.a{width:.333rem;height:0.1rem;margin:0.0625rem}'
		);

		expect( output ).toContain( 'width:5.328px' );
		expect( output ).toContain( 'height:1.6px' );
		expect( output ).not.toMatch( /\d(?:\.\d+)?rem\b/ );
	} );

	it( 'is wired into the production PostCSS pipeline', () => {
		const config = readFileSync(
			join( __dirname, '../../../postcss.config.js' ),
			'utf8'
		);

		expect( config ).toMatch( /require\( '\.\/bin\/rem-to-px' \)/ );
		expect( config ).toMatch( /remToPx\(\)/ );
	} );
} );

describe( 'the built stylesheets', () => {
	const bundles = [
		'build-admin/index.css',
		'build-admin/index-rtl.css',
		'build-block/index.css',
		'build-block/index-rtl.css',
	]
		.map( ( file ) => join( __dirname, '../../..', file ) )
		.filter( ( file ) => existsSync( file ) );

	it( 'carry no rem when the bundles have been built', () => {
		// `build-*` is generated and git-ignored, so a fresh clone has nothing
		// to check here; a built bundle is the CSS that actually ships.
		bundles.forEach( ( file ) => {
			expect( {
				file,
				rem: readFileSync( file, 'utf8' ).match( /\d(?:\.\d+)?rem\b/g ),
			} ).toEqual( { file, rem: null } );
		} );
	} );
} );
