/**
 * Bringing WordPress' media modal into a page that did not enqueue it.
 *
 * The captured markup is real wp-admin output, so the parts worth pinning down
 * are the decisions: a handle the page already has must be left alone (jQuery
 * and Underscore are on every admin screen, and a second copy replaces globals
 * other scripts are holding), the modal's templates must join the document
 * without running, and inline data has to run in the order WordPress printed it
 * — before the file that reads it.
 */

import { injectMarkup, planMarkup } from '../mediaModal';

const actions = ( html ) => planMarkup( html ).map( ( entry ) => entry.action );

beforeEach( () => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
	delete window.__ran;
} );

describe( 'planMarkup', () => {
	it( 'leaves a handle the page already loaded alone', () => {
		document.body.innerHTML =
			'<script id="jquery-core-js"></script><script id="underscore-js"></script>';

		expect(
			actions(
				'<script id="jquery-core-js" src="/wp-includes/js/jquery/jquery.js"></script>' +
					'<script id="underscore-js" src="/wp-includes/js/underscore.min.js"></script>' +
					'<script id="media-views-js" src="/wp-includes/js/media-views.js"></script>'
			)
		).toEqual( [ 'skip', 'skip', 'src' ] );
	} );

	it( 'leaves a stylesheet the page already loaded alone', () => {
		document.head.innerHTML =
			'<link id="media-views-css" rel="stylesheet" />';

		expect(
			actions(
				'<link id="media-views-css" rel="stylesheet" href="/media-views.css" />' +
					'<link id="imgareaselect-css" rel="stylesheet" href="/imgareaselect.css" />'
			)
		).toEqual( [ 'skip', 'style' ] );
	} );

	it( 'tells the modal templates apart from executable scripts', () => {
		expect(
			actions(
				'<script type="text/html" id="tmpl-media-frame"></script>' +
					'<script id="_wpMediaViewsL10n-js-extra">var x = 1;</script>' +
					'<script id="media-editor-js" src="/wp-admin/js/media-editor.js"></script>'
			)
		).toEqual( [ 'inert', 'inline', 'src' ] );
	} );
} );

describe( 'injectMarkup', () => {
	const nextTask = () =>
		new Promise( ( resolve ) => window.setTimeout( resolve, 0 ) );

	it( 'runs inline markup in the order it was printed', async () => {
		await injectMarkup(
			'<script id="first-js">window.__ran = [ "first" ];</script>' +
				'<script id="second-js">window.__ran.push( "second" );</script>'
		);

		expect( window.__ran ).toEqual( [ 'first', 'second' ] );
		expect( document.getElementById( 'first-js' ) ).not.toBeNull();
	} );

	it( 'adds the templates to the document without running them', async () => {
		await injectMarkup(
			'<script type="text/html" id="tmpl-media-frame">' +
				'<div id="media-frame-title"></div>' +
				'</script>'
		);

		const template = document.getElementById( 'tmpl-media-frame' );

		expect( template ).not.toBeNull();
		expect( template.textContent ).toContain( 'media-frame-title' );
		expect( document.getElementById( 'media-frame-title' ) ).toBeNull();
	} );

	it( 'does not run markup whose id is already in the page', async () => {
		document.body.innerHTML = '<script id="dupe-js"></script>';

		await injectMarkup(
			'<script id="dupe-js">window.__ran = "again";</script>'
		);

		expect( window.__ran ).toBeUndefined();
	} );

	it( 'attaches stylesheets to the head', async () => {
		const injecting = injectMarkup(
			'<link id="media-views-css" rel="stylesheet" href="/media-views.css" />'
		);

		await nextTask();

		const stylesheet = document.getElementById( 'media-views-css' );

		expect( stylesheet ).not.toBeNull();
		expect( document.head.contains( stylesheet ) ).toBe( true );
		stylesheet.dispatchEvent( new window.Event( 'load' ) );

		await injecting;
	} );

	it( 'waits for modal stylesheets to load before finishing injection', async () => {
		let finished = false;
		const injecting = injectMarkup(
			'<link id="media-views-css" rel="stylesheet" href="/media-views.css" />'
		).then( () => {
			finished = true;
		} );

		await nextTask();

		const stylesheet = document.getElementById( 'media-views-css' );

		expect( stylesheet ).not.toBeNull();
		expect( finished ).toBe( false );

		stylesheet.dispatchEvent( new window.Event( 'load' ) );
		await injecting;

		expect( finished ).toBe( true );
	} );

	it( 'rejects stylesheet failures so the media loader can report an error', async () => {
		const injecting = injectMarkup(
			'<link id="missing-media-css" rel="stylesheet" href="/missing.css" />'
		);

		await nextTask();

		const stylesheet = document.getElementById( 'missing-media-css' );

		expect( stylesheet ).not.toBeNull();
		stylesheet.dispatchEvent( new window.Event( 'error' ) );

		await expect( injecting ).rejects.toThrow( 'Could not load' );
	} );
} );
