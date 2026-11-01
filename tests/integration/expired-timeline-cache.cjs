/*
 * Check that an expired timeline draws nothing on a cached page.
 *
 * A full-page cache serves the same HTML for hours, so the server cannot be the
 * one deciding which stage a reader sees: it writes every stage's boundaries and
 * icon into the page, and the browser reads them against its own clock. This
 * check proves that half of the bargain from the outside.
 *
 * The fixture post's timeline ended before this check runs, and its third stage
 * asks for the icon to be removed. WordPress still writes that post's entry, all
 * three boundaries and an icon URL into the page — which is exactly the HTML a
 * cache would hold — and the browser has to draw nothing for it.
 *
 * Two readings are taken, and both are needed:
 *
 * - The page data still carries the entry, its three stages and an icon URL.
 *   That is what makes the page indistinguishable from one written while the
 *   timeline was live, and it is what the operator's cache stores.
 * - No icon for that post is in the document, while the neighbouring posts'
 *   icons are, so the bundle ran and chose not to draw this one rather than
 *   never having run at all.
 *
 * The captured bytes are then served back for the same URL in a second tab,
 * which is what a cache hit does, and both readings are taken again. A test
 * that only loaded the page once could pass on a server that had started
 * stripping expired entries; the replay pins the decision to the browser.
 *
 * Set TITLESPARKS_TEST_EXPIRED_POST_URL — the seed script exports it — and run
 * it against a site with the plugin built and active:
 *
 *   node tests/integration/expired-timeline-cache.cjs
 */
const assert = require( 'node:assert/strict' );
const { existsSync } = require( 'node:fs' );
const { chromium } = require( 'playwright' );

/**
 * The page to check: the post whose timeline has already ended.
 */
const POST_URL = process.env.TITLESPARKS_TEST_EXPIRED_POST_URL;

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

/**
 * How long the page is given to settle before its icons are read.
 *
 * The bundle places icons on `requestAnimationFrame` and again once fonts and
 * images have landed, so an immediate reading could pass for the wrong reason:
 * an expired icon is absent in the first frame and stays absent.
 */
const SETTLE_MS = 1200;

/**
 * The post an icon identifier belongs to.
 *
 * The plugin names every copy of a title after its post and adds what the copy
 * is: `<post>`, `<post>-title-1` for a listing card, `<post>-slide-2` in a
 * carousel, and `widget-<post>` or `widget-<post>-<widget id>` in a sidebar.
 * Reading the first segment after the optional `widget-` is the post in every
 * one of those.
 *
 * @param {string} id Rendered icon identifier.
 * @return {string} Post id the icon belongs to.
 */
const iconPostId = ( id ) =>
	'widget-' === String( id ).slice( 0, 7 )
		? String( id ).split( '-' )[ 1 ]
		: String( id ).split( '-' )[ 0 ];

/**
 * Read the icon data and the drawn icons out of one page.
 *
 * @param {Page}   page   Page to read.
 * @param {string} postId Post whose icon must be missing.
 * @return {Promise<Object>} Entry, drawn ids and the page's clock.
 */
const readPage = ( page, postId ) =>
	page.evaluate( ( id ) => {
		const data = window.titleSparksFrontendData || {};
		const entry = ( data.icons || [] ).find(
			( icon ) => String( icon.id ) === String( id )
		);
		const value = entry || {};
		const stages = Array.isArray( value.stages ) ? value.stages : [];

		return {
			now: Math.floor( Date.now() / 1000 ),
			entry: entry
				? {
						id: value.id,
						title: value.title,
						url: value.url || '',
						stage3Behaviour: value.stage3Behaviour,
						stages: stages.map( ( stage ) => ( {
							start: Number( stage.start ),
							end: Number( stage.end ),
							url: stage.url || '',
						} ) ),
				  }
				: null,
			icons: [
				...document.querySelectorAll( '[data-titlesparks-icon]' ),
			].map( ( icon ) => String( icon.getAttribute( 'data-titlesparks-icon' ) ) ),
		};
	}, postId );

/**
 * Assert one reading shows an expired timeline that drew nothing.
 *
 * @param {Object} reading Page data and drawn icons.
 * @param {string} postId  Post whose icon must be missing.
 * @param {string} label   What was read, for the failure message.
 * @return {void}
 */
const assertExpired = ( reading, postId, label ) => {
	assert.ok(
		reading.entry,
		`${ label }: the page does not describe the fixture post, so there is nothing for the browser to decide.`
	);

	const { entry } = reading;

	assert.equal(
		entry.stage3Behaviour,
		'remove',
		`${ label }: the fixture timeline should remove its icon once every stage has elapsed.`
	);
	assert.equal(
		entry.stages.length,
		3,
		`${ label }: the page must carry all three stages, or a cached copy has no boundaries to read.`
	);
	assert.equal(
		entry.stages.filter( ( stage ) => stage.url ).length,
		3,
		`${ label }: every stage of the fixture should carry an icon, so the expired timeline is the only reason nothing is drawn.`
	);

	const endsAt = Math.max(
		...entry.stages.map( ( stage ) => stage.end )
	);

	assert.ok(
		Number.isFinite( endsAt ) && endsAt < reading.now,
		`${ label }: the fixture timeline has not ended yet (ends at ${ endsAt }, now ${ reading.now }), so this check would pass whether the browser read the boundaries or not.`
	);

	assert.ok(
		entry.url,
		`${ label }: the entry lost its icon URL, which means the server stripped an expired icon and the cached-page case is not being tested.`
	);

	const own = reading.icons.filter(
		( id ) => iconPostId( id ) === String( postId )
	);

	assert.deepEqual(
		own,
		[],
		`${ label }: the expired post still carries ${ own.join(
			', '
		) } — a cached page would keep showing it until the cache is purged.`
	);

	// The neighbours are published with live timelines of their own, so an icon
	// on the page proves the bundle ran. Without this, a script that never
	// loaded would pass the assertion above for the wrong reason.
	assert.ok(
		reading.icons.length > 0,
		`${ label }: no icon was drawn anywhere on the page, so the bundle did not run and this check proves nothing.`
	);

	console.log(
		`${ label }: no icon for post ${ postId }, ${ reading.icons.length } icon(s) drawn for other posts, timeline ended at ${ endsAt}`
	);
};

( async () => {
	assert.ok(
		POST_URL,
		'TITLESPARKS_TEST_EXPIRED_POST_URL is required: point it at the seeded post whose timeline has ended.'
	);

	const postId = new URL( POST_URL ).searchParams.get( 'p' );

	assert.ok(
		postId,
		`TITLESPARKS_TEST_EXPIRED_POST_URL should be a ?p=<id> permalink, got ${ POST_URL }.`
	);

	const browser = await chromium.launch( {
		executablePath: CHROME || undefined,
		headless: true,
	} );

	try {
		const page = await browser.newPage( {
			viewport: { width: 1440, height: 900 },
		} );
		let cachedHtml = '';

		// The document is captured as it is served, so the second tab can be
		// handed the exact bytes a cache would hold. Only the document is
		// intercepted: the stylesheet, the bundle and the image still come from
		// the site, so the replay measures the real page.
		await page.route( POST_URL, async ( route ) => {
			const response = await route.fetch();

			cachedHtml = await response.text();

			await route.fulfill( { response, body: cachedHtml } );
		} );

		await page.goto( POST_URL, { waitUntil: 'domcontentloaded' } );
		await page.waitForLoadState( 'load', { timeout: 30000 } );
		await page.waitForTimeout( SETTLE_MS );

		assert.ok(
			cachedHtml.includes( 'titleSparksFrontendData' ),
			'the served page does not carry the icon data, so there is nothing for the browser to read.'
		);
		assert.match(
			cachedHtml,
			/"stages"\s*:/,
			'the served page does not carry any stage boundaries; a cached copy could not pick a stage.'
		);

		assertExpired( await readPage( page, postId ), postId, 'served page' );

		await page.close();

		// The cache hit: the same bytes, served without a request to WordPress.
		const replay = await browser.newPage( {
			viewport: { width: 1440, height: 900 },
		} );

		await replay.route( POST_URL, ( route ) =>
			route.fulfill( {
				status: 200,
				contentType: 'text/html; charset=UTF-8',
				body: cachedHtml,
			} )
		);

		await replay.goto( POST_URL, { waitUntil: 'domcontentloaded' } );
		await replay.waitForLoadState( 'load', { timeout: 30000 } );
		await replay.waitForTimeout( SETTLE_MS );

		assertExpired( await readPage( replay, postId ), postId, 'cached page' );

		await replay.close();
	} finally {
		await browser.close();
	}

	console.log(
		`PASS expired timeline draws nothing on post ${ postId }: served page and cached copy`
	);
} )().catch( ( error ) => {
	console.error( error );
	process.exit( 1 );
} );
