/*
 * Check the settings screen's own chrome in a real wp-admin.
 *
 * Two review findings live in this file, because neither is visible to a unit
 * test: the plugin used to print `<style>` elements inside its settings page,
 * and the admin menu icon is sized by a rule that names a PHP constant. Both
 * now travel through the enqueue API, so this opens the real screen and reads
 * what the browser was given.
 *
 * The app's bundle is blocked for these readings. The dashboard replaces the
 * placeholder the moment React mounts, so with the script in place there is
 * nothing left to measure — and the placeholder is exactly the thing that has
 * to look right on a slow connection, when the bundle has not arrived yet.
 *
 * Authentication: pass a Playwright storage state, or a user and password.
 *
 *   TITLESPARKS_TEST_EDITOR_URL=http://localhost:10010/wp-admin/post.php?post=275&action=edit \
 *   TITLESPARKS_TEST_USER=admin TITLESPARKS_TEST_PASSWORD=secret \
 *   node tests/integration/admin-chrome.cjs
 *
 * `tests/integration/setup-test-site.sh` exports the editor URL and the login,
 * and the settings URL is derived from the editor URL, so a seeded site needs
 * no other variables. Nothing is written: the check only reads the page.
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

/**
 * Every viewport the screen is measured in.
 *
 * A phone width is where wp-admin's own layout changes shape, so the columns
 * and the thumbnail grid have to answer for themselves at both ends rather than
 * at the width the dashboard happens to be built at.
 */
const VIEWPORTS = [
	{
		name: 'desktop',
		width: 1440,
		height: 900,
		expectColumns: 2,
		expectThumbs: 4,
	},
	{
		name: 'phone',
		width: 390,
		height: 844,
		expectColumns: 1,
		expectThumbs: 2,
	},
];

/**
 * Read the settings screen's chrome.
 *
 * Runs inside the page, so it sees the rendered document and the computed style
 * of the elements the enqueue API produced.
 *
 * @return {Object} Skeleton geometry, the menu icon's size and the styles that
 *                  reached the page.
 */
const readChrome = () => {
	const style = ( selector ) => {
		const node = document.querySelector( selector );

		return node ? getComputedStyle( node ) : null;
	};
	const rootFont = Number.parseFloat(
		getComputedStyle( document.documentElement ).fontSize
	);
	const columns = style( '.titlesparks-skeleton__columns' );
	const thumbs = style( '.titlesparks-skeleton__thumbs' );
	const card = style( '.titlesparks-skeleton__card' );
	const pill = style( '.titlesparks-skeleton__pill' );
	const icon = style( '#toplevel_page_titlesparks .wp-menu-image.svg' );
	const inline = document.querySelector(
		'style[id$="titlesparks-admin-menu-inline-css"]'
	);
	const skeletonLink = document.querySelector(
		'link[href*="admin-skeleton.css"]'
	);

	return {
		viewport: `${ window.innerWidth }x${ window.innerHeight }`,
		scrollWidth: document.documentElement.scrollWidth,
		// `max-width: 72rem` in the stylesheet, read against whatever root size
		// wp-admin uses rather than against 16px assumed here.
		skeletonMaxWidth: style( '.titlesparks-skeleton' )?.maxWidth,
		expectedMaxWidth: `${ 72 * rootFont }px`,
		skeletonVisible: Boolean(
			document.querySelector( '.titlesparks-skeleton' )
		),
		cards: document.querySelectorAll( '.titlesparks-skeleton__card' )
			.length,
		columns: columns ? columns.gridTemplateColumns.split( ' ' ).length : 0,
		thumbs: thumbs ? thumbs.gridTemplateColumns.split( ' ' ).length : 0,
		cardBackground: card?.backgroundColor,
		cardRadius: card?.borderRadius,
		pillAnimation: pill?.animationName,
		menuBackgroundSize: icon?.backgroundSize || null,
		menuBox: icon
			? `${ Math.round(
					Number.parseFloat( icon.width )
				) }x${ Math.round( Number.parseFloat( icon.height ) ) }`
			: null,
		menuInlineStyle: inline ? inline.textContent : '',
		// The review's finding: style elements printed inside the page.
		printedStyles: document.querySelectorAll(
			'.titlesparks-admin-wrap style'
		).length,
		skeletonStylesheet: skeletonLink
			? skeletonLink.getAttribute( 'href' )
			: null,
	};
};

/**
 * Open the settings screen with the app's bundle blocked, and measure it.
 *
 * @param {Object} browser       Browser to drive.
 * @param {Object} state         Storage state from the login.
 * @param {Object} viewport      Viewport to measure in.
 * @param {string} url           Settings URL.
 * @param {string} reducedMotion `reduce` to emulate the reader's preference.
 * @return {Promise<Object>} The readings.
 */
const measure = async (
	browser,
	state,
	viewport,
	url,
	reducedMotion = 'no-preference'
) => {
	const context = await browser.newContext( {
		viewport: { width: viewport.width, height: viewport.height },
		storageState: state,
		reducedMotion,
	} );
	const page = await context.newPage();

	// Blocked, not skipped: the placeholder only exists until the bundle
	// mounts, so this is the only way to see what a slow connection shows.
	await context.route( '**/build-admin/index.js*', ( route ) =>
		route.abort()
	);

	try {
		const response = await page.goto( url, {
			waitUntil: 'domcontentloaded',
		} );

		assert.equal( response.status(), 200, 'settings screen should load' );

		await page
			.locator( '.titlesparks-admin-wrap' )
			.waitFor( { state: 'visible', timeout: 30000 } );
		await page.waitForTimeout( 300 );

		return await page.evaluate( readChrome );
	} finally {
		await context.close();
	}
};

let browser;

( async () => {
	assert.ok(
		EDITOR_URL,
		'Set TITLESPARKS_TEST_EDITOR_URL to the post editor URL of the site.'
	);
	assert.ok(
		STORAGE_STATE || ( USER && PASSWORD ),
		'Set TITLESPARKS_TEST_STORAGE_STATE, or TITLESPARKS_TEST_USER and TITLESPARKS_TEST_PASSWORD.'
	);

	const url = ADMIN_URL || adminUrlFor( EDITOR_URL );

	browser = await chromium.launch( {
		executablePath: CHROME || undefined,
		headless: true,
	} );

	const state = await ( async () => {
		if ( STORAGE_STATE ) {
			return STORAGE_STATE;
		}

		const context = await browser.newContext();
		const page = await context.newPage();

		await page.goto( new URL( '/wp-login.php', EDITOR_URL ).toString() );
		await page.fill( '#user_login', USER );
		await page.fill( '#user_pass', PASSWORD );
		await Promise.all( [
			page.waitForNavigation(),
			page.click( '#wp-submit' ),
		] );

		const saved = await context.storageState();

		await context.close();

		return saved;
	} )();

	for ( const viewport of VIEWPORTS ) {
		const seen = await measure( browser, state, viewport, url );

		assert.ok(
			seen.skeletonVisible,
			`${ viewport.name }: the placeholder is not in the page, so there is nothing to measure.`
		);
		assert.notEqual(
			seen.skeletonStylesheet,
			null,
			`${ viewport.name }: the placeholder stylesheet is not enqueued on the settings screen.`
		);
		assert.equal(
			seen.printedStyles,
			0,
			`${ viewport.name }: the page prints ${ seen.printedStyles } style element(s) of its own.`
		);
		assert.equal(
			seen.skeletonMaxWidth,
			seen.expectedMaxWidth,
			`${ viewport.name }: the placeholder's 72rem cap is gone (${ seen.skeletonMaxWidth }).`
		);
		assert.equal(
			seen.cards,
			5,
			`${ viewport.name }: expected 5 placeholder cards, found ${ seen.cards }.`
		);
		assert.equal(
			seen.columns,
			viewport.expectColumns,
			`${ viewport.name }: expected ${ viewport.expectColumns } column(s), got ${ seen.columns }.`
		);
		assert.equal(
			seen.thumbs,
			viewport.expectThumbs,
			`${ viewport.name }: expected ${ viewport.expectThumbs } thumbnails per row, got ${ seen.thumbs }.`
		);
		assert.equal(
			seen.cardBackground,
			'rgb(255, 255, 255)',
			`${ viewport.name }: the placeholder cards lost their surface.`
		);
		assert.equal(
			seen.cardRadius,
			'12px',
			`${ viewport.name }: the card radius no longer matches wp-admin's surfaces.`
		);
		assert.equal(
			seen.pillAnimation,
			'titlesparks-skeleton-pulse',
			`${ viewport.name }: the placeholder is not pulsing.`
		);
		assert.equal(
			seen.menuBackgroundSize,
			'20px auto',
			`${ viewport.name }: the menu icon is no longer drawn at 20px (${ seen.menuBackgroundSize }).`
		);
		assert.ok(
			seen.menuBox,
			`${ viewport.name }: the plugin's menu item has no image element to size.`
		);
		// The rule reaches the page through `wp_add_inline_style()`, which is
		// what WordPress prints into a style element of its own.
		assert.match(
			seen.menuInlineStyle,
			/wp-menu-image/,
			`${ viewport.name }: the menu icon rule is not attached to an enqueued stylesheet.`
		);
		assert.ok(
			seen.scrollWidth <= viewport.width,
			`${ viewport.name }: the screen is ${ seen.scrollWidth }px wide and scrolls sideways.`
		);

		console.log(
			`PASS ${ seen.viewport }: ${ seen.columns } columns, ` +
				`${ seen.thumbs } thumbs per row, ${ seen.cards } cards ` +
				`${ seen.cardBackground }/${ seen.cardRadius }, ` +
				`animation ${ seen.pillAnimation }, menu ${ seen.menuBackgroundSize } ` +
				`in a ${ seen.menuBox } box, ${ seen.printedStyles } printed style elements`
		);
	}

	const reduced = await measure(
		browser,
		state,
		VIEWPORTS[ 0 ],
		url,
		'reduce'
	);

	assert.equal(
		reduced.pillAnimation,
		'none',
		'reduced motion no longer stops the placeholder animation.'
	);

	console.log(
		`PASS prefers-reduced-motion: animation ${ reduced.pillAnimation }`
	);

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
