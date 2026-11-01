/*
 * Check the icon on a post page's previous/next links.
 *
 * A post page prints the posts published next to it, and each of those links
 * names a post whose title the page also carries — so each link is an ordinary
 * occurrence of that post's title and is decorated like any other. It is also
 * the occurrence most easily lost: the links are bare inline links inside a
 * `nav`, with no heading and no title class to identify them, so any rule that
 * prefers a heading (the rule that keeps a body element holding the same words
 * bare) can answer for the whole page at once and leave both links empty while
 * every card below them is decorated. That is the bug this check exists for: it
 * was measured on a post whose two neighbours appeared both in the nav and in a
 * query loop under it, and the cards received the icons.
 *
 * The check is data-driven, so it needs no knowledge of the fixture's ids: it
 * reads each link's own `href`, finds the icon entry the server resolved for
 * that permalink, and requires that link to hold that entry's icon. A link
 * whose post has no icon is reported rather than passed over, because a page
 * whose neighbours carry no icons cannot tell anyone whether the links work —
 * which is why `tests/integration/fixtures/seed-test-site.php` publishes a post
 * on either side, each with a live stage of its own.
 *
 * Run with:
 *   TITLESPARKS_TEST_POST_URL=http://localhost:10010/post-slug/ node tests/integration/adjacent-post-icons.cjs
 *
 * One run takes one URL or a list of them, separated by commas or whitespace,
 * and `TITLESPARKS_TEST_VIEWPORTS` names the windows the same way the front-end
 * icon check does. Each page opens in a fresh context.
 */
const assert = require( 'node:assert/strict' );
const { existsSync } = require( 'node:fs' );
const { chromium } = require( 'playwright' );

const POST_URLS = (
	process.env.TITLESPARKS_TEST_POST_URL ||
	'http://localhost:10010/deserunt-pariatur-assumenda-nihil-est-maiores/'
)
	.split( /[\s,]+/ )
	.filter( Boolean );

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
 * The windows each page is measured in, `WIDTHxHEIGHT`.
 *
 * @type {Array<{width: number, height: number}>}
 */
const VIEWPORTS = ( process.env.TITLESPARKS_TEST_VIEWPORTS || '1440x900' )
	.split( /[\s,]+/ )
	.filter( Boolean )
	.map( ( value ) => {
		const [ width, height ] = value
			.split( /x/i )
			.map( ( part ) => Number.parseInt( part, 10 ) );

		if ( ! Number.isFinite( width ) || width <= 0 ) {
			throw new Error(
				`TITLESPARKS_TEST_VIEWPORTS: \`${ value }\` is not WIDTHxHEIGHT (for example 390x844).`
			);
		}

		return {
			width,
			height: Number.isFinite( height ) && height > 0 ? height : 900,
		};
	} );

/*
 * Every shape a theme or WordPress prints an adjacent post link in: `rel` is
 * what WordPress's own post-navigation block and `the_post_navigation()` write,
 * and the class names are the containers the two of them, and the common
 * themes, print around it. A theme that paints its own adjacent links with
 * neither is a theme this check has to be extended for.
 */
const ADJACENT_SELECTOR = [
	'a[rel="prev"]',
	'a[rel="next"]',
	'a[rel="previous"]',
	'.post-navigation-link-previous > a[href]',
	'.post-navigation-link-next > a[href]',
	'.nav-previous a[href]',
	'.nav-next a[href]',
	'.post-navigation a[href]',
	'.posts-navigation a[href]',
	'.post-nav a[href]',
].join( ', ' );

/*
 * How long the front-end pass is given to draw its icons. The pass runs when
 * the document is ready and again after the theme's own scripts have moved
 * things, so this is a wait for work rather than a delay.
 */
const ICON_TIMEOUT_MS = 20000;

/**
 * Read the adjacent links, the icon in each, and the entries behind them.
 *
 * Serialized into the page, so it closes over nothing: the selector arrives as
 * an argument and everything else is read from the document and the server's
 * own `window.titleSparksFrontendData`.
 *
 * The permalinks are compared with their query string intact. A site without
 * pretty permalinks names its posts `?p=12`, `?p=13`, `?p=14`, and stripping the
 * query — the fold the plugin's own URL comparison applies when it is looking
 * for a link to one post — would make all three the same URL and let the wrong
 * post's icon satisfy the check.
 *
 * @param {string} selector Adjacent-link selector.
 * @return {Array} One record per link.
 */
const collectAdjacentLinks = ( selector ) => {
	const key = ( href ) => {
		try {
			const url = new URL( href, window.location.href );

			return (
				url.origin + url.pathname.replace( /\/+$/, '' ) + url.search
			).toLowerCase();
		} catch ( error ) {
			return '';
		}
	};

	const data = window.titleSparksFrontendData || {};
	const entries = Array.isArray( data.icons ) ? data.icons : [];
	const byPermalink = new Map(
		entries.map( ( entry ) => [ key( entry.permalink ), entry ] )
	);

	return [ ...document.querySelectorAll( selector ) ].map( ( link ) => {
		const entry = byPermalink.get( key( link.getAttribute( 'href' ) ) );
		const icons = [ ...link.querySelectorAll( '[data-titlesparks-icon]' ) ];
		const icon = icons[ 0 ] || null;
		const rect = icon ? icon.getBoundingClientRect() : null;
		const style = icon
			? icon.ownerDocument.defaultView.getComputedStyle( icon )
			: null;
		const image = icon ? icon.querySelector( 'img' ) : null;

		return {
			rel: link.getAttribute( 'rel' ) || '',
			href: link.getAttribute( 'href' ),
			title: ( link.textContent || '' ).replace( /\s+/g, ' ' ).trim(),
			entry: entry
				? {
						id: String( entry.id ),
						permalink: entry.permalink,
						size: entry.size,
				  }
				: null,
			iconCount: icons.length,
			icon: icon
				? {
						id: icon.getAttribute( 'data-titlesparks-icon' ),
						className: icon.className,
						insideLink: icon.parentElement === link,
						width: rect.width,
						height: rect.height,
						visible:
							style.visibility !== 'hidden' &&
							style.display !== 'none' &&
							rect.width > 0 &&
							rect.height > 0,
						imageLoaded: Boolean(
							image &&
								image.complete &&
								image.naturalWidth > 0
						),
				  }
				: null,
		};
	} );
};

/**
 * Measure one page.
 *
 * @param {import('playwright').Browser} browser  Browser to open it in.
 * @param {string}                       url      Post page.
 * @param {{width: number, height: number}} viewport Window to measure in.
 * @return {Promise<Array>} The links it checked.
 */
const checkPage = async ( browser, url, viewport ) => {
	const context = await browser.newContext( { viewport } );
	const page = await context.newPage();

	try {
		const response = await page.goto( url, { waitUntil: 'load' } );

		assert.equal(
			response.status(),
			200,
			`${ url }: the page answered ${ response ? response.status() : 'nothing' }`
		);

		// Wait for the pass rather than for a delay, and for the pictures to
		// arrive: an icon that exists but has not loaded is not drawn, and both
		// waits are allowed to time out so the report below says which link is
		// empty instead of a raw timeout saying nothing mapped.
		await page
			.waitForFunction(
				( selector ) =>
					[ ...document.querySelectorAll( selector ) ].some(
						( link ) =>
							link.querySelector( '[data-titlesparks-icon]' )
					),
				ADJACENT_SELECTOR,
				{ timeout: ICON_TIMEOUT_MS }
			)
			.catch( () => {} );
		await page
			.waitForFunction(
				() =>
					[
						...document.querySelectorAll(
							'[data-titlesparks-icon] img'
						),
					].every( ( image ) => image.complete && image.naturalWidth > 0 ),
				null,
				{ timeout: ICON_TIMEOUT_MS }
			)
			.catch( () => {} );

		const links = await page.evaluate(
			collectAdjacentLinks,
			ADJACENT_SELECTOR
		);

		assert.ok(
			links.length > 0,
			`${ url }: no previous/next link on the page (looked for \`${ ADJACENT_SELECTOR }\`). ` +
				'A post page that prints none cannot be checked, and one that has stopped printing them means this check no longer covers what it is for.'
		);

		const named = links.filter( ( link ) => link.entry );

		assert.ok(
			named.length >= 2,
			`${ url }: only ${ named.length } of ${ links.length } adjacent link(s) name a post the page resolved an icon for. ` +
				'The fixture publishes a post on either side of the one under test, each with a live stage, so this means the neighbours lost their icons or the page no longer prints both links — either way this run would not have tested anything.'
		);

		links.forEach( ( link ) => {
			const label = `"${ link.title }" (${ link.rel || 'adjacent' } link)`;

			if ( ! link.entry ) {
				return;
			}

			assert.ok(
				link.icon,
				`${ url }: the ${ label } carries no icon, though the page resolved one for post ${ link.entry.id } (${ link.entry.permalink }). ` +
					'Every occurrence of a title is decorated, and the adjacent links are occurrences like any other.'
			);
			assert.equal(
				link.iconCount,
				1,
				`${ url }: the ${ label } holds ${ link.iconCount } icons; one occurrence gets one icon`
			);
			assert.equal(
				link.icon.id,
				link.entry.id,
				`${ url }: the ${ label } holds post ${ link.icon.id }'s icon where it links to post ${ link.entry.id }`
			);
			assert.equal(
				link.icon.insideLink,
				true,
				`${ url }: the ${ label } has its icon beside it rather than inside it, so it does not travel with the words`
			);
			assert.equal(
				link.icon.visible,
				true,
				`${ url }: the ${ label } holds an icon that is not drawn (${ link.icon.width }x${ link.icon.height }, ${ link.icon.className })`
			);
			assert.equal(
				link.icon.imageLoaded,
				true,
				`${ url }: the ${ label } holds an icon whose picture never loaded`
			);
			assert.match(
				link.icon.className,
				/--(left|right|top|bottom)/,
				`${ url }: the ${ label } holds an icon that was inserted but never placed (${ link.icon.className })`
			);

			console.log(
				`${ link.rel || 'adjacent' } → post ${ link.entry.id } ${ label }: ` +
					`icon ${ link.icon.width.toFixed( 1 ) }x${ link.icon.height.toFixed(
						1
					) }px at ${ link.icon.className }${
						link.entry.size ? ` (stage size ${ link.entry.size })` : ''
					}`
			);
		} );

		return named;
	} finally {
		await page.close();
		await context.close();
	}
};

( async () => {
	const browser = await chromium.launch( {
		executablePath: CHROME || undefined,
		headless: true,
	} );
	const failures = [];

	try {
		for ( const viewport of VIEWPORTS ) {
			for ( const url of POST_URLS ) {
				const label = `${ url } @ ${ viewport.width }x${ viewport.height }`;

				try {
					const checked = await checkPage( browser, url, viewport );
					console.log(
						`PASS ${ label } — ${ checked.length } adjacent link(s) carry their post's icon`
					);
				} catch ( error ) {
					// A page that fails is reported and the rest still run: one
					// page with a bare adjacent link should not hide another.
					failures.push( { label, error } );
					console.error( `FAIL ${ label }\n${ error.message }\n` );
				}
			}
		}
	} finally {
		await browser.close();
	}

	if ( failures.length ) {
		throw new Error(
			`${ failures.length } of ${
				POST_URLS.length * VIEWPORTS.length
			} page(s) failed:\n${ failures
				.map( ( failure ) => `- ${ failure.label }` )
				.join( '\n' ) }`
		);
	}

	console.log(
		`PASS ${ POST_URLS.length } page(s) at ${ VIEWPORTS.length } window size(s): adjacent links decorated`
	);
} )().catch( ( error ) => {
	console.error( error );
	process.exit( 1 );
} );
