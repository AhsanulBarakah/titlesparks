/*
 * Check that a front-end icon stays where it was placed.
 *
 * A widget icon that needs room inside its card reserves that room on the
 * title. Placement used to give the room back at the start of every pass and
 * take it again, and the resize observer watching the title saw its own padding
 * change and scheduled the next pass. The result was a title and icon that
 * shook for as long as the page was open.
 *
 * The test opens a real page, waits for fonts and images, then watches the
 * titles for style changes and measures the icon and text relative to the
 * title. Nothing is written to WordPress.
 *
 * Both the page's own title and the previous/next links beside it are measured.
 * They are the copies a placement bug lands on, and a filter that guessed at
 * "sliders" by class-name substring used to skip them silently: the reference
 * theme puts `af-cat-widget-carousel` on the content wrapper of every post page.
 * Sliders are still skipped for what they are — library slide elements, a
 * literal `carousel`/`ticker` class, or any container seen moving its own titles
 * while the page is watched — because a theme moves those on purpose.
 *
 * One page, or several in one pass — separated by commas or whitespace, so a
 * post, an archive and the homepage are measured by one command:
 *
 *   TITLESPARKS_TEST_POST_URL="http://localhost:10010/deserunt-pariatur-assumenda-nihil-est-maiores/ http://localhost:10010/" \
 *   node tests/integration/frontend-icon-stability.cjs
 *
 * Every page is measured exactly as it would be on its own, and one page's
 * failure does not stop the rest: the run ends with the pages that failed.
 *
 * Each page is measured in every window `TITLESPARKS_TEST_VIEWPORTS` names,
 * `WIDTHxHEIGHT` and separated the same way:
 *
 *   TITLESPARKS_TEST_VIEWPORTS="390x844,768x900,1440x900" \
 *   node tests/integration/frontend-icon-stability.cjs
 *
 * A phone width is where the title is smallest and the least room is left
 * beside it; a wide window is where it is largest. One size runs exactly as it
 * did before, which is what the default — 1440x900 — is for.
 */
const assert = require( 'node:assert/strict' );
const { existsSync } = require( 'node:fs' );
const { chromium } = require( 'playwright' );

/**
 * The pages to check.
 *
 * `TITLESPARKS_TEST_POST_URL` holds one URL or a list of them, separated by
 * commas or whitespace. Each page is read in a fresh tab, so a theme's
 * scroll-triggered content on one page cannot colour the next one's
 * measurements.
 */
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
 * The windows each page is measured in.
 *
 * `TITLESPARKS_TEST_VIEWPORTS` holds one size or a list of them, `WIDTHxHEIGHT`,
 * separated by commas or whitespace. A phone width is where a theme's title is
 * smallest — the nudge scale reaches its floor there and the placement has the
 * least room beside the words — and a wide window is where the title is largest
 * and the scale reaches its ceiling, so the two ends of the offset arithmetic
 * are exercised by one run rather than assumed from the 32px canvas.
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
const SETTLE_MS = 1200;
const SAMPLE_MS = 1200;
const SAMPLE_EVERY_MS = 80;

// Mirrors of the numbers in `blocks/shared/editorTitleDom.js`. The unit tests
// keep that module and the stylesheet in step; these keep the page in step with
// the module, which is the half no unit test can see.
const GAP_EM = 0.15;
const OFFSET_REFERENCE_PX = 32;
const OFFSET_SCALE_MAX = 1.4;
// `ICON_ANCHOR_SIZE`: an icon no wider than this is narrowed about its middle,
// so its near edge stands an extra half of the narrowing away from the words.
// The gap-plus-nudge arithmetic below only lines up once that is taken out, and
// it matters exactly where this check was blind before: a 12px title on a phone
// draws a 16px icon, whose near edge sits 2px further out than the gap alone.
const ICON_ANCHOR_SIZE = 20;
const anchorShift = ( width ) =>
	Math.max( 0, ( ICON_ANCHOR_SIZE - width ) / 2 );

// An icon at or below the 20px anchor box is corrected about its own middle, so
// its near edge can sit a fraction of a pixel off the arithmetic even after the
// anchor shift is taken out. Measured on the reference site that fraction stays
// under 0.6px, and every regression this check is for is worth at least 1.5px:
// the 4px gap floor back on a 15px title, or a card's nudge held back to leave it
// a clearance instead of covering the words its post's page covers.
const NUDGE_TOLERANCE_PX = 1;

/*
 * Containers whose own script moves the titles inside them, so an icon in one has
 * no fixed clearance to read.
 *
 * Matched as whole class names, not as the substring a `[class*="carousel"]`
 * filter reads. A theme may name a plain wrapper after what it holds: the
 * reference theme puts `af-cat-widget-carousel` on the post content wrapper of
 * *every* post page, which that substring matched — so the page's own title and
 * both adjacent-post titles were skipped by the one check written to guard their
 * placement, and a 20x80 icon drew there unnoticed. A real slider still matches
 * by its own class name (`carousel`, `ticker`) or by the library it uses.
 */
const SLIDE_CONTAINERS = [
	'.slick-slide',
	'.swiper-slide',
	'.tns-item',
	'.owl-item',
	'.splide__slide',
	'.glide__slide',
	'.ticker-slide-item',
	'[class~="carousel"]',
	'[class~="ticker"]',
].join( ', ' );

/**
 * The width a table of title-size bands asks for at one title size.
 *
 * A mirror of `advancedIconWidth()` in `blocks/shared/editorTitleDom.js`: a
 * row holds from its own title size up to the next one, with the nearest row
 * holding outside the table.
 *
 * @param {Array}  rules    `{ font, icon }` pairs in pixels, sorted by font.
 * @param {number} fontPx   Title size the icon is drawn beside.
 * @return {number|null} Width in pixels, or null when nothing can be read.
 */
const bandWidth = ( rules, fontPx ) => {
	if ( ! Array.isArray( rules ) || ! Number.isFinite( fontPx ) || fontPx <= 0 ) {
		return null;
	}

	const bands = rules
		.map( ( rule ) => ( {
			font: Number.parseFloat( rule && rule.font ),
			icon: Number.parseFloat( rule && rule.icon ),
		} ) )
		.filter( ( band ) => Number.isFinite( band.font ) && band.icon > 0 );

	if ( ! bands.length ) {
		return null;
	}

	let smallest = null;
	let atOrBelow = null;

	bands.forEach( ( band ) => {
		if ( null === smallest || band.font < smallest.font ) {
			smallest = band;
		}

		if (
			band.font <= fontPx &&
			( null === atOrBelow || band.font >= atOrBelow.font )
		) {
			atOrBelow = band;
		}
	} );

	return ( atOrBelow || smallest ).icon;
};

/**
 * How much the icon grew from the 32px canvas to the title being read.
 *
 * The nudge follows whichever is smaller, the title's own growth or the
 * icon's: an icon the bands held at one width has stopped following the title
 * and must not drag its nudge along. A fixed icon has no bands, so null leaves
 * the title's growth alone.
 *
 * @param {Object} row Measured icon row.
 * @return {number|null} Growth, or null when the icon is fixed.
 */
const iconGrowth = ( row ) => {
	if ( 'advanced' !== row.sizeMode ) {
		return null;
	}

	const at = bandWidth( row.sizingRules, row.font );
	const reference = bandWidth( row.sizingRules, OFFSET_REFERENCE_PX );

	return at > 0 && reference > 0 ? at / reference : null;
};


/**
 * Watch the icons on the page for a short while.
 *
 * Sliders are skipped: a theme moves a slide on purpose, and that movement is
 * not a placement bug. The comparison is relative to each title, so a lazy
 * image pushing the whole page down does not count as an icon moving; a
 * container that moves its own titles while the icons are watched is reported
 * as such, and its icons' positions are left unmeasured for the same reason.
 *
 * @param  page
 * @return {Promise<Array>} One record per stable icon.
 */
const measure = ( page ) =>
	page.evaluate(
		async ( { sampleMs, everyMs, slideContainers } ) => {
			const sleep = ( ms ) =>
				new Promise( ( resolve ) => setTimeout( resolve, ms ) );

			/**
			 * The text box of a title, with the icon left out.
			 *
			 * @param {Element} title Title element.
			 * @return {Object|null} Union of the text line rects.
			 */
			const textBox = ( title ) => {
				const walker = document.createTreeWalker(
					title,
					NodeFilter.SHOW_TEXT
				);
				const nodes = [];

				while ( walker.nextNode() ) {
					if ( walker.currentNode.textContent.trim() ) {
						nodes.push( walker.currentNode );
					}
				}

				if ( ! nodes.length ) {
					return null;
				}

				const range = document.createRange();
				range.setStart( nodes[ 0 ], 0 );
				range.setEnd(
					nodes[ nodes.length - 1 ],
					nodes[ nodes.length - 1 ].textContent.length
				);
				const rects = [ ...range.getClientRects() ].filter(
					( rect ) => rect.width > 0 && rect.height > 0
				);

				if ( ! rects.length ) {
					return null;
				}

				return {
					left: Math.min( ...rects.map( ( rect ) => rect.left ) ),
					top: Math.min( ...rects.map( ( rect ) => rect.top ) ),
				};
			};

			const icons = [
				...document.querySelectorAll( '[data-titlesparks-icon]' ),
			].filter(
				( icon ) =>
					! icon.closest( slideContainers ) &&
					icon.getBoundingClientRect().width > 0
			);

			// Counted by element, over the page rather than over the parent each
			// icon had when the sampling started: a card whose thumbnail loads
			// late hands the icon to a different host, and reading the count off
			// the old parent then said "undefined" instead of how still the icon
			// stayed.
			const changes = new Map();
			const observer = new MutationObserver( ( records ) => {
				for ( const record of records ) {
					if ( 'style' === record.attributeName ) {
						changes.set(
							record.target,
							( changes.get( record.target ) || 0 ) + 1
						);
					}
				}
			} );

			observer.observe( document.body, {
				attributes: true,
				attributeFilter: [ 'style' ],
				subtree: true,
			} );

			// Every element each icon lived in while it was sampled.
			const hosts = icons.map( () => new Set() );

			const read = () =>
				icons.map( ( icon, index ) => {
					const title = icon.parentElement;

					// An icon the page removed while it was being watched has
					// nothing left to measure; the run reports that rather than
					// reading a detached node.
					if ( ! title ) {
						return null;
					}

					hosts[ index ].add( title );

					const titleBox = title.getBoundingClientRect();
					const iconBox = icon.getBoundingClientRect();
					const text = textBox( title );
					// The picture, not the icon's wrapper: a theme may pad or border
					// the wrapper, and that is its own arrangement. What must hold is
					// that the drawing keeps the picture's shape.
					const picture = icon.querySelector( 'img' );
					const pictureBox =
						picture && picture.naturalWidth && picture.naturalHeight
							? picture.getBoundingClientRect()
							: null;

					return {
						pictureWidth: pictureBox
							? +pictureBox.width.toFixed( 2 )
							: null,
						pictureHeight: pictureBox
							? +pictureBox.height.toFixed( 2 )
							: null,
						naturalRatio: pictureBox
							? picture.naturalWidth / picture.naturalHeight
							: null,
						id: icon.getAttribute( 'data-titlesparks-icon' ),
						// Which element holds the icon. Placement never moves an
						// icon once it is in place, and a pass that picks a second
						// host alternates with the one before it — an icon that
						// flipped between a heading and the link inside it on every
						// pass, a pixel away each time.
						host: `${ title.tagName }.${
							String( title.className ).split( ' ' )[ 0 ]
						}`,
						left: +( iconBox.left - titleBox.left ).toFixed( 2 ),
						top: +( iconBox.top - titleBox.top ).toFixed( 2 ),
						// Where the icon's own container is on the page. A banner
						// marquee or a carousel mid-slide carries the icon and its title
						// along together, which is not placement moving anything.
						parentLeft: +titleBox.left.toFixed( 2 ),
						parentTop: +titleBox.top.toFixed( 2 ),
						textLeft: text
							? +( text.left - titleBox.left ).toFixed( 2 )
							: null,
						textTop: text
							? +( text.top - titleBox.top ).toFixed( 2 )
							: null,
						paddingLeft: getComputedStyle( title ).paddingLeft,
						paddingRight: getComputedStyle( title ).paddingRight,
					};
				} );

			const samples = [];
			const start = Date.now();

			while ( Date.now() - start < sampleMs ) {
				samples.push( read() );
				await sleep( everyMs );
			}

			observer.disconnect();

			return icons.map( ( icon, index ) => {
				// A sample taken while the icon had no parent is dropped, so a
				// re-parent mid-run costs no sample and a removed icon ends up
				// with none.
				const values = samples
					.map( ( sample ) => sample && sample[ index ] )
					.filter( Boolean );

				return {
					id: icon.getAttribute( 'data-titlesparks-icon' ),
					samples: values,
					// The style changes of every title the icon was drawn in,
					// added up: one parent's churn is not hidden by a move.
					styleChanges: [ ...hosts[ index ] ].reduce(
						( total, host ) => total + ( changes.get( host ) || 0 ),
						0
					),
				};
			} );
		},
		{
			sampleMs: SAMPLE_MS,
			everyMs: SAMPLE_EVERY_MS,
			slideContainers: SLIDE_CONTAINERS,
		}
	);

/**
 * The spread of one number across the samples.
 *
 * @param {Array} values Numbers.
 * @return {number} Largest minus smallest, or 0 with no samples.
 */
const spread = ( values ) => {
	const numbers = values.filter( Number.isFinite );

	return numbers.length ? Math.max( ...numbers ) - Math.min( ...numbers ) : 0;
};

/**
 * Check one page.
 *
 * Everything from the load down is the same for every page, which is what lets
 * one command check a post, a listing and a homepage without three separate
 * measurements drifting apart.
 *
 * @param {Browser} browser  Browser to open the page in.
 * @param {string}  url      Page to check.
 * @param {Object}  viewport Window to measure it in.
 * @return {Promise<void>} Resolves when every icon on the page passed.
 */
const checkPage = async ( browser, url, viewport ) => {
	const page = await browser.newPage( { viewport } );

	try {
		await page.goto( url, { waitUntil: 'domcontentloaded' } );
		await page.waitForLoadState( 'load', { timeout: 30000 } );
		await page.evaluate( async () => {
			if ( document.fonts && document.fonts.ready ) {
				await document.fonts.ready;
			}

			// Lazy images outside the viewport may never load on their own; the
			// cap keeps one of those from holding the check open forever.
			await Promise.all(
				[ ...document.images ]
					.filter( ( image ) => ! image.complete )
					.map(
						( image ) =>
							new Promise( ( resolve ) => {
								const done = () => resolve();
								const timer = setTimeout( done, 3000 );

								image.addEventListener(
									'load',
									() => {
										clearTimeout( timer );
										done();
									},
									{ once: true }
								);
								image.addEventListener(
									'error',
									() => {
										clearTimeout( timer );
										done();
									},
									{ once: true }
								);
							} )
					)
			);
		} );
		await page.waitForTimeout( SETTLE_MS );

		const icons = await measure( page );

		assert.ok(
			icons.length,
			'No front-end icons were found on this page: point TITLESPARKS_TEST_POST_URL at a page that shows one.'
		);

		let movedCount = 0;

		for ( const icon of icons ) {
			assert.ok(
				icon.samples.length,
				`${ icon.id }: the icon left the page while it was being watched, so its position could not be sampled.`
			);

			const padding = [
				...new Set(
					icon.samples.map(
						( sample ) =>
							`${ sample.paddingLeft }/${ sample.paddingRight }`
					)
				),
			];

			const hosts = [ ...new Set( icon.samples.map( ( s ) => s.host ) ) ];
			assert.equal(
				hosts.length,
				1,
				`${ icon.id }: the icon moved between ${ hosts.join(
					' and '
				) } while the page was settled; placement is choosing a new host on every pass.`
			);

			assert.ok(
				icon.styleChanges <= 1,
				`${ icon.id }: the title changed its style ${ icon.styleChanges } times after the page settled; placement is writing its own reservation again.`
			);
			assert.ok(
				padding.length === 1,
				`${ icon.id }: the title padding changed during the check (${ padding.join( ', ' ) }).`
			);
			// Movement is only placement's fault when the nature of the page has
			// not moved the icon itself. A banner marquee carries the words and the
			// icon along together — measured on the reference homepage, a title
			// slid 91px while its icon held the offset it was given — and reading
			// that as a placement fault reported an icon that "moved" on every
			// pass. A container that moves its own titles is named and passed
			// over; everything that holds still is measured as before.
			const movedContainer =
				spread( icon.samples.map( ( sample ) => sample.parentLeft ) ) > 2 ||
				spread( icon.samples.map( ( sample ) => sample.parentTop ) ) > 2;

			if ( movedContainer ) {
				movedCount += 1;
				console.log(
					`${ icon.id }: inside a container that moves its own titles, so its position is not measured`
				);
			} else {
				assert.ok(
					spread( icon.samples.map( ( sample ) => sample.left ) ) <= 0.5,
					`${ icon.id }: the icon moved horizontally after the page settled.`
				);
				assert.ok(
					spread( icon.samples.map( ( sample ) => sample.top ) ) <= 0.5,
					`${ icon.id }: the icon moved vertically after the page settled.`
				);
				assert.ok(
					spread( icon.samples.map( ( sample ) => sample.textLeft ) ) <=
						0.5,
					`${ icon.id }: the title text moved horizontally after the page settled.`
				);
			}

			// The size mode decides the icon's width, so its height has to follow
			// from the picture itself. A theme's previous/next thumbnail rule —
			// `:is(.nav-previous, .nav-next) img { width: 80px; height: 80px }` on
			// the reference theme — matched this icon too, outranked the size in
			// the plugin's stylesheet, and drew a 20px icon at 20x80: four times
			// its own height, cropped, and reading as if the size setting were
			// ignored.
			const first = icon.samples[ 0 ];

			if ( first && first.naturalRatio && first.pictureHeight > 0 ) {
				const drawn = first.pictureWidth / first.pictureHeight;

				assert.ok(
					Math.abs( drawn - first.naturalRatio ) / first.naturalRatio <=
						0.05,
					`${ icon.id }: the icon is drawn ${ first.pictureWidth }x${ first.pictureHeight } (${ drawn.toFixed(
						2
					) }:1) but its picture is ${ first.naturalRatio.toFixed(
						2
					) }:1 — it is stretched to the box it sits in instead of keeping the size the plugin drew.`
				);
			}

			console.log(
				`${ icon.id }: stable, ${ icon.styleChanges } style change(s), padding ${ padding[ 0 ] }, ${ first?.pictureWidth }x${ first?.pictureHeight }`
			);
		}

		// Room is only ever taken from a title to keep its icon inside a card
		// that would cut it off. A card whose overflow is visible hides nothing,
		// so indenting its title only moves the words: measured on a recent posts
		// item, the icon sat in the theme's own page padding while the title was
		// pushed 28px to the right for no reason.
		const indented = await page.evaluate( () => {
			const clippedAbove = ( node ) => {
				let parent = node;

				while ( parent && parent !== document.body ) {
					const style = getComputedStyle( parent );

					if (
						/(hidden|clip|scroll|auto)/.test(
							`${ style.overflowX } ${ style.overflowY }`
						)
					) {
						return true;
					}

					parent = parent.parentElement;
				}

				return false;
			};

			return [ ...document.querySelectorAll( '[data-titlesparks-icon]' ) ]
				.filter( ( icon ) => {
					const title = icon.parentElement;
					const style = getComputedStyle( title );
					const padding =
						( parseFloat( style.paddingLeft ) || 0 ) +
						( parseFloat( style.paddingRight ) || 0 );

					return padding > 0 && ! clippedAbove( title );
				} )
				.map( ( icon ) => ( {
					id: icon.getAttribute( 'data-titlesparks-icon' ),
					padding: `${ getComputedStyle( icon.parentElement ).paddingLeft }/${ getComputedStyle( icon.parentElement ).paddingRight }`,
				} ) );
		} );

		assert.deepEqual(
			indented,
			[],
			`These titles were indented with nothing clipping their icon: ${ JSON.stringify( indented ) }`
		);

		// The author's nudge, read back off the page. The clearance between the
		// icon and its title's text is the gap (`0.15em`) plus the nudge, so the
		// nudge is what is left once the gap is taken out. It must be the number
		// the author typed, scaled by the title's own size up to 1.4 —
		// the rule the icon's position and the gap were both tuned to. A pixel
		// floor on the gap, or a nudge scaled from the title alone while the icon
		// was held at one of its bounds, both show up here as a clearance that no
		// longer matches the number the editor showed.
		const nudges = await page.evaluate( async ( slideContainers ) => {
			const data = window.titleSparksFrontendData || {};
			const rows = [];

			// A container that is animating its own titles — a banner marquee, a
			// carousel mid-slide — leaves no fixed clearance to read: the words
			// slide while the icon holds its offset. One pair of readings, taken
			// for the whole page rather than per icon, names those containers.
			const moving = new Set();
			const containers = [
				...new Set(
					[ ...document.querySelectorAll( '[data-titlesparks-icon]' ) ]
						.map( ( icon ) => icon.parentElement )
						.filter( Boolean )
				),
			];
			const before = containers.map( ( node ) =>
				node.getBoundingClientRect()
			);

			await new Promise( ( resolve ) => setTimeout( resolve, 200 ) );

			containers.forEach( ( node, index ) => {
				const now = node.getBoundingClientRect();

				if (
					Math.abs( now.left - before[ index ].left ) > 2 ||
					Math.abs( now.top - before[ index ].top ) > 2
				) {
					moving.add( node );
				}
			} );

			/**
			 * The innermost element inside a wrapper that carries the title.
			 *
			 * The plugin measures a title's words, and remembers which node they
			 * were in when it inserted the icon: for a card link that holds a
			 * label above the title and a thumbnail beside it, the words are a
			 * node of their own inside the link. Reading the link instead read
			 * the label's line as the title, and reported the adjacent-post icons
			 * as a hundred pixels off. This finds the same node from the outside,
			 * by the title the server sent for that entry.
			 *
			 * @param {Element} wrapper Element the icon was inserted into.
			 * @param {Element} icon    The icon itself.
			 * @param {string}  title   The entry's own title text.
			 * @return {Element} The words' node, or the wrapper when none holds
			 *                   them on its own.
			 */
			const wordsNode = ( wrapper, icon, title ) => {
				const wanted = String( title || '' )
					.replace( /\s+/g, ' ' )
					.trim();

				if ( ! wanted ) {
					return wrapper;
				}

				let best = null;
				let deepest = -1;

				wrapper.querySelectorAll( '*' ).forEach( ( node ) => {
					// The icon is not the title, and neither is anything holding
					// it: the words sit beside the icon, in their own node.
					if ( icon.contains( node ) || node.contains( icon ) ) {
						return;
					}

					const text = String( node.textContent || '' )
						.replace( /\s+/g, ' ' )
						.trim();

					if ( ! text.includes( wanted ) ) {
						return;
					}

					let levels = 0;
					let walk = node;

					while ( walk && walk !== wrapper ) {
						levels += 1;
						walk = walk.parentElement;
					}

					if ( levels > deepest ) {
						deepest = levels;
						best = node;
					}
				} );

				return best || wrapper;
			};

			document
				.querySelectorAll( '[data-titlesparks-icon]' )
				.forEach( ( icon ) => {
					const parent = icon.parentElement;
					const classes = icon.className || '';
					const side = /icon--right/.test( classes )
						? 'right'
						: /icon--left/.test( classes )
						? 'left'
						: null;

					if ( ! parent || ! side ) {
						return;
					}

					if ( moving.has( parent ) ) {
						return;
					}

					// A slider or ticker scrolls its own titles, so an icon inside
					// one has no fixed clearance to read; the stability sampling
					// above skips the same containers. A phone width is where a
					// theme's ticker is narrow enough to matter.
					if ( icon.closest( slideContainers ) ) {
						return;
					}

					const id = String( icon.getAttribute( 'data-titlesparks-icon' ) );
					// The post an icon belongs to, which is the entry's own id. The
					// plugin names every copy of a title after the post and adds what
					// the copy is: `<post>`, `<post>-title-1` for a listing card,
					// `<post>-slide-2` in a carousel, and `widget-<post>` or
					// `widget-<post>-<widget id>` in a sidebar. Reading the first
					// segment after the optional `widget-` is the post in every one
					// of those; matching on `includes` instead let a short id answer
					// for a longer one, and matching on a prefix dropped every widget
					// copy out of this check.
					const post =
						'widget-' === id.slice( 0, 7 )
							? id.split( '-' )[ 1 ]
							: id.split( '-' )[ 0 ];
					const entry = ( data.icons || [] ).find(
						( item ) => String( item.id ) === String( post )
					);

					if ( ! entry ) {
						return;
					}

					// The words the plugin measured against, not the wrapper it
					// inserted the icon into.
					const words = wordsNode( parent, icon, entry.title );

					// The title's own text, with the icon left out of the range.
					const walker = document.createTreeWalker(
						words,
						NodeFilter.SHOW_TEXT
					);
					const nodes = [];

					while ( walker.nextNode() ) {
						const node = walker.currentNode;

						if ( node.textContent.trim() && ! icon.contains( node ) ) {
							nodes.push( node );
						}
					}

					if ( ! nodes.length ) {
						return;
					}

					const range = document.createRange();
					range.setStart( nodes[ 0 ], 0 );
					range.setEnd(
						nodes[ nodes.length - 1 ],
						nodes[ nodes.length - 1 ].textContent.length
					);
					const rects = [ ...range.getClientRects() ].filter(
						( rect ) => rect.width > 0 && rect.height > 0
					);

					const iconBox = icon.getBoundingClientRect();

					if ( ! rects.length || iconBox.width <= 0 ) {
						return;
					}

					const font = Number.parseFloat(
						getComputedStyle( words ).fontSize
					);

					if ( ! Number.isFinite( font ) || font <= 0 ) {
						return;
					}

					// The title's lines, so the icon's middle can be compared with
					// the line or block the author anchored it to. Line rects of one
					// line share a top within a fraction of a pixel.
					const lines = [];

					rects.forEach( ( rect ) => {
						const line = lines.find(
							( item ) => Math.abs( item.top - rect.top ) <= 0.5
						);

						if ( line ) {
							line.bottom = Math.max( line.bottom, rect.bottom );
							line.left = Math.min( line.left, rect.left );
							line.right = Math.max( line.right, rect.right );
						} else {
							lines.push( {
								top: rect.top,
								bottom: rect.bottom,
								left: rect.left,
								right: rect.right,
							} );
						}
					} );

					lines.sort( ( a, b ) => a.top - b.top );

					const firstLine = lines[ 0 ];
					const lastLine = lines[ lines.length - 1 ];

					// A side icon is measured against the words of the line it is
					// anchored to, so that is the edge its nudge is counted from. A
					// wrapped title whose first line is not its widest otherwise
					// looks like a nudge of half the title's width.
					const anchorMode =
						entry.iconAnchor || data.iconAnchor || 'first_line';
					const anchoredLine =
						'last_line' === anchorMode
							? lastLine
							: 'block' === anchorMode
							? null
							: firstLine;
					const textEdge = anchoredLine
						? 'left' === side
							? anchoredLine.left
							: anchoredLine.right
						: 'left' === side
						? Math.min( ...rects.map( ( rect ) => rect.left ) )
						: Math.max( ...rects.map( ( rect ) => rect.right ) );
					const clearance =
						'left' === side
							? textEdge - iconBox.right
							: iconBox.left - textEdge;
					const textTop = firstLine.top;

					rows.push( {
						id,
						side,
						// A corner icon is placed against the top or bottom of the
						// text instead of its line's middle, so only a plain side has
						// the vertical rule this reads.
						plainSide: ! /icon--(top|bottom)/.test( classes ),
						// A card's icon is placed with the card's fit rule, which sits
						// it at the gap rather than half a box out.
						widget: Boolean(
							icon.closest( '[data-titlesparks-widget]' )
						),
						font,
						width: iconBox.width,
						// The stage's sizing answer, to work out how much the icon grew
						// from the 32px canvas and so how far its nudge may move.
						sizeMode: entry.sizeMode || 'fixed',
						sizingRules: Array.isArray( entry.sizingRules )
							? entry.sizingRules
							: null,
						authoredX: Number( entry.offsetX ) || 0,
						authoredY: Number( entry.offsetY ) || 0,
						// How far the icon's near edge sits from the text, in pixels.
						clearance,
						// This post's own answers, with the site's as the fallback for
						// a page written before they existed.
						spacing: entry.iconSpacing || 'gap',
						// Where the words' own edge is on the anchored line, and where
						// the page ends: a side icon whose free placement would cross
						// the page's edge is held at the edge instead. Both are read in
						// viewport pixels, as every other number here is.
						textEdge,
						boxLeft: iconBox.left,
						boxRight: iconBox.right,
						// `innerWidth`, which is what the placement's own off-page test
						// reads; `clientWidth` is a scrollbar narrower.
						pageWidth: window.innerWidth,
						// The middle of the icon, and the text box the vertical nudge
						// is counted from.
						middleY: iconBox.top + iconBox.height / 2,
						textTop,
						textHeight:
							Math.max( ...lines.map( ( line ) => line.bottom ) ) -
							textTop,
						firstLineHeight: firstLine.bottom - firstLine.top,
						lastLineTop: lastLine.top - textTop,
						lastLineHeight: lastLine.bottom - lastLine.top,
						anchor: entry.iconAnchor || data.iconAnchor,
					} );
				} );

			return rows;
		}, SLIDE_CONTAINERS );

		assert.ok(
			nudges.length,
			'No side icons were found to read a nudge from: point TITLESPARKS_TEST_POST_URL at a page that shows one.'
		);		nudges.forEach( ( row ) => {
			// The gap the plugin places with, and the nudge that is left once
			// it is taken out of the clearance. A post that asked for no space
			// leaves none, so its clearance is the nudge alone.
			const gap = 'flush' === row.spacing ? 0 : GAP_EM * row.font;
			// A fitted card icon and a flush one sit at the gap itself; every other
			// icon narrower than the anchor box is held half its narrowing further
			// out. The clearance is measured to the icon's near edge, so the shift
			// has to come out of it before the nudge can be read.
			const anchored =
				row.widget || 'flush' === row.spacing ? 0 : anchorShift( row.width );
			const applied =
				'left' === row.side
					? gap + anchored - row.clearance
					: row.clearance - gap - anchored;
			// The icon's own growth from the canvas, from the bands its stage
			// was drawn with. A title-following icon the bands held at one width
			// has stopped growing, and its nudge must stop with it; a fixed icon
			// has no bands and follows the title alone.
			const growth = iconGrowth( row );
			const scale = Math.min(
				OFFSET_SCALE_MAX,
				Math.min(
					row.font / OFFSET_REFERENCE_PX,
					null === growth ? Infinity : growth
				)
			);
			const expected = row.authoredX * scale;

			// The nudge is the author's own on every surface: a card's icon gets
			// the post's offsets exactly as the post's page does, so nothing is
			// held back for a clearance. Both numbers are in rendered pixels.
			const inwardSign = 'left' === row.side ? 1 : -1;
			const appliedInward = applied * inwardSign;

			// A phone can leave less gutter beside a title than the icon and its
			// gap need. The placement then holds the icon at the page's own edge
			// rather than pushing it to the title's, so the words keep the overlap
			// the post's page shows: it is moved back by the smallest amount that
			// puts it on the page, not by its whole distance from the title.
			//
			// That is read here as the same two questions in the same order — where
			// the nudge puts the icon, then whether the page's edge stops it — so a
			// held icon is checked against the edge instead of being measured as a
			// nudge error, and an icon that is *not* at the edge still has to carry
			// the author's number.
			const placedLeft =
				'left' === row.side
					? row.textEdge - gap - anchored - row.width + expected
					: row.textEdge + gap + anchored - expected;
			const edgeLeft = Math.min(
				Math.max( 0, placedLeft ),
				Math.max( 0, row.pageWidth - row.width )
			);
			const held = Math.abs( edgeLeft - placedLeft ) > 0.01;

			if ( held ) {
				assert.ok(
					Math.abs( row.boxLeft - edgeLeft ) <= NUDGE_TOLERANCE_PX,
					`${ row.id }: the icon's left edge is at ${ row.boxLeft.toFixed(
						2
					) }px, where the page's own edge holds it at ${ edgeLeft.toFixed(
						2
					) }px.`
				);
				console.log(
					`${ row.id }: held at the page's edge at ${ row.boxLeft.toFixed(
						2
					) }px — ${ row.font.toFixed( 1 ) }px title, ${ row.width.toFixed(
						1
					) }px icon, author's ${ row.authoredX }px`
				);

				return;
			}

			// A flush icon was chosen to touch the words, so it has to: the space
			// it removes is a space, and a whole one left in place is the bug —
			// the space a soft wrap leaves hanging at the end of a line measured
			// as part of the line, and pushed the icon 11px off its words.
			if ( 'flush' === row.spacing ) {
				assert.ok(
					Math.abs( row.clearance ) <= 2,
					`${ row.id }: a flush icon stands ${ row.clearance }px from the words it should touch`
				);
			}

			assert.ok(
				Math.abs( appliedInward - expected * inwardSign ) <=
					NUDGE_TOLERANCE_PX,
				`${ row.id }: the nudge is ${ applied.toFixed(
					2
				) }px beside a ${ row.font.toFixed(
					1
				) }px title, where the author's ${ row.authoredX }px at ${ scale.toFixed(
					2
				) }x is ${ expected.toFixed( 2 ) }px.`
			);

			// The vertical nudge is measured the same way, from the middle of the
			// line (or block) the icon is anchored to. `top` plus
			// `translateY(-50%)` puts the icon's middle on that number, so the
			// difference between the icon's middle and the anchor's middle is the
			// distance the author asked for.
			if ( row.plainSide ) {
				const anchor = [ 'first_line', 'last_line', 'block' ].includes(
					row.anchor
				)
					? row.anchor
					: 'first_line';
				let lineTop = 0;
				let anchorHeight = row.firstLineHeight;

				if ( 'block' === anchor ) {
					anchorHeight = row.textHeight;
				} else if ( 'last_line' === anchor ) {
					lineTop = row.lastLineTop;
					anchorHeight = row.lastLineHeight;
				}

				const appliedY =
					row.middleY - ( row.textTop + lineTop + anchorHeight / 2 );
				const expectedY = row.authoredY * scale;

				assert.ok(
					Math.abs( appliedY - expectedY ) <=
						NUDGE_TOLERANCE_PX,
					`${ row.id }: the vertical nudge is ${ appliedY.toFixed(
						2
					) }px beside a ${ row.font.toFixed(
						1
					) }px title anchored to ${ anchor }, where the author's ${
						row.authoredY
					}px at ${ scale.toFixed( 2 ) }x is ${ expectedY.toFixed(
						2
					) }px.`
				);

				console.log(
					`${ row.id }: ${ row.side } nudge ${ applied.toFixed(
						2
					) }px / ${ appliedY.toFixed( 2 ) }px at ${
						row.font
					 }px (authored ${ row.authoredX } / ${
						row.authoredY
					 } at ${ scale.toFixed( 2 ) }x${
						null !== growth && growth < row.font / OFFSET_REFERENCE_PX
							? ', held by the bands'
							: ''
					 }), gap ${ gap.toFixed( 2 ) }px`
				);
			}
		} );

		// What the run actually covered, so nothing is skipped in silence: a run
		// that measured three icons on a page that prints twenty looks like a
		// pass until this line says so. Everything counted here is a decision the
		// check made, and each one is named beside the icon that was passed over.
		const total = await page.evaluate(
			( slideContainers ) => {
				const all = [
					...document.querySelectorAll( '[data-titlesparks-icon]' ),
				];

				return {
					found: all.length,
					sliders: all.filter( ( icon ) =>
						icon.closest( slideContainers )
					).length,
					unrendered: all.filter(
						( icon ) => icon.getBoundingClientRect().width <= 0
					).length,
				};
			},
			SLIDE_CONTAINERS
		);

		console.log(
			`covered ${ icons.length } of ${ total.found } icon(s): ` +
				`${ nudges.length } nudge(s) read, ` +
				`${ movedCount } in a container that moves its titles, ` +
				`${ total.sliders } inside a slider, ` +
				`${ total.unrendered } not rendered`
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
	const failures = [];

	try {
		for ( const viewport of VIEWPORTS ) {
			for ( const url of POST_URLS ) {
				const label = `${ url } @ ${ viewport.width }x${ viewport.height }`;

				try {
					await checkPage( browser, url, viewport );
					console.log( `PASS ${ label }` );
				} catch ( error ) {
					// A page that fails is reported and the rest still run: a run
					// over a post and a listing should not stop at the post because
					// the listing is the one with a stale icon.
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
		`PASS ${ POST_URLS.length } page(s) at ${
			VIEWPORTS.length
		} window size(s): icons stable, nudges as authored`
	);
} )().catch( ( error ) => {
	console.error( error );
	process.exit( 1 );
} );
