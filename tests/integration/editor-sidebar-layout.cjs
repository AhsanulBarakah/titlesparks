/*
 * Exercise the plugin's real admin UI in a browser.
 *
 * This is the check that a stylesheet build cannot make on its own: it opens
 * the block editor's TitleSparks sidebar and the settings dashboard, then
 * asserts the panel still fits its 280px home and the Tailwind scale still
 * resolves to the intended pixels there. The block editor sets
 * `html { font-size: 10px }`, so a `rem` that slipped back into the built CSS
 * would shrink the panel's text instead of failing a unit test.
 *
 * Authentication: pass a Playwright storage state, or a user and password.
 *
 *   TITLESPARKS_TEST_EDITOR_URL=http://localhost:10010/wp-admin/post.php?post=275&action=edit \
 *   TITLESPARKS_TEST_ADMIN_URL=http://localhost:10010/wp-admin/admin.php?page=titlesparks \
 *   TITLESPARKS_TEST_USER=admin TITLESPARKS_TEST_PASSWORD=secret \
 *   node tests/integration/editor-sidebar-layout.cjs
 *
 * or save a session once and reuse it:
 *
 *   TITLESPARKS_TEST_STORAGE_STATE=./playwright-state.json ...
 *
 * Nothing is saved: the test reads the editor and closes it, so the post's
 * timeline and the plugin's settings are untouched.
 */
const assert = require( 'node:assert/strict' );
const { existsSync } = require( 'node:fs' );
const { chromium } = require( 'playwright' );

/*
 * The browser the check drives: an explicit path when one is given, otherwise
 * the desktop Chrome this was written beside, and Playwright's own download
 * everywhere else — a Linux runner has no Google Chrome at that path.
 */
const CHROME =
	process.env.CHROME_EXECUTABLE ||
	( existsSync( 'C:/Program Files/Google/Chrome/Application/chrome.exe' )
		? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
		: null );
const EDITOR_URL = process.env.TITLESPARKS_TEST_EDITOR_URL;
const ADMIN_URL = process.env.TITLESPARKS_TEST_ADMIN_URL;
const STORAGE_STATE = process.env.TITLESPARKS_TEST_STORAGE_STATE;
const USER = process.env.TITLESPARKS_TEST_USER;
const PASSWORD = process.env.TITLESPARKS_TEST_PASSWORD;
const VIEWPORT = { width: 1280, height: 1000 };

/**
 * The settings URL when only the editor URL was given.
 *
 * @param {string} editorUrl Post editor URL.
 * @return {string} Plugin settings URL on the same site.
 */
const adminUrlFor = ( editorUrl ) => {
	const url = new URL( editorUrl );
	url.pathname = '/wp-admin/admin.php';
	url.search = '?page=titlesparks';

	return url.toString();
};

let browser;

( async () => {
	assert.ok(
		EDITOR_URL,
		'Set TITLESPARKS_TEST_EDITOR_URL to the post editor URL to check.'
	);
	assert.ok(
		STORAGE_STATE || ( USER && PASSWORD ),
		'Set TITLESPARKS_TEST_STORAGE_STATE, or TITLESPARKS_TEST_USER and TITLESPARKS_TEST_PASSWORD.'
	);

	browser = await chromium.launch( {
		executablePath: CHROME || undefined,
		headless: true,
	} );
	const context = await browser.newContext(
		STORAGE_STATE
			? { viewport: VIEWPORT, storageState: STORAGE_STATE }
			: { viewport: VIEWPORT }
	);
	const page = await context.newPage();

	// A script that throws on the dashboard's own page leaves the skeleton in
	// place, and the assertions below then fail on a missing control rather than
	// on the error that caused it. Collect the errors so a failure names them.
	const pageErrors = [];

	page.on( 'pageerror', ( error ) => pageErrors.push( String( error ) ) );

	if ( ! STORAGE_STATE ) {
		await page.goto( new URL( '/wp-login.php', EDITOR_URL ).toString() );
		await page.fill( '#user_login', USER );
		await page.fill( '#user_pass', PASSWORD );
		await Promise.all( [
			page.waitForNavigation(),
			page.click( '#wp-submit' ),
		] );
	}

	await page.goto( EDITOR_URL, { waitUntil: 'domcontentloaded' } );

	// The editor boots asynchronously; wait for its own data layer before
	// looking for the plugin's button.
	await page.waitForFunction(
		() => window.wp && window.wp.data && window.wp.plugins,
		null,
		{ timeout: 60000 }
	);

	// A fresh administrator meets the editor's welcome guide, and its overlay
	// both intercepts the click and hides the header from the accessibility
	// tree — where the button is found by name.
	if ( await page.locator( '.components-modal__screen-overlay' ).count() ) {
		await page
			.getByRole( 'button', { name: /^(close|get started)$/i } )
			.first()
			.click( { timeout: 10000 } )
			.catch( () => {} );
		await page.waitForTimeout( 800 );
	}

	const opener = page
		.getByRole( 'button', { name: /title\s*spark/i } )
		.first();

	if ( ( await page.locator( '.titlesparks-app' ).count() ) === 0 ) {
		await opener.click( { timeout: 30000 } );
	}

	await page.locator( '.titlesparks-app' ).waitFor( { state: 'visible' } );

	// One expanded stage is the widest the panel gets.
	const stage = page.getByRole( 'button', { name: /initial icon/i } ).first();

	if ( await stage.count() ) {
		await stage.click();
		await page.waitForTimeout( 800 );
	}

	const editor = await page.evaluate( () => {
		const root = document.querySelector( '.titlesparks-app' );
		const area = document.querySelector( '.interface-complementary-area' );
		const bounds = root.getBoundingClientRect();
		const x = root.querySelector( '#titlesparks-offset-1-x' );
		const y = root.querySelector( '#titlesparks-offset-1-y' );
		const labelX = root.querySelector(
			'label[for="titlesparks-offset-1-x"]'
		);
		const labelY = root.querySelector(
			'label[for="titlesparks-offset-1-y"]'
		);
		const center = ( node ) => {
			const rect = node.getBoundingClientRect();

			return ( rect.left + rect.right ) / 2;
		};

		return {
			viewport: window.innerWidth,
			documentScrollWidth: document.documentElement.scrollWidth,
			areaWidth: area
				? Math.round( area.getBoundingClientRect().width )
				: null,
			rootWidth: Math.round( bounds.width ),
			areaScrollWidth: area ? area.scrollWidth : null,
			areaClientWidth: area ? area.clientWidth : null,
			headingFontSize: getComputedStyle( root.querySelector( 'h2' ) )
				.fontSize,
			labelFontSize: getComputedStyle( root.querySelector( 'label' ) )
				.fontSize,
			select: ( () => {
				const node = root.querySelector( 'select' );

				if ( ! node ) {
					return null;
				}

				const style = getComputedStyle( node );

				return {
					fontSize: style.fontSize,
					height: Math.round( node.getBoundingClientRect().height ),
					borderRadius: style.borderRadius,
				};
			} )(),
			overflowing: Array.from( root.querySelectorAll( '*' ) )
				.filter( ( node ) => {
					const rect = node.getBoundingClientRect();

					return (
						rect.width > 0 &&
						( rect.right > bounds.right + 1 ||
							rect.left < bounds.left - 1 )
					);
				} )
				.map( ( node ) => String( node.className ) ),
			previewCard: !! root.querySelector(
				'[aria-label="Title and icon preview"]'
			),
			hasEnlargeButton: !! [ ...root.querySelectorAll( 'button' ) ].find(
				( button ) => /enlarge preview/i.test( button.textContent )
			),
			offset:
				x && y && labelX && labelY
					? {
							xLabel: center( labelX ),
							xInput: center( x ),
							yLabel: center( labelY ),
							yInput: center( y ),
							header: x
								.closest( '.titlesparks\\:grid' )
								?.previousElementSibling?.textContent,
						}
					: null,
		};
	} );

	// The panel is the width WordPress gives plugin sidebars, and its content
	// stays inside it.
	assert.ok( editor.areaWidth >= 200, 'sidebar should be a real panel' );
	assert.equal( editor.rootWidth, editor.areaWidth, 'root fills the panel' );
	assert.equal(
		editor.areaScrollWidth,
		editor.areaClientWidth,
		'panel must not scroll sideways'
	);
	assert.equal(
		editor.documentScrollWidth,
		editor.viewport,
		'page must not scroll sideways'
	);
	assert.deepEqual(
		editor.overflowing,
		[],
		'no element should cross the panel edge'
	);

	// The scale is pixels, not rem: the editor's 10px root must not shrink it.
	assert.equal( editor.headingFontSize, '14px', 'panel heading is 14px' );
	assert.equal( editor.labelFontSize, '12px', 'field labels are 12px' );
	assert.deepEqual(
		editor.select,
		{ fontSize: '14px', height: 40, borderRadius: '8px' },
		'controls are 14px / 40px / 8px'
	);

	// What the settings screen no longer offers.
	assert.equal( editor.previewCard, false, 'preview card is gone' );
	assert.equal( editor.hasEnlargeButton, false, 'enlarge preview is gone' );

	// Each offset letter sits over the field it names, and the header owns
	// only the group name and Reset.
	assert.ok( editor.offset, 'offset controls should be present' );
	assert.ok(
		Math.abs( editor.offset.xLabel - editor.offset.xInput ) < 2,
		'x label should sit over the x input'
	);
	assert.ok(
		Math.abs( editor.offset.yLabel - editor.offset.yInput ) < 2,
		'y label should sit over the y input'
	);
	assert.match( editor.offset.header, /Offset/ );
	assert.match( editor.offset.header, /Reset/ );

	const admin = await page.goto( ADMIN_URL || adminUrlFor( EDITOR_URL ), {
		waitUntil: 'domcontentloaded',
	} );
	assert.equal( admin.status(), 200, 'settings dashboard should load' );

	// `.titlesparks-app` is in the PHP markup and holds the skeleton until React
	// mounts, so waiting for that class alone returns before the dashboard is on
	// the page — and the controls measured below are inside the app, not the
	// skeleton. The skeleton leaving is what says the first render happened.
	try {
		await page
			.locator( '.titlesparks-skeleton' )
			.waitFor( { state: 'detached', timeout: 20000 } );
	} catch ( error ) {
		const dump = await page.evaluate( () => ( {
			node: !! document.getElementById( 'titlesparks-admin-root' ),
			bundles: [ ...document.querySelectorAll( 'script[src]' ) ]
				.map( ( script ) => script.src.split( '/' ).pop() )
				.filter( ( name ) => /index|admin/.test( name ) ),
		} ) );

		throw new Error(
			`the dashboard did not mount: ${ JSON.stringify( dump ) }; page errors: ` +
				( pageErrors.join( ' | ' ) || 'none' )
		);
	}

	const dashboard = await page.evaluate( () => {
		const root = document.querySelector( '.titlesparks-app' );
		const style = ( node ) => {
			if ( ! node ) {
				return null;
			}

			const computedStyle = getComputedStyle( node );

			return {
				fontSize: computedStyle.fontSize,
				height: Math.round( node.getBoundingClientRect().height ),
				borderRadius: computedStyle.borderRadius,
			};
		};

		return {
			rootWidth: Math.round( root.getBoundingClientRect().width ),
			viewport: window.innerWidth,
			label: style( root.querySelector( 'label' ) ),
			select: style( root.querySelector( 'select' ) ),
			button: style( root.querySelector( 'button' ) ),
		};
	} );

	// The dashboard always had a 16px root; the pixel build must leave it
	// exactly as it was.
	assert.ok(
		dashboard.rootWidth <= dashboard.viewport,
		'dashboard must fit the viewport'
	);
	assert.equal(
		dashboard.label?.fontSize,
		'14px',
		'dashboard labels are 14px'
	);
	assert.deepEqual(
		dashboard.select,
		{ fontSize: '14px', height: 40, borderRadius: '8px' },
		'dashboard selects are 14px / 40px / 8px'
	);
	assert.deepEqual(
		dashboard.button,
		{ fontSize: '14px', height: 36, borderRadius: '8px' },
		'dashboard buttons are 14px / 36px / 8px'
	);

	console.log( 'PASS editor sidebar:', {
		width: editor.areaWidth,
		heading: editor.headingFontSize,
		label: editor.labelFontSize,
	} );
	console.log( 'PASS offset columns:', {
		x: [ editor.offset.xLabel, editor.offset.xInput ],
		y: [ editor.offset.yLabel, editor.offset.yInput ],
	} );
	console.log( 'PASS dashboard:', {
		width: dashboard.rootWidth,
		label: dashboard.label.fontSize,
	} );

	await browser.close();
} )().catch( async ( error ) => {
	console.error( error );

	// A failed assertion still has to end the run. A browser left open holds the
	// event loop, and the check would sit there instead of reporting the failure.
	if ( browser ) {
		await browser.close().catch( () => {} );
	}

	process.exit( 1 );
} );
