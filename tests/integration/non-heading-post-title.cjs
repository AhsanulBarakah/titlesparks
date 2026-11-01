/*
 * Exercise frontend title insertion against the real WordPress post/theme.
 *
 * The request is fulfilled from its live WordPress response, with only the
 * title element changed in memory by Playwright. Nothing is written to the
 * theme, plugin, WordPress database, or browser profile.
 *
 * Run with:
 *   TITLESparks_TEST_POST_URL=http://localhost:10010/post-slug/ node tests/integration/non-heading-post-title.cjs
 */
const assert = require( 'node:assert/strict' );
const { existsSync } = require( 'node:fs' );
const { chromium } = require( 'playwright' );
const POST_URL =
	process.env.TITLESPARKS_TEST_POST_URL ||
	'http://localhost:10010/autem-exercitationem-quos-possimus/';
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
const variants = [
	{
		name: 'non-heading theme title element',
		replacement: ( title ) =>
			`<news-title class="entry-title" style="display:block">${ title }</news-title>`,
		selector: '.post-header news-title.entry-title',
		tag: 'NEWS-TITLE',
	},
	{
		name: 'calibrated offsets on a non-heading title tag',
		replacement: ( title ) =>
			`<news-title class="entry-title" style="display:block;font-size:36px;line-height:1.2">${ title }</news-title>`,
		selector: '.post-header news-title.entry-title',
		tag: 'NEWS-TITLE',
		offsetCalibration: true,
	},
	{
		name: 'inner title element inside a heading wrapper',
		replacement: ( title ) =>
			`<h1 class="title-wrapper"><span class="entry-title" style="display:block">${ title }</span></h1>`,
		selector: '.post-header h1.title-wrapper > span.entry-title',
		tag: 'SPAN',
	},
	{
		name: 'linked title text inside a post-title heading',
		replacement: ( title, entry ) =>
			`<h6 class="post-title" style="position:relative"><a href="${ entry.permalink }" rel="bookmark">${ title }</a></h6>`,
		selector: '.post-header h6.post-title',
		iconParent: '.post-header h6.post-title > a',
		tag: 'H6',
	},
	{
		name: 'repeated h5 title text inside its anchor',
		replacement: ( title, entry ) =>
			`<h5 class="post-title" style="position:relative"><a href="${ entry.permalink }" rel="bookmark">${ title }</a></h5>`,
		selector: '.post-header h5.post-title',
		iconParent: '.post-header h5.post-title > a',
		tag: 'H5',
	},
	{
		name: 'icon already beside the link in a title heading',
		replacement: ( title, entry ) =>
			`<h5 class="post-title" style="position:relative"><a href="${ entry.permalink }" rel="bookmark">${ title }</a><span class="titlesparks-icon titlesparks-icon--right-top" data-titlesparks-icon="${ entry.id }-title-2"><img src="${ entry.url }" alt="${ entry.alt }"></span></h5>`,
		selector: '.post-header h5.post-title',
		iconParent: '.post-header h5.post-title > a',
		tag: 'H5',
	},
	{
		name: 'widget title uses the top-right title position and offsets',
		replacement: ( title, entry ) =>
			`<aside data-titlesparks-widget="recent-1" data-titlesparks-widget-enabled="1" data-titlesparks-widget-position="right"><a class="thumbnail" style="display:block;width:320px;height:180px;font-size:0" href="${ entry.permalink }">${ title }<img src="${ entry.url }" alt="${ entry.alt }"></a><a class="post-title" href="${ entry.permalink }">${ title }</a></aside>`,
		selector: '[data-titlesparks-widget] a.post-title',
		iconParent: '[data-titlesparks-widget] a.post-title',
		noIconSelector:
			'[data-titlesparks-widget] a.thumbnail [data-titlesparks-icon]',
		tag: 'A',
		widget: true,
	},
	{
		name: 'widget offsets are applied to a larger widget title',
		replacement: ( title, entry ) =>
			`<aside data-titlesparks-widget="recent-1" data-titlesparks-widget-enabled="1" data-titlesparks-widget-position="right"><a class="post-title" style="font-size:24px;line-height:1.4" href="${ entry.permalink }">${ title }</a></aside>`,
		selector: '[data-titlesparks-widget] a.post-title',
		iconParent: '[data-titlesparks-widget] a.post-title',
		tag: 'A',
		widget: true,
		expectedFontSize: '24px',
		widgetPosition: 'right',
		widgetOffsetX: -11,
		widgetOffsetY: -20,
	},
	{
		name: 'a clipping card shrinks its icon instead of indenting the title',
		// 18px of padding is room for a smaller icon and its gap, but not for
		// the whole icon, so the card has to draw it smaller — and the title's
		// words must stay where the author put them. The card is inset from the
		// page edge, because an icon hanging past the screen is pulled back
		// inside the title instead, which is a different answer.
		replacement: ( title, entry ) =>
			`<aside data-titlesparks-widget="recent-1" data-titlesparks-widget-enabled="1" data-titlesparks-widget-position="left" style="overflow:hidden;width:240px;padding-left:18px;margin-left:120px"><a class="post-title" style="display:block;font-size:18px;line-height:1.4" href="${ entry.permalink }">${ title }</a></aside>`,
		selector: '[data-titlesparks-widget] a.post-title',
		iconParent: '[data-titlesparks-widget] a.post-title',
		tag: 'A',
		widget: true,
		expectedFontSize: '18px',
		widgetPosition: 'left',
		widgetOffsetX: 0,
		widgetOffsetY: 0,
		tightFit: 'shrink',
		clippingCard: true,
	},
	{
		name: 'wrapped widget title keeps the icon after the last word',
		replacement: ( title, entry ) =>
			`<aside data-titlesparks-widget="recent-1" data-titlesparks-widget-enabled="1" data-titlesparks-widget-position="right"><a class="post-title" style="display:block;width:250px;font-size:16px;line-height:1.5" href="${ entry.permalink }">${ title }</a></aside>`,
		selector: '[data-titlesparks-widget] a.post-title',
		iconParent: '[data-titlesparks-widget] a.post-title',
		tag: 'A',
		widget: true,
		expectedFontSize: '16px',
		widgetPosition: 'right',
		widgetOffsetX: -11,
		widgetOffsetY: -20,
	},
	{
		name: 'grid-card keeps a wrapped inline title icon beside its text',
		replacement: ( title, entry ) =>
			`<div class="grid-card" style="display:grid;grid-template-columns:minmax(0,1fr) 72px;gap:16px;width:360px"><h5 class="post-title" style="margin:0;font-size:24px;line-height:1.3"><a style="position:relative" href="${ entry.permalink }" rel="bookmark">${ title }</a></h5><aside>Other grid item</aside></div>`,
		selector: '.post-header .grid-card h5.post-title',
		iconParent: '.post-header .grid-card h5.post-title > a',
		tag: 'H5',
		grid: true,
	},
	{
		name: 'title resize recalculates position and adaptive icon size',
		replacement: ( title, entry ) =>
			`<h5 class="post-title" style="position:relative;width:700px;font-size:32px"><a href="${ entry.permalink }" rel="bookmark">${ title }</a></h5>`,
		selector: '.post-header h5.post-title',
		iconParent: '.post-header h5.post-title > a',
		tag: 'H5',
		responsive: true,
	},
	...[
		'left',
		'right',
		'top',
		'bottom',
		'left-top',
		'left-bottom',
		'right-top',
		'right-bottom',
	].map( ( position ) => ( {
		name: `${ position } position keeps title-relative offset scaling`,
		replacement: ( title, entry ) =>
			`<h5 class="post-title" style="position:relative;margin-left:140px;font-size:36px;line-height:1.3"><a href="${ entry.permalink }" rel="bookmark">${ title }</a></h5>`,
		selector: '.post-header h5.post-title',
		iconParent: '.post-header h5.post-title > a',
		tag: 'H5',
		geometryPosition: position,
		geometryOffsetX: 5,
		geometryOffsetY: -7,
	} ) ),
	{
		name: 'wrapped title anchors the icon beside its first line',
		replacement: ( title, entry ) =>
			`<h5 class="post-title" style="position:relative;width:260px;font-size:36px;line-height:1.3"><a href="${ entry.permalink }" rel="bookmark">${ title }</a></h5>`,
		selector: '.post-header h5.post-title',
		iconParent: '.post-header h5.post-title > a',
		tag: 'H5',
		geometryPosition: 'right-top',
		geometryOffsetX: 5,
		geometryOffsetY: -7,
		wrapped: true,
	},
	...[ 'left', 'right' ].map( ( side ) => ( {
		name: `${ side } flush icon touches the words it labels`,
		replacement: ( title, entry ) =>
			`<h5 class="post-title" style="position:relative;margin-left:200px;font-size:36px;line-height:1.3"><a href="${ entry.permalink }" rel="bookmark">${ title }</a></h5>`,
		selector: '.post-header h5.post-title',
		iconParent: '.post-header h5.post-title > a',
		tag: 'H5',
		flushSide: side,
	} ) ),
	{
		// A wrapped first line ends in the space the wrap left behind, which is
		// a rect of its own in Chrome. Measuring the line to that rect left the
		// icon one space past the words it was asked to touch — 11px beside a
		// 40px title in the block editor, and the same on every wrapped title.
		name: 'flush hugs the words of a wrapped first line',
		replacement: ( title, entry ) =>
			`<h5 class="post-title" style="position:relative;width:300px;font-size:24px;line-height:1.3"><a href="${ entry.permalink }" rel="bookmark">${ title }</a></h5>`,
		selector: '.post-header h5.post-title',
		iconParent: '.post-header h5.post-title > a',
		tag: 'H5',
		flushSide: 'right',
		wrapped: true,
	},
];
const runVariant = async ( browser, variant ) => {
	const page = await browser.newPage( {
		viewport: { width: 1440, height: 1000 },
	} );
	let renderedTitle = null;
	await page.route( POST_URL, async ( route ) => {
		const response = await route.fetch();
		const html = await response.text();
		const dataMatch = html.match(
			/window\.titleSparksFrontendData\s*=\s*(\{.*?\});/s
		);
		assert.ok(
			dataMatch,
			'WordPress page should enqueue TitleSparks data'
		);
		const data = JSON.parse( dataMatch[ 1 ] );
		const entry = data.icons.find( ( icon ) => icon.singular );
		assert.ok( entry, 'WordPress should provide a singular post icon' );
		renderedTitle = entry.title;
		const titleMarkup =
			/<h1\b[^>]*class=["'][^"']*(?:title|headline)[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i;
		const match = html.match( titleMarkup );
		assert.ok(
			match,
			'Expected the live theme to render its post title H1'
		);
		assert.equal( match[ 1 ].trim(), renderedTitle );
		const titleElement = variant.replacement( match[ 1 ].trim(), entry );
		const frontendScript = await require( 'node:fs/promises' ).readFile(
			'build-frontend/index.js',
			'utf8'
		);
		const stylesheet = html.match(
			/<link[^>]*href=["']([^"']*title-icons[.]css[^"']*)["']/i
		);
		const frontendScriptUrl = html.match(
			/<script[^>]*src=["']([^"']*build-frontend\/index\.js[^"']*)["']/i
		);
		assert.ok( frontendScriptUrl, 'frontend bundle should be enqueued' );
		// The bundle declares `wp-i18n` as a dependency, and `wp-i18n` declares
		// `wp-hooks`, so the served page loads both first. The fixture stands in
		// for the page and has to carry those tags too, or the bundle throws on
		// `wp.i18n` before it places anything.
		const dependencies = [
			...html.matchAll(
				/<script[^>]*id=["'](?:wp-hooks-js|wp-i18n-js)["'][^>]*><\/script>/gi
			),
		]
			.map( ( match ) => match[ 0 ] )
			.join( '\n' );
		assert.match(
			dependencies,
			/wp-i18n-js/,
			'page should enqueue wp-i18n'
		);
		{
			const scriptVersion = new URL(
				frontendScriptUrl[ 1 ],
				POST_URL
			).searchParams.get( 'ver' );
			const manifest = await require( 'node:fs/promises' ).readFile(
				'build-frontend/index.asset.php',
				'utf8'
			);
			const manifestVersion = manifest.match(
				/'version'\s*=>\s*'([a-f0-9]+)'/
			);
			assert.ok( manifestVersion, 'frontend build manifest has a hash' );
			assert.equal(
				scriptVersion,
				manifestVersion[ 1 ],
				'frontend JavaScript URL must use its current build-manifest hash'
			);
		}
		assert.ok( stylesheet, 'frontend icon stylesheet should be enqueued' );
		{
			const styleVersion = new URL(
				stylesheet[ 1 ],
				POST_URL
			).searchParams.get( 'ver' );
			const pluginFile = await require( 'node:fs/promises' ).readFile(
				'titlesparks.php',
				'utf8'
			);
			const pluginVersion = pluginFile.match(
				/^\s*\*\s*Version:\s*(\S+)\s*$/m
			);
			assert.ok( pluginVersion, 'plugin header declares a version' );
			assert.equal(
				styleVersion,
				pluginVersion[ 1 ],
				'title stylesheet URL must use the plugin version, not a per-request file hash'
			);
		}
		const frontendEntry = {
			...entry,
			// A title-following icon is sized from its stage's bands, so the
			// fixture names the default ladder and the stage that uses it.
			...( variant.responsive
				? {
						sizeMode: 'advanced',
						sizingRules: [
							{ font: 12, icon: 10 },
							{ font: 16, icon: 12 },
							{ font: 20, icon: 15 },
							{ font: 24, icon: 18 },
							{ font: 32, icon: 24 },
							{ font: 40, icon: 30 },
						],
					}
				: {} ),
			marker: variant.widget ? 'widget-test' : undefined,
			widgetIds: variant.widget ? [ 'recent-1' ] : [],
			widgetPositions: variant.widget
				? { 'recent-1': variant.widgetPosition || 'right-top' }
				: {},
			widgetOffsets: variant.widget
				? {
						'recent-1': {
							x: variant.widgetOffsetX ?? 12,
							y: variant.widgetOffsetY ?? 8,
						},
					}
				: {},
		};
		// These variants measure the space between the icon and the words, so
		// they ask for the shipped gap instead of following whatever the site
		// currently has in Settings: a site set to flush would otherwise turn
		// every clearance in this file into zero.
		if ( variant.geometryPosition ) {
			Object.assign( frontendEntry, {
				position: variant.geometryPosition,
				offsetX: variant.geometryOffsetX,
				offsetY: variant.geometryOffsetY,
				iconSpacing: 'gap',
			} );
		} else if ( variant.flushSide ) {
			// No nudge at all, so the only thing between the icon and the
			// words is the space this post asked not to have.
			Object.assign( frontendEntry, {
				position: variant.flushSide,
				offsetX: 0,
				offsetY: 0,
				iconSpacing: 'flush',
			} );
		} else if ( variant.grid ) {
			Object.assign( frontendEntry, {
				position: 'right-top',
				offsetX: 0,
				offsetY: 0,
			} );
		} else if ( variant.widget || variant.offsetCalibration ) {
			Object.assign( frontendEntry, {
				position: 'right-top',
				offsetX: variant.widget ? 12 : 0,
				offsetY: variant.widget ? 8 : 0,
				iconSpacing: 'gap',
			} );
			if ( variant.widgetPosition ) {
				frontendEntry.position = variant.widgetPosition;
				frontendEntry.offsetX = variant.widgetOffsetX;
				frontendEntry.offsetY = variant.widgetOffsetY;
			}
		}
		// The page carries every stage's own values and the browser picks the
		// live one, so a variant that overrides the entry has to override the
		// stages with it. Otherwise the stage the timeline is on now wins and
		// the variant measures a position it never asked for.
		if ( Array.isArray( frontendEntry.stages ) ) {
			const stageFields = [
				'url',
				'still',
				'size',
				'sizeMode',
				'sizingRules',
				'position',
				'offsetX',
				'offsetY',
				'flip',
				'alt',
			];

			frontendEntry.stages = frontendEntry.stages.map( ( stage ) => {
				const pinned = { ...stage };

				stageFields.forEach( ( field ) => {
					if ( field in frontendEntry ) {
						pinned[ field ] = frontendEntry[ field ];
					}
				} );

				return pinned;
			} );

			// Every stage now draws the same icon, so an expired timeline keeps
			// it rather than leaving the fixture with nothing to measure.
			frontendEntry.stage3Behaviour = 'keep';
		}
		const browserFixture = `<!doctype html>
			<html><head><meta charset="utf-8">
				${ stylesheet ? `<link rel="stylesheet" href="${ stylesheet[ 1 ] }">` : '' }
			</head><body>
				<main><article><header class="post-header">${ titleElement }</header></article></main>
				${ dependencies }
				<script>window.titleSparksFrontendData = ${ JSON.stringify( {
					icons: [ frontendEntry ],
					// A variant may ask for the site's tight-card answer; the fixture
					// otherwise leaves the default, which changes nothing.
					...( variant.tightFit
						? { tightFit: variant.tightFit }
						: {} ),
					// The lines these checks measure against are pinned, so a site
					// that chose the whole-title anchor does not turn every expected
					// edge into a different line.
					iconAnchor: 'first_line',
				} ) };</script>
				<script>${ frontendScript }</script>
			</body></html>`;
		await route.fulfill( { response, body: browserFixture } );
	} );
	try {
		const response = await page.goto( POST_URL, {
			waitUntil: 'networkidle',
		} );
		assert.equal( response.status(), 200 );
		const target = page.locator( variant.selector );
		await target.waitFor( { state: 'visible' } );
		const icon = target.locator( `[data-titlesparks-icon]` );
		await icon.waitFor( { state: 'attached' } );
		await page.waitForFunction( ( selector ) => {
			const image = document.querySelector(
				`${ selector } [data-titlesparks-icon] img`
			);
			return image && image.complete && image.naturalWidth > 0;
		}, variant.selector );
		const result = await target.evaluate( ( title, iconParentSelector ) => {
			const iconNode = title.querySelector( '[data-titlesparks-icon]' );
			const rect = iconNode.getBoundingClientRect();
			const style =
				title.ownerDocument.defaultView.getComputedStyle( iconNode );
			const image = iconNode.querySelector( 'img' );
			const actualTitle = title.matches(
				'h1,h2,h3,h4,h5,h6,[role="heading"]'
			)
				? title
				: title.querySelector( 'h1,h2,h3,h4,h5,h6,[role="heading"]' ) ||
					title;
			return {
				tag: actualTitle.tagName,
				text: actualTitle.textContent.replace( /\s+/g, ' ' ).trim(),
				iconIsChild: iconParentSelector
					? iconNode.parentElement.matches( iconParentSelector )
					: iconNode.parentElement === title,
				iconVisible:
					style.visibility !== 'hidden' &&
					style.display !== 'none' &&
					rect.width > 0 &&
					rect.height > 0,
				imageLoaded: image.complete && image.naturalWidth > 0,
				fontSize: style.fontSize,
			};
		}, variant.iconParent || null );
		assert.equal( result.tag, variant.tag );
		assert.ok( result.text.includes( renderedTitle ) );
		assert.equal( result.iconIsChild, true );
		assert.equal( result.iconVisible, true, JSON.stringify( result ) );
		assert.equal( result.imageLoaded, true );
		if ( variant.noIconSelector ) {
			assert.equal(
				await page.locator( variant.noIconSelector ).count(),
				0,
				'thumbnail links must not receive the title icon'
			);
		}
		if (
			variant.widget ||
			variant.offsetCalibration ||
			variant.geometryPosition
		) {
			if ( variant.widget ) {
				assert.equal(
					result.fontSize,
					variant.expectedFontSize || '16px'
				);
			}
			const positionName =
				variant.geometryPosition ||
				variant.widgetPosition ||
				'right-top';
			const placement = await target.evaluate( ( title, position ) => {
				const iconNode = title.querySelector(
					'[data-titlesparks-icon]'
				);
				const range = document.createRange();
				range.selectNodeContents( title );
				if ( position.startsWith( 'left' ) || position === 'top' ) {
					range.setStartAfter( iconNode );
				} else {
					range.setEndBefore( iconNode );
				}
				const iconRect = iconNode.getBoundingClientRect();
				const lines = [ ...range.getClientRects() ].filter(
					( rect ) => rect.width > 0 && rect.height > 0
				);
				const block = range.getBoundingClientRect();
				// The horizontal gaps are measured against the line the icon is
				// anchored to — the first line, which is pinned for this fixture —
				// because that is the line whose words it sits beside. A wrapped
				// title's widest line may be a different one, and measuring
				// against it is what left a first-line icon 148px from its words.
				const first = lines.reduce(
					( top, rect ) =>
						! top || rect.top < top.top ? rect : top,
					null
				);
				const anchored = first || block;
				return {
					className: iconNode.className,
					leftGap: anchored.left - iconRect.right,
					rightGap: iconRect.left - anchored.right,
					topGap: block.top - iconRect.bottom,
					bottomGap: iconRect.top - block.bottom,
					blockHeight: block.bottom - block.top,
					topOffset: parseFloat( iconNode.style.top ),
				};
			}, positionName );
			assert.match(
				placement.className,
				new RegExp( `--${ positionName }` )
			);
			// Post-title icons follow both numbers as written, on every
			// position and in both directions, so an inward nudge may put the
			// icon over the words. A card's icon is the same: it gets the
			// post's offsets, with no clearance held back, so the same post
			// looks the same in a widget as on its page.
			const corner = positionName.includes( '-' );
			if ( variant.geometryPosition ) {
				const fontSize = 36;
				const gap = Math.max( 4, 0.15 * fontSize );
				const scale = fontSize / 32;
				const offsetX = ( variant.geometryOffsetX || 0 ) * scale;
				const offsetY = ( variant.geometryOffsetY || 0 ) * scale;
				const expectGap = ( side, measured, expected ) => {
					assert.ok(
						Math.abs( measured - expected ) <= 1,
						`${ variant.name }: ${ side } gap ${ measured }px, expected ${ expected }px`
					);
				};

				if ( positionName.includes( 'left' ) ) {
					expectGap( 'left', placement.leftGap, gap - offsetX );
				}
				if ( positionName.includes( 'right' ) ) {
					expectGap( 'right', placement.rightGap, gap + offsetX );
				}
				if ( positionName.includes( 'top' ) ) {
					expectGap( 'top', placement.topGap, gap - offsetY );
				}
				if ( positionName.includes( 'bottom' ) ) {
					expectGap( 'bottom', placement.bottomGap, gap + offsetY );
				}
				if ( variant.wrapped ) {
					assert.ok(
						placement.blockHeight > fontSize * 1.5,
						`${ variant.name }: expected several lines, block height ${ placement.blockHeight }px`
					);
				}
			} else if (
				variant.widget &&
				Number.isFinite( variant.widgetOffsetX )
			) {
				// A card's icon is placed from the authored nudge, scaled by the
				// card title's own size, exactly as the post's page places it —
				// so an inward nudge may bring it over the words.
				const fontSize = parseFloat( variant.expectedFontSize ) || 24;
				const gap = 0.15 * fontSize;
				const nudge = variant.widgetOffsetX * ( fontSize / 32 );
				const measured = positionName.startsWith( 'left' )
					? placement.leftGap
					: placement.rightGap;
				const expected = positionName.startsWith( 'left' )
					? gap - nudge
					: gap + nudge;

				assert.ok(
					Math.abs( measured - expected ) <= 1,
					`${ variant.name }: clearance ${ measured }px, where the authored ${ variant.widgetOffsetX }px at ${ fontSize }px is ${ expected }px`
				);
			} else if ( ! corner && positionName.startsWith( 'left' ) ) {
				assert.ok(
					placement.leftGap >= 1,
					`${ variant.name }: measured horizontal clearance ${ placement.leftGap }px is below 2px`
				);
			} else if ( ! corner && positionName.startsWith( 'right' ) ) {
				assert.ok(
					placement.rightGap >= 1,
					`${ variant.name }: measured horizontal clearance ${ placement.rightGap }px is below 2px`
				);
			}
			// The vertical axis is a free slide, so an offset may deliberately
			// place the icon closer to or over the title; only its visibility is
			// asserted here.
			if ( variant.widget ) {
				const widgetHeight = await target.evaluate(
					( title ) => title.getBoundingClientRect().height
				);
				assert.ok( widgetHeight > 0 );
			}
		}
		if ( variant.clippingCard ) {
			// A card that hides what leaves it is the one case the fit answer
			// touches, and the answer is a smaller icon: the title keeps its line
			// length and its words never move. Squeezing the words to keep a
			// picture whole is what indented a recent posts title by 28px.
			const card = await target.evaluate( ( title ) => {
				const iconNode = title.querySelector(
					'[data-titlesparks-icon]'
				);
				const cardNode = title.closest( '[data-titlesparks-widget]' );
				const cardRect = cardNode.getBoundingClientRect();
				const iconRect = iconNode.getBoundingClientRect();
				const room =
					cardRect.width -
					parseFloat( getComputedStyle( cardNode ).paddingLeft ) -
					parseFloat( getComputedStyle( cardNode ).paddingRight );

				return {
					overflow: getComputedStyle( cardNode ).overflowX,
					paddingLeft: parseFloat(
						getComputedStyle( title ).paddingLeft
					),
					width: iconRect.width,
					room,
					fitted: Object.prototype.hasOwnProperty.call(
						iconNode.dataset,
						'tsFitWidth'
					),
					iconLeft: iconRect.left,
					cardLeft: cardRect.left,
					inside:
						iconRect.left >= cardRect.left - 0.5 &&
						iconRect.right <= cardRect.right + 0.5,
				};
			} );

			assert.equal( card.overflow, 'hidden' );
			assert.ok(
				card.fitted,
				`${ variant.name }: a card that clips should draw its icon smaller, measured ${ card.width }px in ${ card.room }px of room`
			);
			assert.ok(
				card.width >= 8,
				`${ variant.name }: the fitted icon fell below the 8px floor, measured ${ card.width }px`
			);
			assert.ok(
				card.paddingLeft < 1,
				`${ variant.name }: the title was indented ${ card.paddingLeft }px to keep the icon whole`
			);
			assert.ok(
				card.inside,
				`${ variant.name }: the icon sits outside the card's clip box, icon ${ card.iconLeft }px against card ${ card.cardLeft }px`
			);
		}
		if ( variant.grid ) {
			// A side placement is measured against the words of the line it is
			// anchored to — the first line by default — so a wrapped title's
			// icon sits one gap past that line's own edge, whichever side the
			// page happens to draw.
			const alignment = await target.evaluate( ( heading ) => {
				const link = heading.querySelector( 'a' );
				const iconNode = link.querySelector(
					'[data-titlesparks-icon]'
				);
				const textNode = [ ...link.childNodes ].find(
					( node ) => node.nodeType === 3
				);
				const range = document.createRange();
				range.selectNodeContents( textNode );
				const lines = [ ...range.getClientRects() ].filter(
					( rect ) => rect.width > 0 && rect.height > 0
				);
				const first = lines.reduce( ( top, rect ) =>
					! top || rect.top < top.top ? rect : top
				);
				const block = lines.reduce(
					( box, rect ) => ( {
						left: Math.min( box.left, rect.left ),
						right: Math.max( box.right, rect.right ),
						top: Math.min( box.top, rect.top ),
					} ),
					{
						left: Infinity,
						right: -Infinity,
						top: Infinity,
					}
				);
				const iconRect = iconNode.getBoundingClientRect();
				const fontSize = parseFloat(
					link.ownerDocument.defaultView.getComputedStyle( link )
						.fontSize
				);
				const entry = (
					window.titleSparksFrontendData.icons || []
				).find(
					( item ) =>
						String( item.id ) ===
						iconNode.getAttribute( 'data-titlesparks-icon' )
				);
				// A post that asked for no space draws no gap.
				const gap =
					'flush' === ( entry && entry.iconSpacing )
						? 0
						: Math.max( 4, fontSize * 0.15 );
				// A corner icon is placed against the top of the first line; a
				// plain side is centred on that line instead.
				const corner = /--[a-z]+-(top|bottom)/.test(
					iconNode.className
				);
				const expectedTop = corner
					? first.top - iconRect.height - gap
					: first.top + first.height / 2 - iconRect.height / 2;

				return {
					lineCount: lines.length,
					side: /--right/.test( iconNode.className )
						? 'right'
						: 'left',
					corner,
					left: iconRect.left,
					right: iconRect.right,
					top: iconRect.top,
					height: iconRect.height,
					expectedLeft: first.right + gap,
					expectedRight: first.left - gap,
					expectedTop,
				};
			} );
			assert.ok( alignment.lineCount > 1, 'grid title should wrap' );
			if ( 'right' === alignment.side ) {
				assert.ok(
					Math.abs( alignment.left - alignment.expectedLeft ) < 1,
					`icon should sit one gap to the right of the title text, measured ${ alignment.left }px against ${ alignment.expectedLeft }px`
				);
			} else {
				assert.ok(
					Math.abs( alignment.right - alignment.expectedRight ) < 1,
					`icon should sit one gap to the left of the title text, measured ${ alignment.right }px against ${ alignment.expectedRight }px`
				);
			}
			assert.ok(
				Math.abs( alignment.top - alignment.expectedTop ) < 1,
				`icon should align with ${ alignment.corner ? 'the top edge of the first title line' : 'the first title line\u2019s middle' }, measured ${ alignment.top }px against ${ alignment.expectedTop }px`
			);
		}
		if ( variant.flushSide ) {
			// The icon's own edge is what was asked to touch the words: no gap
			// and no small-icon centring either, since holding a narrow icon's
			// middle half a box out would leave the space flush removed.
			const flush = await target.evaluate( ( title, side ) => {
				const iconNode = title.querySelector(
					'[data-titlesparks-icon]'
				);
				const link = iconNode.parentElement;
				const textNode = [ ...link.childNodes ].find(
					( node ) => node.nodeType === 3
				);
				// Measured word by word, on the line the icon sits on. A range over
				// the line's whole text includes the space a soft wrap leaves
				// hanging at its end, which is one space wider than the words and
				// would let a flush icon sit a space away from them.
				const words = [];
				const text = textNode.textContent;
				const pattern = /\S+/g;
				let match = pattern.exec( text );

				while ( match ) {
					const range = document.createRange();
					range.setStart( textNode, match.index );
					range.setEnd( textNode, match.index + match[ 0 ].length );
					[ ...range.getClientRects() ]
						.filter( ( rect ) => rect.width > 0 && rect.height > 0 )
						.forEach( ( rect ) => words.push( rect ) );
					match = pattern.exec( text );
				}

				const iconRect = iconNode.getBoundingClientRect();
				const middle = ( iconRect.top + iconRect.bottom ) / 2;
				const distance = ( rect ) =>
					middle < rect.top
						? rect.top - middle
						: Math.max( 0, middle - rect.bottom );
				const line = words.reduce(
					( best, rect ) =>
						! best || distance( rect ) < distance( best )
							? rect
							: best,
					null
				);
				const block = line
					? {
							left: Math.min(
								...words
									.filter(
										( rect ) =>
											Math.abs( rect.top - line.top ) < 1
									)
									.map( ( rect ) => rect.left )
							),
							right: Math.max(
								...words
									.filter(
										( rect ) =>
											Math.abs( rect.top - line.top ) < 1
									)
									.map( ( rect ) => rect.right )
							),
						}
					: { left: 0, right: 0 };
				const fontSize = parseFloat(
					link.ownerDocument.defaultView.getComputedStyle( link )
						.fontSize
				);

				return {
					className: iconNode.className,
					clearance:
						'left' === side
							? block.left - iconRect.right
							: iconRect.left - block.right,
					// The space this answer removed, so a passing check cannot be
					// a gap too small to measure.
					removed: Math.max( 4, fontSize * 0.15 ),
				};
			}, variant.flushSide );

			assert.match(
				flush.className,
				new RegExp( `--${ variant.flushSide }` ),
				`${ variant.name }: icon should be drawn ${ variant.flushSide } of the title`
			);
			assert.ok(
				flush.removed > 2,
				`${ variant.name }: the gap a flush icon removes should be measurable, got ${ flush.removed }px`
			);
			assert.ok(
				Math.abs( flush.clearance ) <= 2,
				`${ variant.name }: the icon stands ${ flush.clearance }px from the words on its own line, expected 0`
			);
		}
		if ( variant.responsive ) {
			const initial = await target.evaluate( ( title ) => {
				const iconNode = title.querySelector(
					'[data-titlesparks-icon]'
				);
				return {
					width: iconNode.getBoundingClientRect().width,
				};
			} );
			// The fixture's 32px title sits on the ladder's 24px band.
			assert.ok(
				Math.abs( initial.width - 24 ) < 0.6,
				`expected a 24px icon beside a 32px title, measured ${ initial.width }px`
			);
			await target.evaluate( ( title ) => {
				title.style.width = '230px';
				title.style.fontSize = '20px';
				title.querySelector( 'a' ).style.fontSize = '20px';
				window.dispatchEvent( new Event( 'resize' ) );
			} );
			// A 20px title is on the ladder's 15px band, so the icon has to be
			// re-measured and redrawn at that size.
			await page.waitForFunction( ( selector ) => {
				const heading = document.querySelector( selector );
				const iconNode = heading?.querySelector(
					'[data-titlesparks-icon]'
				);
				return (
					iconNode &&
					Math.abs( iconNode.getBoundingClientRect().width - 15 ) <
						0.6
				);
			}, variant.selector );
			const resized = await target.evaluate( ( title ) => {
				const iconNode = title.querySelector(
					'[data-titlesparks-icon]'
				);
				return {
					width: iconNode.getBoundingClientRect().width,
					parent: iconNode.parentElement.tagName,
				};
			} );
			assert.ok( resized.width < initial.width );
			assert.equal( resized.parent, 'A' );
		}
		process.stdout.write(
			`PASS: ${ variant.name } (${ result.tag }, visible icon child)\n`
		);
	} finally {
		await page.close();
	}
};
( async () => {
	const browser = await chromium.launch( {
		executablePath: CHROME || undefined,
		headless: true,
	} );
	try {
		for ( const variant of variants ) {
			await runVariant( browser, variant );
		}
	} finally {
		await browser.close();
	}
} )().catch( ( error ) => {
	process.stderr.write( `${ error.stack || error }\n` );
	process.exitCode = 1;
} );
