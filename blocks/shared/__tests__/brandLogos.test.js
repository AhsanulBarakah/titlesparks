/**
 * The plugin brand marks stay as editable SVG files under assets/logos.
 */

import { createElement, renderToString } from '@wordpress/element';
import { readFileSync } from 'fs';
import { join } from 'path';

import { IconTitlesparks } from '../icons';

const read = ( ...parts ) =>
	readFileSync( join( __dirname, ...parts ), 'utf8' );

const BRAND_LOGO = read( '../../../assets/logos/brand-mark.svg' );
const DASHBOARD_LOGO = read( '../../../assets/logos/dashboard-navbar.svg' );
const ADMIN_PAGE = read( '../../../includes/admin/class-ts-settings-page.php' );
const DASHBOARD = read( '../../admin/Dashboard.js' );
const SIDEBAR_INDEX = read( '../../sidebar/index.js' );
const SIDEBAR = read( '../../sidebar/sidebar.js' );
const ICONS = read( '../icons.js' );
const ICON_DATA_URI = ICONS.match( /'data:image[^']+'/ )[ 0 ].slice( 1, -1 );

describe( 'TitleSparks brand artwork', () => {
	it( 'renders the sidebar logo directly from its embedded base64 data URI', () => {
		const markup = renderToString(
			createElement( IconTitlesparks, { className: 'brand-mark' } )
		);
		const source = markup.match(
			/src="data:image\/svg\+xml;base64,([^"]+)"/
		);

		expect( source ).not.toBeNull();
		expect( markup ).toContain( '<img' );
		expect( markup ).toContain( 'aria-hidden="true"' );
		expect( markup ).not.toContain( 'mask-image' );

		const svg = Buffer.from( source[ 1 ], 'base64' ).toString( 'utf8' );
		expect( svg ).toContain( '<svg' );
		expect( svg ).toContain( 'viewBox="245.25 95.25 109.5 109.5"' );
		expect( svg ).toContain( 'width="22" height="22"' );
		expect( svg ).toContain( 'shape-rendering="geometricPrecision"' );
		expect( svg ).toContain(
			'<circle r="7" stroke="#000" stroke-width="1.5"/>'
		);
		expect( svg ).toContain( 'r="4.8"' );
		expect( source[ 0 ] ).toContain( 'data:image/svg+xml;base64,' );
		expect( SIDEBAR_INDEX ).toMatch(
			/const SIDEBAR_ICON =[^;]*<IconTitlesparks/
		);
	} );

	it( 'keeps the wp-admin menu icon stable and independent of the sidebar image', () => {
		expect( BRAND_LOGO ).toContain( '<svg' );
		expect( BRAND_LOGO ).toContain( 'currentColor' );
		expect( ADMIN_PAGE ).toContain( '$this->menu_icon()' );
		expect( ADMIN_PAGE ).toContain( ICON_DATA_URI );
		expect( ADMIN_PAGE ).toContain( 'background-size: 20px auto;' );
		expect( ADMIN_PAGE ).not.toContain( 'dashicons-admin-generic' );
	} );

	it( 'uses a separate multicolor logo for the dashboard navbar', () => {
		expect( DASHBOARD_LOGO ).toContain( 'linearGradient' );
		expect( DASHBOARD_LOGO ).toContain( '#22D3EE' );
		expect( ADMIN_PAGE ).toContain( 'assets/logos/dashboard-navbar.svg' );
		expect( DASHBOARD ).toContain( 'boot.dashboardLogoUrl' );
		expect( DASHBOARD ).not.toContain( '<IconTitlesparks' );
	} );
	it( 'shows a concise centered live status and centered duration summary', () => {
		expect( SIDEBAR ).toContain(
			'On live: stage %1$d \\u00b7 %2$s \\u00b7 %3$s'
		);
		expect( SIDEBAR ).not.toContain( 'On the title:' );
		expect( SIDEBAR ).toContain(
			'titlesparks:text-center titlesparks:text-xs'
		);
		expect( SIDEBAR ).toContain( 'titlesparks:justify-center' );
		expect( SIDEBAR ).toContain(
			'titlesparks:relative titlesparks:flex titlesparks:w-full'
		);
		expect( SIDEBAR ).toContain(
			'titlesparks:absolute titlesparks:right-2 titlesparks:text-white'
		);
		expect( SIDEBAR ).not.toContain(
			'titlesparks:ml-auto titlesparks:text-white'
		);
	} );
} );
