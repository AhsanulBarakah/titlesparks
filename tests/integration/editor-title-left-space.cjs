/*
 * The post title in the block editor must never show leftover left space.
 *
 * The canvas icon is drawn *over* the page, out of flow, beside the title's
 * words: it is absolutely positioned in WordPress' title wrapper, which only
 * becomes a positioning context. So the title is not supposed to move at all —
 * no padding or margin reserved for the icon on the heading or its wrapper, no
 * spacer inside the heading, no indent left behind when the icon is drawn in
 * space the page already had.
 *
 * A stylesheet build cannot answer that. `blocks/shared/__tests__/` pins what
 * the editor's placement writes (`iconOffset.test.js`, `tightFit.test.js`), but
 * only a real browser lays out the constrained, centred title and says whether
 * the words actually start at the heading's edge. This check opens the editor
 * and measures it, watching out for the two ways a title does get indented:
 *
 * - the words start inside the heading's own box (padding, a `text-indent`, or
 *   a spacer element in front of them);
 * - the plugin's own footprint — the icon, the wrapper class, the injected
 *   stylesheet — changes the heading's box at all. It is removed for one
 *   measurement and put back, in the same task so nothing can re-run in
 *   between, because an out-of-flow icon cannot move the words it is drawn
 *   beside.
 *
 * The second measurement also runs at a second canvas width: the title is
 * centred inside a constrained layout, so a size that looks right at 1280px is
 * exactly where a reserved padding would go unnoticed. More widths can be
 * named, `WIDTHxHEIGHT` and separated by commas or whitespace, which is how CI
 * checks the phone width too:
 *
 *   TITLESPARKS_TEST_VIEWPORTS="390x844" \
 *   TITLESPARKS_TEST_EDITOR_URL=... node tests/integration/editor-title-left-space.cjs
 *
 * Authentication: pass a Playwright storage state, or a user and password.
 *
 *   TITLESPARKS_TEST_EDITOR_URL=http://localhost:10010/wp-admin/post.php?post=275&action=edit \
 *   TITLESPARKS_TEST_USER=admin TITLESPARKS_TEST_PASSWORD=secret \
 *   node tests/integration/editor-title-left-space.cjs
 *
 * or save a session once and reuse it:
 *
 *   TITLESPARKS_TEST_STORAGE_STATE=./playwright-state.json \
 *   TITLESPARKS_TEST_EDITOR_URL=... node tests/integration/editor-title-left-space.cjs
 *
 * Nothing is saved: the editor is measured and closed.
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
const STORAGE_STATE = process.env.TITLESPARKS_TEST_STORAGE_STATE;
const USER = process.env.TITLESPARKS_TEST_USER;
const PASSWORD = process.env.TITLESPARKS_TEST_PASSWORD;

/*
 * The selectors the plugin itself uses, so the check measures the same nodes
 * the placement does.
 */
const IDS = {
	title: '.editor-post-title__input',
	icon: '[data-titlesparks-editor-icon]',
	hostClass: 'titlesparks-title-icon-host',
	styleId: 'titlesparks-editor-title-css',
	canvas: 'iframe[name="editor-canvas"]',
};

/*
 * The editor's default canvas, and the narrow one it collapses to.
 *
 * `TITLESPARKS_TEST_VIEWPORTS` replaces the list, one `WIDTHxHEIGHT` per window
 * separated by commas or whitespace, so the same check can be run at a phone
 * width without editing it.
 */
const parseViewports = ( value ) =>
	String( value || '' )
		.split( /[\s,]+/ )
		.filter( Boolean )
		.map( ( entry ) => {
			const match = /^(\d+)x(\d+)$/i.exec( entry );

			assert.ok(
				match,
				`TITLESPARKS_TEST_VIEWPORTS entry "${ entry }" is not WIDTHxHEIGHT.`
			);

			return { width: Number( match[ 1 ] ), height: Number( match[ 2 ] ) };
		} );

const requestedViewports = parseViewports(
	process.env.TITLESPARKS_TEST_VIEWPORTS
);
const VIEWPORTS = requestedViewports.length
	? requestedViewports
	: [
			{ width: 1280, height: 1000 },
			{ width: 900, height: 1000 },
	  ];

/* A sub-pixel layout difference is still a measurement difference. */
const TOLERANCE_PX = 0.5;

/*
 * How far the words may sit inside the heading before it counts as an indent.
 * A glyph's own left side bearing is a pixel or so; a reserved space is not.
 */
const INDENT_TOLERANCE_PX = 1.5;

/**
 * Measure the title, once as it is and once with the plugin's footprint
 * removed.
 *
 * Runs in the canvas document, so `document` is the one holding the title
 * whether WordPress iframes the canvas or not.
 *
 * @param {Object} ids Selectors, passed in because an evaluated function
 *                     cannot reach this file's constants.
 * @return {Object} The three measurements and what was found.
 */
const measureTitleSpace = ( ids ) => {
	const title = document.querySelector( ids.title );

	if ( ! title ) {
		return { missing: 'title' };
	}

	// The wrapper the plugin places against: the heading's parent, which also
	// holds the icon once there is one.
	const wrapper = title.parentElement;
	const icon = document.querySelector( ids.icon );
	const style = document.getElementById( ids.styleId );

	/**
	 * Left, right and width of a node in viewport pixels.
	 *
	 * @param {Element|null} node Node to measure.
	 * @return {Object|null} Box, or null.
	 */
	const box = ( node ) => {
		if ( ! node ) {
			return null;
		}

		const rect = node.getBoundingClientRect();

		return { left: rect.left, right: rect.right, width: rect.width };
	};

	/**
	 * Where the title's words actually start and end.
	 *
	 * The first and last characters, not the heading's box: a constrained title
	 * is wider than a short headline, so only the glyphs say where the words
	 * are. Whitespace typed in front of the title is skipped for the same
	 * reason it is skipped by the placement.
	 *
	 * @param {Element} node Heading to read.
	 * @return {Object|null} Word edges, or null for an empty title.
	 */
	const words = ( node ) => {
		const walker = document.createTreeWalker( node, NodeFilter.SHOW_TEXT );
		let text = walker.nextNode();

		while ( text && ! text.nodeValue.trim() ) {
			text = walker.nextNode();
		}

		if ( ! text ) {
			return null;
		}

		const first = text.nodeValue.search( /\S/ );
		const last = text.nodeValue.search( /\S\s*$/ );
		const range = document.createRange();

		range.setStart( text, first );
		range.setEnd( text, last + 1 );

		const rect = range.getBoundingClientRect();

		return { left: rect.left, right: rect.right };
	};

	/**
	 * The space a node keeps to the left of its own text.
	 *
	 * @param {Element|null} node Node to read.
	 * @return {Object|null} The numbers, in pixels.
	 */
	const leftSpace = ( node ) => {
		if ( ! node ) {
			return null;
		}

		const computed = getComputedStyle( node );

		return {
			paddingLeft: parseFloat( computed.paddingLeft ) || 0,
			marginLeft: parseFloat( computed.marginLeft ) || 0,
			borderLeftWidth: parseFloat( computed.borderLeftWidth ) || 0,
			textIndent: parseFloat( computed.textIndent ) || 0,
		};
	};

	/**
	 * Everything the check looks at, in one pass.
	 *
	 * @return {Object} Measurements for this state of the page.
	 */
	const snapshot = () => {
		const titleBox = box( title );
		const wordsBox = words( title );
		const titleSpace = leftSpace( title );

		return {
			title: titleBox,
			wrapper: box( wrapper ),
			words: wordsBox,
			// How far the words sit from the heading's own left edge. A title
			// that reserved room for its icon shows it here, whatever wrote it.
			indent:
				wordsBox && titleBox
					? wordsBox.left - titleBox.left - titleSpace.borderLeftWidth
					: null,
			titleSpace,
			wrapperSpace: leftSpace( wrapper ),
			fontSize: parseFloat( getComputedStyle( title ).fontSize ) || 0,
		};
	};

	const withIcon = {
		...snapshot(),
		hostClass: Boolean( wrapper && wrapper.classList.contains( ids.hostClass ) ),
	};

	// Read the icon's own style now, while it is still in the document: a
	// computed style belongs to a laid-out element, and this one is about to be
	// taken out for the measurement below.
	const iconStyle = icon
		? {
				position: getComputedStyle( icon ).position,
				float: getComputedStyle( icon ).float,
		  }
		: null;

	// Take the plugin's footprint out for one measurement, then put it back
	// exactly as it was — all in this task, so no animation frame, observer or
	// resize handler can run in between and none of this reaches the post.
	const parent = icon && icon.parentNode;
	const next = icon && icon.nextSibling;

	if ( icon ) {
		icon.remove();
	}

	if ( withIcon.hostClass ) {
		wrapper.classList.remove( ids.hostClass );
	}

	if ( style ) {
		style.remove();
	}

	const withoutIcon = snapshot();

	if ( style ) {
		( style.ownerDocument.head ||
			style.ownerDocument.documentElement ).appendChild( style );
	}

	if ( withIcon.hostClass ) {
		wrapper.classList.add( ids.hostClass );
	}

	if ( icon ) {
		parent.insertBefore( icon, next );
	}

	const restored = snapshot();

	return {
		icon: icon
			? {
					id: icon.getAttribute( ids.icon ),
					position: iconStyle.position,
					float: iconStyle.float,
					parentIsWrapper: icon.parentElement === wrapper,
					insideTitle: title.contains( icon ),
					besideTitle:
						icon.previousElementSibling === title ||
						icon.nextElementSibling === title,
					parent: icon.parentElement
						? `${ icon.parentElement.tagName }.${
								icon.parentElement.className
						  }`
						: 'none',
			  }
			: null,
		css: style ? style.textContent : null,
		withIcon,
		withoutIcon,
		restored,
	};
};

/**
 * Assert that one measurement pass found no leftover left space.
 *
 * @param {Object} canvas What `measureTitleSpace` returned.
 * @param {string} label  Which pass this is, for the failure message.
 * @return {void}
 */
const judge = ( canvas, label ) => {
	assert.ok(
		! canvas.missing,
		`${ label }: the editor has no post title to measure — it may still be rendering.`
	);

	const { icon, css, withIcon, withoutIcon, restored } = canvas;

	assert.ok(
		icon,
		`${ label }: no canvas icon was found. Point TITLESPARKS_TEST_EDITOR_URL at a post whose icon is showing.`
	);
	assert.ok(
		withIcon.words,
		`${ label }: the post title is empty, so there are no words to measure.`
	);

	// The icon is the plugin's footprint, and it must be a sibling of the
	// heading rather than one of its children: anything inside the heading is
	// written into the saved title the next time the author types.
	assert.equal(
		icon.insideTitle,
		false,
		`${ label }: the icon was found inside the contenteditable heading, where typing would save it as title text.`
	);
	assert.ok(
		icon.parentIsWrapper,
		`${ label }: the icon's parent is ${ icon.parent }, not the title wrapper it is placed against.`
	);
	assert.ok(
		icon.besideTitle,
		`${ label }: the icon should sit before or after the heading inside the wrapper.`
	);
	assert.equal(
		icon.position,
		'absolute',
		`${ label }: the icon is position: ${ icon.position }, so it takes space in the title's line.`
	);
	assert.equal(
		icon.float,
		'none',
		`${ label }: a floated icon reserves room beside the words.`
	);
	assert.ok(
		withIcon.hostClass,
		`${ label }: the wrapper does not carry "${ IDS.hostClass }", the positioning context the icon needs.`
	);

	// The words start at the heading's own edge. An indent here is room that
	// was reserved for an icon which is drawn out of flow anyway. The theme
	// sets the title's alignment, so it is not measured: a title aligned to
	// the right is the theme's arrangement, not leftover space beside it.
	assert.ok(
		withIcon.indent <= INDENT_TOLERANCE_PX,
		`${ label }: the title's words start ${ withIcon.indent.toFixed(
			2
		) }px inside the heading at ${ withIcon.fontSize }px — space reserved beside words whose icon is drawn absolutely.`
	);

	// Removing the icon, its wrapper class and the injected stylesheet changes
	// nothing. That is the whole claim: the plugin is drawn over the page, not
	// laid out in it.
	const unmoved = ( before, after, what ) =>
		assert.ok(
			Math.abs( after - before ) <= TOLERANCE_PX,
			`${ label }: ${ what } moved ${ ( after - before ).toFixed(
				2
			) }px when the plugin's icon was taken out of the page.`
		);

	for ( const side of [ 'left', 'right' ] ) {
		unmoved( withIcon.title[ side ], withoutIcon.title[ side ], `the heading's ${ side } edge` );
		unmoved( withIcon.words[ side ], withoutIcon.words[ side ], `the words' ${ side } edge` );

		if ( withIcon.wrapper && withoutIcon.wrapper ) {
			unmoved(
				withIcon.wrapper[ side ],
				withoutIcon.wrapper[ side ],
				`the wrapper's ${ side } edge`
			);
		}
	}

	for ( const key of [ 'paddingLeft', 'marginLeft', 'borderLeftWidth', 'textIndent' ] ) {
		assert.equal(
			withIcon.titleSpace[ key ],
			withoutIcon.titleSpace[ key ],
			`${ label }: the heading's ${ key } is the plugin's doing, not the editor's.`
		);
	}

	if ( withIcon.wrapperSpace && withoutIcon.wrapperSpace ) {
		assert.equal(
			withIcon.wrapperSpace.paddingLeft,
			withoutIcon.wrapperSpace.paddingLeft,
			`${ label }: the wrapper's padding-left is the plugin's doing, not the editor's.`
		);
	}

	// Measuring must leave no trace: the page is put back exactly as found.
	for ( const side of [ 'left', 'right' ] ) {
		unmoved(
			withIcon.title[ side ],
			restored.title[ side ],
			`the heading's ${ side } edge, after the measurement was put back`
		);
	}

	// And the plugin's own stylesheet never reserves space beside the title:
	// only the wrapper's positioning context and the image's box belong there.
	assert.ok( css, `${ label }: the injected editor stylesheet is missing.` );
	assert.ok(
		! /(?:^|[;{])\s*(?:padding|margin|float|text-indent)(?:-[a-z-]+)?\s*:/i.test( css ),
		`${ label }: the editor stylesheet reserves space beside the title:\n${ css }`
	);

	console.log(
		`PASS ${ label }: words at ${ withIcon.words.left.toFixed(
			2
		) }px, indent ${ withIcon.indent.toFixed( 2 ) }px, ${ withIcon.fontSize }px title, icon ${ icon.position }`
	);
};

( async () => {
	assert.ok(
		EDITOR_URL,
		'Set TITLESPARKS_TEST_EDITOR_URL to the post editor URL to check.'
	);
	assert.ok(
		STORAGE_STATE || ( USER && PASSWORD ),
		'Set TITLESPARKS_TEST_STORAGE_STATE, or TITLESPARKS_TEST_USER and TITLESPARKS_TEST_PASSWORD.'
	);

	const browser = await chromium.launch( {
		executablePath: CHROME || undefined,
		headless: true,
	} );
	const context = await browser.newContext(
		STORAGE_STATE
			? { viewport: VIEWPORTS[ 0 ], storageState: STORAGE_STATE }
			: { viewport: VIEWPORTS[ 0 ] }
	);
	const page = await context.newPage();

	try {
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

		// The editor renders the title asynchronously, into an iframe on modern
		// WordPress and into the admin document on older setups.
		await page.waitForFunction(
			( ids ) => {
				const iframe = document.querySelector( ids.canvas );
				const doc = ( iframe && iframe.contentDocument ) || document;

				return Boolean( doc.querySelector( ids.title ) );
			},
			IDS,
			{ timeout: 60000, polling: 250 }
		);

		const iframeHandle = await page.$( IDS.canvas );
		const canvas = iframeHandle
			? await iframeHandle.contentFrame()
			: page.mainFrame();

		assert.ok( canvas, 'The editor canvas could not be read.' );

		await canvas.waitForSelector( IDS.icon, { timeout: 15000 } ).catch(
			() => null
		);
		assert.ok(
			await canvas.$( IDS.icon ),
			`No canvas icon appeared in ${ EDITOR_URL }: point TITLESPARKS_TEST_EDITOR_URL at a post that shows one, on a site where the plugin is active.`
		);

		// Fonts decide where the glyphs start, so measure after they load.
		await canvas.evaluate( () =>
			document.fonts ? document.fonts.ready : null
		);
		await page.waitForTimeout( 500 );

		for ( let index = 0; index < VIEWPORTS.length; index++ ) {
			const viewport = VIEWPORTS[ index ];

			if ( 0 !== index ) {
				await page.setViewportSize( viewport );
				// Let the plugin re-place the icon for the new canvas width.
				await page.waitForTimeout( 800 );
			}

			// A resize can rebuild the canvas, and the icon is inserted again
			// after it, so wait for the icon before measuring rather than assume
			// it survived.
			await canvas.waitForSelector( IDS.icon, { timeout: 10000 } ).catch(
				() => null
			);

			judge(
				await canvas.evaluate( measureTitleSpace, IDS ),
				`${ viewport.width }px canvas`
			);
		}
	} finally {
		await browser.close();
	}
} )().catch( ( error ) => {
	console.error( error );
	process.exit( 1 );
} );
