/**
 * Finding the theme's title on the front end.
 *
 * This is the step that replaced writing the icon into the title from PHP. It
 * has to work on markup nobody chose: a post title is `<h1>Title</h1>` on one
 * theme, `<h2 class="post-title"><a>Title</a></h2>` on another, and the same
 * page also carries the site's own heading, a latest-posts list and often the
 * post's title a second time in a sidebar. The icon must land on the title a
 * reader sees, and nowhere else.
 *
 * The fixtures below are the real markup from the themes this was verified
 * against — including the bare `<h1>` and the `class="site--title"` header of
 * the news theme that exposed the original bug.
 */

import {
	ICON_ATTR,
	fitBoundary,
	iconPlacementForEntry,
	iconTitleHost,
	findTitleElement,
	findTitleElements,
	insertIcon,
	insertIcons,
	linksTo,
	normalizeTitle,
	normalizeUrl,
	scoreTitle,
} from '../frontendTitleDom';

const ENTRY = {
	id: 7,
	title: 'Breaking News Story',
	permalink: 'https://example.test/breaking-news-story/',
	url: 'https://example.test/hot-news.gif',
	size: '33px',
	position: 'right',
	offsetX: -12,
	offsetY: -26,
	alt: 'Hot news',
};

/**
 * Put a document body in place and hand it back.
 *
 * @param {string} html Body markup.
 * @return {Document} The document.
 */
const render = ( html ) => {
	document.body.innerHTML = html;

	return document;
};

afterEach( () => {
	document.body.innerHTML = '';
} );

describe( 'comparing titles and URLs', () => {
	it( 'folds the typography a theme adds', () => {
		// `wptexturize` turns plain quotes into curly ones, so the title in the
		// page is never byte-identical to the title in the data.
		expect(
			normalizeTitle( 'It\u2019s \u201cBreaking\u201d News\u2026' )
		).toBe( 'it\'s "breaking" news...' );
	} );

	it( 'folds whitespace and case', () => {
		expect( normalizeTitle( '  Breaking\n\tNews Story  ' ) ).toBe(
			'breaking news story'
		);
	} );

	it( 'compares URLs without a trailing slash, query or fragment', () => {
		expect(
			normalizeUrl( 'https://Example.test/Post/?utm_source=feed#top' )
		).toBe( 'https://example.test/post' );
	} );

	it( 'finds a link to the post however deep it sits', () => {
		const doc = render(
			'<h2 class="post-title"><a href="https://example.test/post/"><span>Breaking News Story</span></a></h2>'
		);

		expect(
			linksTo( doc.querySelector( 'h2' ), 'https://example.test/post' )
		).toBe( true );
		expect(
			linksTo( doc.querySelector( 'h2' ), 'https://example.test/other' )
		).toBe( false );
	} );
} );

describe( 'a single post', () => {
	it( 'picks the post title, not the site name', () => {
		// The news theme this was found on renders the site name as an `<h1>`
		// too, so "the first heading" is exactly the wrong rule.
		const doc = render(
			'<header class="site-header"><h1 class="site--title">FivePrayer</h1></header>' +
				'<main id="main"><article class="post"><h1>Breaking News Story</h1>' +
				'<div class="entry-content">Words.</div></article></main>'
		);

		expect( findTitleElement( ENTRY, doc ).textContent ).toBe(
			'Breaking News Story'
		);
	} );

	it( 'finds semantic theme title classes when a theme uses a custom title element', () => {
		const doc = render(
			'<main><article><div class="jeg_post_title" data-title="true">Breaking News Story</div></article></main>'
		);

		expect( findTitleElement( ENTRY, doc ) ).toBe(
			doc.querySelector( '.jeg_post_title' )
		);
		expect( insertIcons( [ ENTRY ], doc ) ).toHaveLength( 1 );
		expect(
			doc.querySelector( '.jeg_post_title [data-titlesparks-icon]' )
		).not.toBeNull();
	} );

	it( 'inserts the icon into the inner title element when a heading wraps it', () => {
		const doc = render(
			'<main><article><header><h2 class="entry-title"><span class="title-text" style="display:block">' +
				'Breaking News Story</span></h2></header></article></main>'
		);
		const entry = { ...ENTRY, singular: true };
		const title = findTitleElement( entry, doc );
		const inserted = insertIcons( [ entry ], doc );

		expect( title.tagName ).toBe( 'SPAN' );
		expect( title.className ).toBe( 'title-text' );
		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement ).toBe( title );
		expect( title.parentElement ).toBe(
			doc.querySelector( 'h2.entry-title' )
		);
	} );

	it.each( [
		{
			name: 'link',
			tag: 'a',
			href: ' href="https://example.test/breaking-news-story/"',
			expectedTag: 'A',
			parentTag: 'A',
		},
		{
			name: 'span',
			tag: 'span',
			href: '',
			expectedTag: 'SPAN',
			parentTag: 'SPAN',
		},
		{
			name: 'custom theme title',
			tag: 'news-title',
			href: '',
			expectedTag: 'NEWS-TITLE',
			parentTag: 'NEWS-TITLE',
		},
	] )( 'inserts inside an innermost $name title node', ( variant ) => {
		const doc = render(
			`<main><article><h6 class="post-title"><${ variant.tag }${ variant.href }>` +
				`Breaking News Story</${ variant.tag }></h6></article></main>`
		);
		const entry = {
			...ENTRY,
			singular: true,
			permalink: ENTRY.permalink,
		};
		const title = findTitleElement( entry, doc );
		const inserted = insertIcons( [ entry ], doc );

		expect( title.tagName ).toBe( variant.expectedTag );
		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement.tagName ).toBe( variant.parentTag );
		expect(
			doc.querySelector( 'h6.post-title > [data-titlesparks-icon]' )
		).toBeNull();
	} );

	it( 'inserts the repeated singular-title icon inside the link in an h5 card', () => {
		const doc = render(
			'<main><article><header class="entry-header"><h1 class="entry-title">Breaking News Story</h1></header></article>' +
				'<div class="post-carousel"><h5 class="post-title"><a href="https://example.test/breaking-news-story/" rel="bookmark">' +
				'Breaking News Story</a></h5></div></main>'
		);
		const entry = { ...ENTRY, singular: true };
		const titles = findTitleElements( entry, doc );
		const inserted = insertIcons( [ entry ], doc );

		expect( titles[ 0 ].tagName ).toBe( 'H1' );
		expect( titles[ 1 ].tagName ).toBe( 'A' );
		expect( titles[ 1 ].closest( '.post-carousel' ) ).not.toBeNull();
		expect( inserted ).toHaveLength( 2 );
		expect( inserted[ 0 ].parentElement.tagName ).toBe( 'H1' );
		expect( inserted[ 1 ].parentElement.tagName ).toBe( 'A' );
	} );

	it( 'decorates the article title rather than the "More posts" card repeating it', () => {
		// Twenty Twenty-Five's single template prints the article's title as an
		// `<h1 class="wp-block-post-title">`, then a query loop further down
		// prints the same post again as `<li><h3 class="wp-block-post-title">
		// <a>Title</a></h3></li>`. Both match by text and by class, so only the
		// list item tells them apart — and the reader's title is the `<h1>`.
		const doc = render(
			'<main><h1 class="wp-block-post-title">Breaking News Story</h1>' +
				'<div class="wp-block-group"><h2 class="wp-block-heading">More posts</h2>' +
				'<div class="wp-block-query"><ul class="wp-block-post-template">' +
				'<li class="wp-block-post post-7">' +
				'<h3 class="wp-block-post-title has-large-font-size">' +
				'<a href="https://example.test/breaking-news-story/">Breaking News Story</a>' +
				'</h3></li></ul></div></div></main>'
		);
		const entry = { ...ENTRY, singular: true, allowTitles: true };

		expect( findTitleElement( entry, doc ) ).toBe(
			doc.querySelector( 'h1.wp-block-post-title' )
		);

		insertIcons( [ entry ], doc );

		// The post's own icon belongs on the article's title. A card in the
		// list may carry the repeated occurrence, but it must never be the one
		// the entry's icon is spent on instead of the heading.
		expect(
			doc.querySelector( 'h1 [data-titlesparks-icon="7"]' )
		).not.toBeNull();
	} );

	it( 'still decorates a title when a listing is the only occurrence', () => {
		// The filter that prefers the article's own title must not leave a page
		// with nothing when its only title really is the one in a query loop.
		const doc = render(
			'<main><div class="wp-block-query"><ul class="wp-block-post-template">' +
				'<li class="wp-block-post"><h3 class="wp-block-post-title">' +
				'<a href="https://example.test/breaking-news-story/">Breaking News Story</a>' +
				'</h3></li></ul></div></main>'
		);
		const entry = { ...ENTRY, singular: true, allowTitles: true };

		expect( findTitleElement( entry, doc ) ).not.toBeNull();
		expect( insertIcons( [ entry ], doc ) ).toHaveLength( 1 );
	} );

	it( 'moves an existing sibling icon into the matching title link', () => {
		const doc = render(
			'<main><article><header><h5 class="post-title">' +
				'<a href="https://example.test/breaking-news-story/" rel="bookmark">' +
				'Breaking News Story</a><span class="titlesparks-icon" ' +
				'data-titlesparks-icon="7-title-2"></span></h5></header></article></main>'
		);
		const entry = { ...ENTRY, singular: true };
		const existingIcon = doc.querySelector( `[${ ICON_ATTR }]` );
		const inserted = insertIcons( [ entry ], doc );

		expect( inserted ).toHaveLength( 0 );
		expect( existingIcon.parentElement.tagName ).toBe( 'A' );
		expect(
			doc.querySelector( 'h5.post-title > [data-titlesparks-icon]' )
		).toBeNull();
		expect( insertIcons( [ entry ], doc ) ).toHaveLength( 0 );
	} );

	it( 'finds and decorates an unclassed title rendered with a custom tag', () => {
		const doc = render(
			'<main><article><header><news-heading style="display:block">' +
				'Breaking News Story</news-heading></header></article></main>'
		);
		const entry = { ...ENTRY, singular: true };
		const title = findTitleElement( entry, doc );
		const inserted = insertIcons( [ entry ], doc );

		expect( title.tagName ).toBe( 'NEWS-HEADING' );
		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement ).toBe( title );
		expect( title.querySelector( `[${ ICON_ATTR }]` ) ).toBe(
			inserted[ 0 ]
		);
	} );

	it( 'picks nothing rather than the wrong heading', () => {
		const doc = render(
			'<header class="site-header"><h1 class="site--title">FivePrayer</h1></header>' +
				'<main id="main"><p>No title here at all.</p></main>'
		);

		expect( findTitleElement( ENTRY, doc ) ).toBeNull();
	} );

	it( 'finds the MoreNews entry title inside its carousel-named header wrapper', () => {
		const doc = render(
			'<main><article><header class="entry-header pos-rel">' +
				'<div class="entry-header-details af-cat-widget-carousel">' +
				'<div class="figure-categories">Uncategorized</div>' +
				'<h1 class="entry-title">Breaking News Story</h1>' +
				'<div class="post-excerpt">A short excerpt.</div></div></header></article></main>'
		);
		const entry = { ...ENTRY, singular: true };
		const title = findTitleElement( entry, doc );
		const inserted = insertIcons( [ entry ], doc );

		expect( title ).toBe( doc.querySelector( 'h1.entry-title' ) );
		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement ).toBe( title );
	} );

	it( 'keeps a heading title link over matching links in a sidebar and carousel', () => {
		const doc = render(
			'<main><article><header class="entry-header"><h6 class="post-title">' +
				'<a href="https://example.test/breaking-news-story/" rel="bookmark">' +
				'Breaking News Story</a></h6></header></article></main>' +
				'<aside class="widget-area"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></aside>' +
				'<div class="post-carousel"><h4 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h4></div>'
		);
		const entry = { ...ENTRY, singular: true };
		const title = findTitleElement( entry, doc );

		expect( title.tagName ).toBe( 'A' );
		expect( title.closest( '.entry-header' ) ).not.toBeNull();
	} );

	it( 'keeps the article title and matches the same post in related and recent-post lists', () => {
		const doc = render(
			'<main id="main"><article class="post"><header class="entry-header">' +
				'<h1 class="entry-title">Breaking News Story</h1></header></article></main>' +
				'<aside class="widget-area"><ul class="wp-block-latest-posts__list"><li>' +
				'<a class="wp-block-latest-posts__post-title" href="https://example.test/breaking-news-story/">Breaking News Story</a>' +
				'</li></ul></aside>' +
				'<div class="post-carousel-missed"><div class="slick-slide" data-slick-index="0">' +
				'<h4 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h4>' +
				'</div></div>'
		);
		const entry = { ...ENTRY, singular: true };
		const articleTitle = findTitleElement( entry, doc );
		const matchedTitles = findTitleElements( entry, doc );
		const inserted = insertIcons( [ entry ], doc );

		expect( articleTitle.tagName ).toBe( 'H1' );
		expect( matchedTitles ).toHaveLength( 3 );
		expect( matchedTitles[ 0 ] ).toBe( articleTitle );
		expect(
			matchedTitles[ 1 ].closest( '.wp-block-latest-posts__post-title' )
		).not.toBeNull();
		expect(
			matchedTitles[ 2 ].closest( '.post-carousel-missed' )
		).not.toBeNull();
		// The same post, the same settings: every copy of the title on the page
		// carries the icon, not only the one beside the article's words.
		expect( inserted ).toHaveLength( 3 );
		expect(
			doc.querySelector(
				'.wp-block-latest-posts__post-title [data-titlesparks-icon]'
			)
		).not.toBeNull();
		expect(
			doc.querySelector( '.post-carousel-missed [data-titlesparks-icon]' )
		).not.toBeNull();
	} );

	it( 'is not fooled by the same title listed in a sidebar', () => {
		// The block editor's latest-posts block prints each post title as a
		// link to that post — including the post being viewed. It carries the
		// permalink, so nothing but "a heading beats a link" separates it from
		// the title a reader is looking at.
		const doc = render(
			'<main id="main"><article class="post"><h1>Breaking News Story</h1></article></main>' +
				'<aside class="widget-area"><ul class="wp-block-latest-posts__list"><li>' +
				'<a class="wp-block-latest-posts__post-title" href="https://example.test/breaking-news-story/">Breaking News Story</a>' +
				'</li></ul></aside>'
		);

		expect( findTitleElement( ENTRY, doc ).tagName ).toBe( 'H1' );
	} );

	it( 'accepts a heading that wraps the title in a screen-reader prefix', () => {
		const doc = render(
			'<main><h1><span class="screen-reader-text">Post: </span>Breaking News Story</h1></main>'
		);

		expect( findTitleElement( ENTRY, doc ) ).not.toBeNull();
	} );
} );

describe( 'every copy of a post\u2019s title on its own page', () => {
	// Measured on a page that prints one post in four places: the article's own
	// heading, a related-stories rail, a block-theme "More posts" query loop,
	// and a sidebar's latest-posts list. The reader sees the same title four
	// times, so the same icon belongs beside all four — this is the case that
	// shipped with the copy in the sidebar left bare.
	const PAGE =
		'<main id="main"><article class="post"><header class="entry-header">' +
		'<h1 class="entry-title">Breaking News Story</h1></header>' +
		'<div class="entry-content">Words.</div>' +
		'<section class="related-stories"><h2>You may also like</h2>' +
		'<div class="card"><div class="read-title">' +
		'<a href="https://example.test/breaking-news-story/">Breaking News Story</a>' +
		'</div></div></section>' +
		'<div class="wp-block-query"><ul class="wp-block-post-template"><li class="wp-block-post">' +
		'<h3 class="wp-block-post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h3>' +
		'</li></ul></div></article></main>' +
		'<aside class="widget-area"><h2>Latest posts</h2>' +
		'<ul class="wp-block-latest-posts__list"><li>' +
		'<a class="wp-block-latest-posts__post-title" href="https://example.test/breaking-news-story/">Breaking News Story</a>' +
		'</li></ul></aside>';

	it( 'decorates every visible copy, not only the article header', () => {
		const doc = render( PAGE );
		const entry = { ...ENTRY, singular: true, allowTitles: true };
		const titles = findTitleElements( entry, doc );
		const inserted = insertIcons( [ entry ], doc );

		expect( titles[ 0 ] ).toBe( doc.querySelector( 'h1.entry-title' ) );
		expect( inserted ).toHaveLength( 4 );
		expect(
			doc.querySelector( '.related-stories [data-titlesparks-icon]' )
		).not.toBeNull();
		expect(
			doc.querySelector( '.wp-block-post-title [data-titlesparks-icon]' )
		).not.toBeNull();
		expect(
			doc.querySelector(
				'.wp-block-latest-posts__post-title [data-titlesparks-icon]'
			)
		).not.toBeNull();
	} );

	it( 'gives each copy its own icon id and adds no second icon on a later pass', () => {
		const doc = render( PAGE );
		const entry = { ...ENTRY, singular: true, allowTitles: true };

		insertIcons( [ entry ], doc );

		const ids = [ ...doc.querySelectorAll( `[${ ICON_ATTR }]` ) ].map(
			( icon ) => icon.getAttribute( ICON_ATTR )
		);

		expect( ids ).toEqual( [ '7', '7-title-1', '7-title-2', '7-title-3' ] );
		expect( insertIcons( [ entry ], doc ) ).toHaveLength( 0 );
		expect( doc.querySelectorAll( `[${ ICON_ATTR }]` ) ).toHaveLength( 4 );
	} );

	it( 'stops decorating copies when the post page switch is off', () => {
		const doc = render( PAGE );

		expect(
			insertIcons(
				[ { ...ENTRY, singular: true, allowTitles: false } ],
				doc
			)
		).toHaveLength( 0 );
	} );

	it( 'leaves the places that talk about the post alone', () => {
		const doc = render(
			'<main id="main"><article class="post">' +
				'<h1 class="entry-title">Breaking News Story</h1>' +
				'<h2 class="comments-title">1 thought on \u201cBreaking News Story\u201d</h2>' +
				'<nav class="navigation pagination"><a href="https://example.test/page/2/">Breaking News Story</a></nav>' +
				'<p class="breadcrumb"><a href="https://example.test/">Home</a> / Breaking News Story</p>' +
				'<p>Breaking News Story is the headline of this article.</p>' +
				'</article></main>'
		);
		const inserted = insertIcons( [ { ...ENTRY, singular: true } ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement ).toBe(
			doc.querySelector( 'h1.entry-title' )
		);
	} );

	it( 'leaves a widget copy alone when the widget is switched off', () => {
		const doc = render(
			'<main><article><header class="entry-header">' +
				'<h1 class="entry-title">Breaking News Story</h1></header></article></main>' +
				'<aside data-titlesparks-widget="recent-posts-2" data-titlesparks-widget-enabled="0">' +
				'<a class="post-title" href="https://example.test/breaking-news-story/">Breaking News Story</a></aside>'
		);
		const inserted = insertIcons(
			[ { ...ENTRY, singular: true, marker: 'widget-7', widgetIds: [] } ],
			doc
		);

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement.tagName ).toBe( 'H1' );
		expect(
			doc.querySelector( 'aside [data-titlesparks-icon]' )
		).toBeNull();
	} );
} );

describe( 'a title the server hands out encoded', () => {
	// `wptexturize` writes a bare `&` out as `&#038;`, so a news title like
	// "Q&A: …" reaches this module encoded while the theme's page shows the
	// decoded `&`. It matched neither exactly nor by containment, which is what
	// "the icon is missing on this one post, on every theme" looks like.
	const ENCODED = {
		...ENTRY,
		title: 'Q&#038;A: Breaking News',
		singular: true,
	};

	it( 'folds an entity to the character the page shows', () => {
		expect( normalizeTitle( 'Q&#038;A' ) ).toBe( normalizeTitle( 'Q&A' ) );
		expect( normalizeTitle( 'A &amp; B' ) ).toBe(
			normalizeTitle( 'A & B' )
		);
		expect( normalizeTitle( '&amp;lt;' ) ).toBe( '&lt;' );
	} );

	it( 'finds and decorates the post page\u2019s own title', () => {
		const doc = render(
			'<main><article><header class="entry-header">' +
				'<h1 class="entry-title">Q&amp;A: Breaking News</h1></header></article></main>'
		);

		expect( findTitleElement( ENCODED, doc ) ).toBe(
			doc.querySelector( 'h1.entry-title' )
		);
		expect( insertIcons( [ ENCODED ], doc ) ).toHaveLength( 1 );
	} );

	it( 'matches a listing card whose link carries the encoded title', () => {
		const doc = render(
			'<main><article class="card"><h2 class="entry-title">' +
				'<a href="https://example.test/breaking-news-story/">Q&amp;A: Breaking News</a>' +
				'</h2></article></main>'
		);

		expect(
			insertIcons( [ { ...ENCODED, singular: false } ], doc )
		).toHaveLength( 1 );
	} );
} );

describe( 'a single post that prints its title more than once', () => {
	// The real page this was measured on: a bare `<h1>` in the theme's page
	// banner, the article's own `<h1 class="title">` in its post header, and a
	// related-posts carousel whose card carries the title *and* a link to the
	// post. Three matches for one post, and only one of them is the title a
	// reader is looking at.
	const PAGE =
		'<div id="page">' +
		'<section class="page-header"><h1>Breaking News Story</h1></section>' +
		'<div id="content" class="site-content">' +
		'<article class="post post-single"><div class="post-header"><p class="title">Breaking News Story</p></div></article>' +
		'<div class="post-carousel slick-slider"><div class="slick-list"><div class="slick-slide" data-slick-index="0">' +
		'<div class="details"><h4 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h4></div>' +
		'</div></div></div>' +
		'</div></div>';

	it( 'picks the article\u2019s own title', () => {
		const doc = render( PAGE );
		const title = findTitleElement( { ...ENTRY, singular: true }, doc );

		expect( title.tagName ).toBe( 'P' );
		expect( title.className ).toBe( 'title' );
		expect( title.closest( '.post-header' ) ).not.toBeNull();
	} );

	it( 'scores the carousel card below the article title', () => {
		const doc = render( PAGE );
		const score = ( selector ) =>
			scoreTitle( doc.querySelector( selector ), {
				...ENTRY,
				singular: true,
			} );

		expect( score( '.post-header .title' ) ).toBeGreaterThan(
			score( '.post-carousel h4' )
		);
		expect( score( '.post-header .title' ) ).toBeGreaterThan(
			score( '.page-header h1' )
		);
	} );

	it( 'still follows the permalink for an entry in a list', () => {
		// An archive entry is a card among identical cards, and the link is the
		// only thing that says which one. The article-title preference must not
		// reach this case.
		const doc = render( PAGE );
		const title = findTitleElement( { ...ENTRY, singular: false }, doc );

		expect( title.closest( '.post-carousel' ) ).not.toBeNull();
	} );
} );

describe( 'the markup that broke it on a real theme', () => {
	// Measured on MoreNews, rendering the plugin's own single post: the theme
	// wraps `header.entry-header` in `div.entry-header-details.af-cat-widget-
	// carousel`, and prints a comment heading that names the post. The icon was
	// drawn on the comment heading, because "carousel" in that wrapper's class
	// made the article's own title look like a listing card, which put it below
	// a heading whose text merely contained the title.
	const PAGE =
		'<main class="site-main"><article class="post type-post">' +
		'<div class="entry-content-wrap"><header class="entry-header" id="header">' +
		'<div class="entry-header-details af-cat-widget-carousel">' +
		'<h1 class="entry-title">Breaking News Story</h1></div></header>' +
		'<div class="entry-content">Words.</div></div>' +
		'<div class="comments-area"><h2 class="comments-title">1 thought on ' +
		'\u201cBreaking News Story\u201d</h2>' +
		'<h3 class="comment-reply-title">Leave a Reply ' +
		'<a href="https://example.test/breaking-news-story/">Cancel reply</a></h3>' +
		'</div></article></main>';

	it( 'picks the article\u2019s own title, not the comment heading', () => {
		const doc = render( PAGE );
		const title = findTitleElement( { ...ENTRY, singular: true }, doc );

		expect( title.tagName ).toBe( 'H1' );
		expect( title.className ).toBe( 'entry-title' );
	} );

	it( 'scores the comment heading out of the running entirely', () => {
		const doc = render( PAGE );
		const singular = { ...ENTRY, singular: true };

		// Both of them contain the title verbatim; only one of them is it.
		expect(
			scoreTitle( doc.querySelector( '.comments-title' ), singular )
		).toBe( -1 );
		expect(
			scoreTitle( doc.querySelector( '.comment-reply-title' ), singular )
		).toBe( -1 );
		expect(
			scoreTitle( doc.querySelector( '.entry-title' ), singular )
		).toBeGreaterThan( 0 );
	} );
} );

describe( 'previous and next navigation', () => {
	// The theme used on the affected post writes
	// `section.post-nav[role="navigation"]`, not `.post-navigation`, and wraps
	// the adjacent post's title and thumbnail in one link. The next post's flag
	// was inserted into that link and drawn beside the image, because the link's
	// text is exactly the title even though it also carries the thumbnail.
	const NAV =
		'<main><article><h1 class="entry-title">Breaking News Story</h1></article>' +
		'<section class="post-nav" role="navigation">' +
		'<h2 class="screen-reader-text">Post navigation</h2>' +
		'<div class="nav-next"><h6 class="nav-title">Next Post</h6>' +
		'<a href="https://example.test/next-story/"><div class="nav-content">' +
		'<img alt="Next Story"><span>Next Story</span></div></a></div></section></main>';

	// WordPress's own `the_post_navigation()` output, as the theme on the
	// reported post renders it: a `nav.navigation.post-navigation` holding an
	// `a[rel="prev"]`/`a[rel="next"]` whose title is an `h4 > span.post-title`
	// beside the thumbnail. `nav` reads as the site's menu and `.post-navigation`
	// read as pagination, so both adjacent titles were left bare.
	const POST_NAVIGATION =
		'<main><article><h1 class="entry-title">Breaking News Story</h1>' +
		'<nav class="navigation post-navigation" aria-label="Post navigation">' +
		'<div class="nav-links">' +
		'<div class="nav-previous"><a href="https://example.test/previous-story/" rel="prev">' +
		'<span class="meta-nav" aria-hidden="true">Previous</span> ' +
		'<span class="screen-reader-text">Previous post:</span> ' +
		'<span class="prev-post has-post-image"><h4><span class="post-title">Previous Story</span></h4>' +
		'<span class="post-image"><img width="150" height="150" alt="Previous thumbnail"></span></span>' +
		'</a></div>' +
		'<div class="nav-next"><a href="https://example.test/next-story/" rel="next">' +
		'<span class="meta-nav" aria-hidden="true">Next</span> ' +
		'<span class="screen-reader-text">Next post:</span> ' +
		'<span class="next-post has-post-image"><h4><span class="post-title">Next Story</span></h4>' +
		'<span class="post-image"><img width="150" height="150" alt="Next thumbnail"></span></span>' +
		'</a></div></div></nav></article></main>';

	// WordPress's own post-navigation *block*, as a block theme prints it — the
	// markup of the post this was reported on: the two links sit inside
	// `nav.wp-block-group`, and each title is a bare `<a rel="prev">`/`<a
	// rel="next">` beside the arrow span, with no heading and no title class to
	// identify it by. The same page repeats both titles in a query loop, where
	// every card's title *is* a heading.
	const BLOCK_POST_NAVIGATION =
		'<main class="wp-block-group has-global-padding is-layout-constrained">' +
		'<h1 class="wp-block-post-title">Breaking News Story</h1>' +
		'<nav class="wp-block-group alignwide is-content-justification-space-between is-layout-flex" aria-label="Posts">' +
		'<div class="post-navigation-link-previous wp-block-post-navigation-link">' +
		'<span class="wp-block-post-navigation-link__arrow-previous is-arrow-arrow" aria-hidden="true">\u2190</span>' +
		'<a href="https://example.test/previous-story/" rel="prev">Previous Story</a></div>' +
		'<div class="post-navigation-link-next wp-block-post-navigation-link">' +
		'<a href="https://example.test/next-story/" rel="next">Next Story</a>' +
		'<span class="wp-block-post-navigation-link__arrow-next is-arrow-arrow" aria-hidden="true">\u2192</span></div>' +
		'</nav>' +
		'<ul class="wp-block-post-template is-layout-flow">' +
		'<li class="wp-block-post post-9"><h3 class="wp-block-post-title has-large-font-size">' +
		'<a href="https://example.test/next-story/">Next Story</a></h3></li>' +
		'<li class="wp-block-post post-8"><h3 class="wp-block-post-title has-large-font-size">' +
		'<a href="https://example.test/previous-story/">Previous Story</a></h3></li>' +
		'</ul></main>';

	const adjacent = ( id, title, slug ) => ( {
		...ENTRY,
		id,
		title,
		permalink: `https://example.test/${ slug }/`,
		singular: false,
	} );

	it( 'decorates adjacent links that are plain links, beside a listing card', () => {
		// Both copies of each title are occurrences, so both carry an icon: the
		// nav link is inline and the card's title is a heading, and each is the
		// title of its post where the page prints it.
		const doc = render( BLOCK_POST_NAVIGATION );
		const inserted = insertIcons(
			[
				adjacent( 8, 'Previous Story', 'previous-story' ),
				adjacent( 9, 'Next Story', 'next-story' ),
			],
			doc
		);

		expect( inserted ).toHaveLength( 4 );
		expect(
			doc.querySelector( 'a[rel="prev"] [data-titlesparks-icon]' )
		).not.toBeNull();
		expect(
			doc.querySelector( 'a[rel="next"] [data-titlesparks-icon]' )
		).not.toBeNull();
		expect(
			doc.querySelectorAll(
				'.wp-block-post-template [data-titlesparks-icon]'
			)
		).toHaveLength( 2 );
	} );

	it( 'still leaves a paragraph that only quotes the title bare', () => {
		// The other half: the block preference exists so that a body element
		// that happens to hold the same words is not decorated. It is a block,
		// so adding a link's occurrence must not readmit it.
		const doc = render(
			BLOCK_POST_NAVIGATION.replace(
				'</ul>',
				'</ul><p>Previous Story</p><p>Next Story</p>'
			)
		);

		insertIcons(
			[
				adjacent( 8, 'Previous Story', 'previous-story' ),
				adjacent( 9, 'Next Story', 'next-story' ),
			],
			doc
		);

		expect( doc.querySelector( 'p [data-titlesparks-icon]' ) ).toBeNull();
		expect(
			doc.querySelectorAll( '[data-titlesparks-icon]' )
		).toHaveLength( 4 );
	} );

	it( 'decorates both adjacent titles of a WordPress post navigation', () => {
		const doc = render( POST_NAVIGATION );
		const previous = {
			...ENTRY,
			id: 8,
			title: 'Previous Story',
			permalink: 'https://example.test/previous-story/',
			singular: false,
		};
		const next = {
			...ENTRY,
			id: 9,
			title: 'Next Story',
			permalink: 'https://example.test/next-story/',
			singular: false,
		};
		const inserted = insertIcons( [ previous, next ], doc );

		expect( inserted ).toHaveLength( 2 );

		// Each icon stays inside the theme's own link, so it travels and clicks
		// with the words, and it is measured against the title span rather than
		// the link that also holds the thumbnail.
		[
			[ '.nav-previous', 'previous story' ],
			[ '.nav-next', 'next story' ],
		].forEach( ( [ selector, words ] ) => {
			const icon = doc.querySelector(
				`${ selector } [data-titlesparks-icon]`
			);

			expect( icon ).not.toBeNull();
			expect( icon.closest( 'a' ).getAttribute( 'rel' ) ).toBe(
				selector.includes( 'previous' ) ? 'prev' : 'next'
			);
			expect( normalizeTitle( iconTitleHost( icon ).textContent ) ).toBe(
				words
			);
		} );
		// The thumbnail is not the title, however close it sits.
		expect(
			doc.querySelectorAll( '.post-image [data-titlesparks-icon]' )
		).toHaveLength( 0 );
	} );

	it( 'sizes an adjacent title the way its own post is sized', () => {
		// The front end places each icon from the entry its id belongs to, and
		// that entry carries the stage's sizing mode and its band table. A nav
		// copy is therefore sized like every other copy of the same post, with
		// nothing nav-specific to keep in step: what makes it work is that the
		// icon keeps the post's plain id, and that the words it is measured
		// against are the title span rather than the link beside the thumbnail.
		const doc = render( POST_NAVIGATION );
		const previous = {
			...ENTRY,
			id: 8,
			title: 'Previous Story',
			permalink: 'https://example.test/previous-story/',
			position: 'left',
			offsetX: -4,
			offsetY: 2,
			sizeMode: 'advanced',
			sizingRules: [ { font: 16, icon: 44 } ],
			singular: false,
		};
		const [ icon ] = insertIcons( [ previous ], doc );

		expect( icon.getAttribute( ICON_ATTR ) ).toBe( '8' );
		expect( iconPlacementForEntry( '8', previous ) ).toEqual( {
			position: 'left',
			offset: { offsetX: -4, offsetY: 2 },
		} );
		expect( iconTitleHost( icon ).className ).toBe( 'post-title' );
	} );

	it( 'keeps the site menu and a pagination list bare', () => {
		// The other half of the rule: the same `nav` wrapper is refused when it
		// is the site's menu or a page-number list rather than adjacent posts.
		const doc = render(
			'<main><article><h1 class="entry-title">Breaking News Story</h1></article>' +
				'<nav class="main-navigation"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></nav>' +
				'<nav class="navigation pagination"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></nav>' +
				'</main>'
		);
		const inserted = insertIcons( [ { ...ENTRY, singular: true } ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect(
			doc.querySelector( 'h1.entry-title [data-titlesparks-icon]' )
		).not.toBeNull();
	} );

	it( 'draws the icon with the nav title, not beside its thumbnail', () => {
		const doc = render( NAV );
		const next = {
			...ENTRY,
			title: 'Next Story',
			permalink: 'https://example.test/next-story/',
			singular: false,
		};
		const [ icon ] = insertIcons( [ next ], doc );

		// The card's text span carries the thumbnail's styles too, and this
		// theme gives every span in it `padding-left`, which collapsed the
		// icon to zero width. The icon therefore sits beside the text box, in
		// the same link, and is measured against the title span.
		expect( icon.closest( '.nav-content' ) ).toBeNull();
		expect( icon.parentElement.tagName ).toBe( 'A' );
		expect( iconTitleHost( icon ).textContent.trim() ).toBe( 'Next Story' );
		expect( iconTitleHost( icon ).tagName ).toBe( 'SPAN' );
		// It is still inside the theme's link, so it travels with the title.
		expect( icon.closest( 'a' ).getAttribute( 'href' ) ).toBe(
			'https://example.test/next-story/'
		);
	} );
	// The theme on the affected post renders its next link without a thumbnail,
	// with the title inside a block-level box: `<a rel="next"><div
	// class="nav-content"><span>Title</span></div></a>`. Measuring the link
	// measured that box, which reports a rect as wide as the link, so a left
	// icon was drawn at the link's edge — a hundred pixels from the words — and
	// the space it belonged in was left empty.
	it( 'measures the words of a nav title that has no thumbnail', () => {
		const doc = render(
			'<main><article><h1>Breaking News Story</h1></article>' +
				'<section class="post-nav" role="navigation">' +
				'<div class="nav-next"><h6 class="nav-title">Next Post</h6>' +
				'<a href="https://example.test/next-story/" rel="next">' +
				'<div class="nav-content"><span>Next Story</span> </div>' +
				'</a></div></section></main>'
		);
		const next = {
			...ENTRY,
			title: 'Next Story',
			permalink: 'https://example.test/next-story/',
			position: 'left',
			singular: false,
		};
		const [ icon ] = insertIcons( [ next ], doc );

		// The link holds the icon, so the theme's rules for the title's own
		// span cannot resize it…
		expect( icon.parentElement.tagName ).toBe( 'A' );
		// …and the words inside the link are what the icon is placed beside,
		// not the link's own box.
		expect( iconTitleHost( icon ).tagName ).toBe( 'SPAN' );
		expect( normalizeTitle( iconTitleHost( icon ).textContent ) ).toBe(
			'next story'
		);
	} );

	it( 'keeps measuring the words after the thumbnail arrives', () => {
		// A theme that draws its thumbnail later must not turn the link into
		// the thing the icon is measured against: the words are the answer
		// whether or not the picture exists yet.
		const doc = render(
			'<main><article><h1>Breaking News Story</h1></article>' +
				'<section class="post-nav" role="navigation">' +
				'<div class="nav-next"><a href="https://example.test/next-story/" rel="next">' +
				'<div class="nav-content"><span>Next Story</span> </div>' +
				'</a></div></section></main>'
		);
		const next = {
			...ENTRY,
			title: 'Next Story',
			permalink: 'https://example.test/next-story/',
			position: 'left',
			singular: false,
		};
		const [ icon ] = insertIcons( [ next ], doc );
		const link = doc.querySelector( 'a[rel="next"]' );
		const picture = doc.createElement( 'img' );

		picture.setAttribute( 'alt', 'Next Story' );
		link.querySelector( '.nav-content' ).appendChild( picture );

		expect( icon.parentElement ).toBe( link );
		expect( iconTitleHost( icon ).tagName ).toBe( 'SPAN' );
	} );
} );

describe( 'an identification beats a guess', () => {
	// A breadcrumb trail, a comment heading and a heading a theme prefixed with
	// "Post:" all contain the title. The first two are not the title, so an
	// exact match anywhere has to outrank them anywhere.
	it( 'does not let a breadcrumb heading that contains the title win', () => {
		const doc = render(
			'<main><nav class="breadcrumbs"><h2>Home / Breaking News Story</h2></nav>' +
				'<article class="post"><h1>Breaking News Story</h1></article></main>'
		);
		const title = findTitleElement( { ...ENTRY, singular: false }, doc );

		expect( title.closest( 'nav' ) ).toBeNull();
		expect( title.closest( 'article' ) ).not.toBeNull();
	} );

	it( 'still accepts a heading the theme wrapped the title in', () => {
		// The other half of the rule: when nothing matches exactly, a heading
		// that contains the title is the best answer available, and a post with
		// a screen-reader prefix must keep its icon.
		const doc = render(
			'<main><article class="post"><h2 class="entry-title">' +
				'<span class="screen-reader-text">Post: </span>Breaking News Story</h2></article></main>'
		);

		expect(
			findTitleElement( { ...ENTRY, singular: true }, doc )
		).not.toBeNull();
	} );
} );

describe( 'a widget that names the post', () => {
	// Measured on a live news theme's blog archive: the only heading-shaped
	// mention of one post was a latest-comments link, which names the post *and*
	// links to it. Both signals this search uses, on a thing that is not a
	// title.
	it( 'does not decorate a latest-comments link', () => {
		const doc = render(
			'<main><article class="post"><h2 class="entry-title">' +
				'<a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2></article></main>' +
				'<aside class="widget"><ol class="wp-block-latest-comments"><li>' +
				'<article><footer><h3 class="wp-block-latest-comments__comment-meta">' +
				'<a class="wp-block-latest-comments__comment-link" href="https://example.test/breaking-news-story/#comment-1">Breaking News Story</a>' +
				'</h3></footer></article></li></ol></aside>'
		);
		const title = findTitleElement( { ...ENTRY, singular: false }, doc );

		expect( title.closest( '.wp-block-latest-comments' ) ).toBeNull();
		expect( title.closest( 'article' ) ).not.toBeNull();
	} );
} );

describe( 'a query loop', () => {
	const CARDS =
		'<main id="main">' +
		'<article class="post"><h2 class="post-title"><a href="https://example.test/one/" rel="bookmark">First Card</a></h2></article>' +
		'<article class="post"><h2 class="post-title"><a href="https://example.test/breaking-news-story/" rel="bookmark">Breaking News Story</a></h2></article>' +
		'<article class="post"><h2 class="post-title"><a href="https://example.test/three/" rel="bookmark">Third Card</a></h2></article>' +
		'</main>';

	it( 'picks the card whose permalink and title both match', () => {
		const doc = render( CARDS );
		const title = findTitleElement( ENTRY, doc );

		expect( title.textContent ).toBe( 'Breaking News Story' );
		expect( title.querySelector( 'a' ).getAttribute( 'href' ) ).toBe(
			'https://example.test/breaking-news-story/'
		);
	} );

	it( 'does not apply homepage section controls on a singular post page', () => {
		const doc = render(
			'<main><article><header class="entry-header"><h1 class="entry-title">Breaking News Story</h1></header></article>' +
				'<section class="post-carousel-mainfeatured"><h2 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2></section>' +
				'<section class="post-carousel-missed"><h2 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2></section></main>'
		);
		const entry = { ...ENTRY, singular: true };
		const inserted = insertIcons( [ entry ], doc );

		expect( inserted ).toHaveLength( 3 );
		expect(
			inserted[ 0 ].parentElement.classList.contains( 'entry-title' )
		).toBe( true );
		expect(
			doc.querySelectorAll(
				'.post-carousel-mainfeatured [data-titlesparks-icon], .post-carousel-missed [data-titlesparks-icon]'
			)
		).toHaveLength( 2 );
	} );

	it( 'honours a single-page section switch without gating the rest of the page', () => {
		// A post page now receives the sections its own templates hold, so a
		// switched-off rail is bare while every other copy of the title is
		// still decorated — the opposite of the old rule, where the homepage
		// list was ignored here and every copy was decorated.
		const doc = render(
			'<main><article><header class="entry-header"><h1 class="entry-title">Breaking News Story</h1></header></article>' +
				'<section class="ts-related-rail"><h2 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2></section>' +
				'<aside class="ts-latest-list"><h2 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2></aside></main>'
		);
		const entry = {
			...ENTRY,
			singular: true,
			sectionIds: [ 'page-class-ts-latest-list' ],
			sectionSelectors: {
				'page-class-ts-related-rail': [ '.ts-related-rail' ],
				'page-class-ts-latest-list': [ '.ts-latest-list' ],
			},
		};
		const inserted = insertIcons( [ entry ], doc );

		expect( inserted ).toHaveLength( 2 );
		expect(
			doc.querySelectorAll( '.entry-title [data-titlesparks-icon]' )
		).toHaveLength( 1 );
		expect(
			doc.querySelectorAll( '.ts-latest-list [data-titlesparks-icon]' )
		).toHaveLength( 1 );
		expect(
			doc.querySelectorAll( '.ts-related-rail [data-titlesparks-icon]' )
		).toHaveLength( 0 );
	} );

	it( 'finds every matching title in featured, list, and carousel sections', () => {
		const doc = render(
			'<section class="post-carousel-mainfeatured"><div class="post featured-post-lg"><div class="details"><h2 class="post-title">' +
				'<a href="https://example.test/breaking-news-story/">Breaking News Story</a>' +
				'</h2></div><a class="featured-image" href="https://example.test/breaking-news-story/"><img src="https://example.test/thumb.jpg" alt="Breaking News Story"></a></div></section><div class="post_columns-grid"><div class="post featured-post-lg"><h6 class="post-title">' +
				'<a href="https://example.test/breaking-news-story/">Breaking News Story</a>' +
				'</h6></div></div><main><article><h2 class="post-title">' +
				'<a href="https://example.test/breaking-news-story/">Breaking News Story</a>' +
				'</h2></article><article><h2 class="post-title">' +
				'<a href="https://example.test/breaking-news-story/">Breaking News Story</a>' +
				'</h2></article></main><aside class="wp-block-latest-comments">' +
				'<h3><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h3>' +
				'</aside>'
		);
		const entry = {
			...ENTRY,
			sectionIds: [ 'main-featured', 'featured-grid' ],
			sectionSelectors: {
				'main-featured': [ '.post-carousel-mainfeatured' ],
				'featured-grid': [ '.post_columns-grid' ],
			},
		};
		const titles = findTitleElements( entry, doc );
		const inserted = insertIcons( [ entry ], doc );

		expect( titles ).toHaveLength( 4 );
		expect( inserted ).toHaveLength( 4 );
		expect( doc.querySelectorAll( `[${ ICON_ATTR }]` ) ).toHaveLength( 4 );
		expect( titles.map( ( title ) => title.tagName ) ).toEqual( [
			'H2',
			'H6',
			'H2',
			'H2',
		] );
		expect( titles.map( ( title ) => title.textContent.trim() ) ).toEqual(
			Array( 4 ).fill( 'Breaking News Story' )
		);
		expect(
			doc.querySelectorAll(
				'.post-carousel-mainfeatured [data-titlesparks-icon]'
			)
		).toHaveLength( 1 );
		expect(
			doc.querySelectorAll( 'main [data-titlesparks-icon]' )
		).toHaveLength( 2 );
		expect(
			doc.querySelectorAll( `.wp-block-latest-comments [${ ICON_ATTR }]` )
		).toHaveLength( 0 );
	} );

	it( 'inserts only into selected theme homepage sections', () => {
		const doc = render(
			'<section class="post-carousel-mainfeatured"><h2 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2></section>' +
				'<section class="post_columns-grid"><h2 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2></section>' +
				'<section class="dt-posts-module"><h2 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2></section>'
		);
		const entry = {
			...ENTRY,
			sectionIds: [ 'theme-featured-grid' ],
			sectionSelectors: {
				'theme-main-featured': [ '.post-carousel-mainfeatured' ],
				'theme-featured-grid': [ '.post_columns-grid' ],
				'theme-latest-post': [ '.dt-posts-module' ],
			},
		};

		const inserted = insertIcons( [ entry ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect(
			doc.querySelectorAll(
				'.post-carousel-mainfeatured [data-titlesparks-icon]'
			)
		).toHaveLength( 0 );
		expect(
			doc.querySelectorAll( '.post_columns-grid [data-titlesparks-icon]' )
		).toHaveLength( 1 );
		expect(
			doc.querySelectorAll( '.dt-posts-module [data-titlesparks-icon]' )
		).toHaveLength( 0 );
	} );

	it( 'finds the theme ticker title inside site header content', () => {
		const doc = render(
			'<header class="site-header"><div class="widget dt-news-headline"><span class="dt_heading_inner">' +
				'<b class="is_on">Autem exercitationem quos possimus</b></span></div></header>'
		);
		const entry = {
			...ENTRY,
			title: 'Autem exercitationem quos possimus',
			permalink:
				'https://example.test/autem-exercitationem-quos-possimus/',
		};
		const inserted = insertIcons( [ entry ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement.tagName ).toBe( 'B' );
		expect(
			doc.querySelector(
				'.site-header .dt-news-headline [data-titlesparks-icon]'
			)
		).not.toBeNull();
	} );

	it( 'finds the theme ticker title rendered as an animated bold element', () => {
		const doc = render(
			'<div class="ticker"><a href="https://example.test/autem-exercitationem-quos-possimus/">' +
				'<span class="dt_heading_inner">' +
				'<b class="is_on"><i>A</i><i>u</i><i>t</i><i>e</i><i>m</i><i> </i>' +
				'<i>exercitationem quos possimus</i></b></span></a></div>'
		);
		const entry = {
			...ENTRY,
			title: 'Autem exercitationem quos possimus',
			permalink:
				'https://example.test/autem-exercitationem-quos-possimus/',
		};
		const inserted = insertIcons( [ entry ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement.tagName ).toBe( 'B' );
		expect(
			doc.querySelector( '.is_on [data-titlesparks-icon]' )
		).not.toBeNull();
	} );

	it( 'finds every matching title when a query-loop theme uses custom tags', () => {
		const doc = render(
			'<main><article><news-heading style="display:block"><a href="https://example.test/breaking-news-story/">' +
				'Breaking News Story</a></news-heading></article></main>'
		);
		const titles = findTitleElements( ENTRY, doc );
		const inserted = insertIcons( [ ENTRY ], doc );

		expect( titles ).toHaveLength( 1 );
		expect( titles[ 0 ].tagName ).toBe( 'NEWS-HEADING' );
		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement.tagName ).toBe( 'A' );
	} );

	it( 'finds linked featured titles even when themes do not use heading tags', () => {
		const doc = render(
			'<section class="featured-grid"><article><a class="feature-link" ' +
				'href="https://example.test/breaking-news-story/">' +
				'<span>Breaking News Story</span><span class="date">Oct 1</span></a>' +
				'</article></section>'
		);
		const title = findTitleElement( ENTRY, doc );
		const inserted = insertIcons( [ ENTRY ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( title.tagName ).toBe( 'SPAN' );
		expect( title.textContent ).toBe( 'Breaking News Story' );
		expect( title.querySelector( `[${ ICON_ATTR }]` ) ).not.toBeNull();
	} );

	it( 'scores a matching card above a heading for another post', () => {
		const doc = render( CARDS );
		const cards = [ ...doc.querySelectorAll( 'h2' ) ];

		expect( scoreTitle( cards[ 1 ], ENTRY ) ).toBeGreaterThan(
			scoreTitle( cards[ 0 ], ENTRY )
		);
	} );

	it( 'finds the post title inside a featured secondary-query section', () => {
		const doc = render(
			'<section class="featured-stories"><article>' +
				'<div class="thumb"><a href="https://example.test/breaking-news-story/"><img src="https://example.test/thumb.jpg" alt="Breaking News Story"></a></div>' +
				'<p class="entry-title"><a href="https://example.test/breaking-news-story/">' +
				'Breaking News Story</a></p></article></section>'
		);

		const inserted = insertIcons( [ ENTRY ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement.tagName ).toBe( 'A' );
		expect(
			inserted[ 0 ].parentElement.closest( '.entry-title' )
		).not.toBeNull();
	} );

	it( 'ignores a permalink link when it only contains the featured image', () => {
		const doc = render(
			'<section class="post-carousel-mainfeatured"><div class="post"><h2 class="post-title">Different Story</h2>' +
				'<a href="https://example.test/breaking-news-story/"><img src="https://example.test/thumb.jpg" alt="Breaking News Story"></a>' +
				'</div></section>'
		);

		expect( findTitleElement( ENTRY, doc ) ).toBeNull();
		expect( insertIcons( [ ENTRY ], doc ) ).toHaveLength( 0 );
	} );

	it( 'decorates a title in an inactive Slick slide in advance of navigation', () => {
		const doc = render(
			'<div class="post-carousel slick-slider">' +
				'<div class="slick-slide" data-slick-index="0" aria-hidden="false"><h2 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2></div>' +
				'<div class="slick-slide" data-slick-index="1" aria-hidden="true"><h2 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2></div>' +
				'</div>'
		);
		const inserted = insertIcons( [ ENTRY ], doc );

		expect( inserted ).toHaveLength( 2 );
		expect(
			doc.querySelector(
				'[data-slick-index="1"] [data-titlesparks-icon]'
			)
		).not.toBeNull();
	} );

	it( 'does not decorate a hidden non-carousel region', () => {
		const doc = render(
			'<div class="hidden-region" aria-hidden="true"><h2 class="post-title">' +
				'<a href="https://example.test/breaking-news-story/">Breaking News Story</a>' +
				'</h2></div>'
		);

		expect( insertIcons( [ ENTRY ], doc ) ).toHaveLength( 0 );
	} );

	it( 'decorates a cloned slide added after the original was decorated', () => {
		const doc = render(
			'<div class="post-carousel slick-slider"><div class="slick-slide" data-slick-index="0" aria-hidden="false"><h2 class="post-title">' +
				'<a href="https://example.test/breaking-news-story/">Breaking News Story</a>' +
				'</h2></div></div>'
		);

		const firstPass = insertIcons( [ ENTRY ], doc );
		const clone = doc.createElement( 'div' );
		clone.className = 'slick-slide slick-cloned';
		clone.dataset.slickIndex = '1';
		clone.setAttribute( 'aria-hidden', 'true' );
		clone.innerHTML =
			'<h2 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2>';
		doc.querySelector( '.post-carousel' ).appendChild( clone );
		const secondPass = insertIcons( [ ENTRY ], doc );

		expect( firstPass ).toHaveLength( 1 );
		expect( secondPass ).toHaveLength( 1 );
		expect( clone.querySelectorAll( `[${ ICON_ATTR }]` ) ).toHaveLength(
			1
		);
		expect( insertIcons( [ ENTRY ], doc ) ).toHaveLength( 0 );
	} );

	it( 'decorates every inactive Slick title so its icon is present when it becomes visible', () => {
		const doc = render(
			'<div class="post-carousel slick-slider">' +
				'<div class="slick-slide" data-slick-index="0" aria-hidden="false"><h2 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2></div>' +
				'<div class="slick-slide" data-slick-index="1" aria-hidden="true"><h2 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2></div>' +
				'</div>'
		);

		const inserted = insertIcons( [ ENTRY ], doc );

		expect( inserted ).toHaveLength( 2 );
		expect(
			doc.querySelectorAll( '.slick-slide [data-titlesparks-icon]' )
		).toHaveLength( 2 );

		const inactive = doc.querySelector( '[data-slick-index="1"]' );
		inactive.setAttribute( 'aria-hidden', 'false' );
		expect( inactive.querySelector( `[${ ICON_ATTR }]` ) ).not.toBeNull();
		expect( insertIcons( [ ENTRY ], doc ) ).toHaveLength( 0 );
	} );

	it( 'decorates separate Slick slides with separate icon IDs', () => {
		const doc = render(
			'<div class="post-carousel slick-slider">' +
				'<div class="slick-slide" data-slick-index="0"><h2 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2></div>' +
				'<div class="slick-slide" data-slick-index="1"><h2 class="post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2></div>' +
				'</div>'
		);
		const inserted = insertIcons( [ ENTRY ], doc );

		expect( inserted ).toHaveLength( 2 );
		expect(
			[ ...doc.querySelectorAll( `[${ ICON_ATTR }]` ) ].map( ( icon ) =>
				icon.getAttribute( ICON_ATTR )
			)
		).toEqual( [ '7-slide-0', '7-slide-1' ] );
	} );

	it( 'does not add a second regular-title icon for a repeated widget-only entry', () => {
		const doc = render(
			'<main><article><h1>Breaking News Story</h1></article>' +
				'<aside data-titlesparks-widget="recent-posts-2" data-titlesparks-widget-enabled="1" data-titlesparks-widget-position="right">' +
				'<a href="https://example.test/breaking-news-story/">' +
				'Breaking News Story</a></aside></main>'
		);
		const entry = {
			...ENTRY,
			marker: 'widget-7',
			widgetIds: [ 'recent-posts-2' ],
			widgetPositions: { 'recent-posts-2': 'right' },
		};

		const inserted = insertIcons( [ entry ], doc );

		expect( inserted ).toHaveLength( 2 );
		expect( inserted[ 0 ].getAttribute( ICON_ATTR ) ).toBe( '7' );
		expect( inserted[ 1 ].getAttribute( ICON_ATTR ) ).toBe(
			'widget-7-recent-posts-2'
		);
		expect( insertIcons( [ entry ], doc ) ).toHaveLength( 0 );
	} );

	it( 'honors a post-level widget opt-in when the site default is off', () => {
		const doc = render(
			'<aside data-titlesparks-widget="recent-posts-2" data-titlesparks-widget-enabled="0" data-titlesparks-widget-position="right"><a href="https://example.test/breaking-news-story/">' +
				'Breaking News Story</a></aside>'
		);
		const widgetEntry = {
			...ENTRY,
			marker: 'widget-7',
			widgetIds: [ 'recent-posts-2' ],
			widgetPositions: { 'recent-posts-2': 'right' },
		};

		const inserted = insertIcons( [ widgetEntry ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement.tagName ).toBe( 'A' );
	} );

	it( 'inserts a separate icon into a selected Recent Posts widget', () => {
		const doc = render(
			'<main><article><h1>Breaking News Story</h1></article>' +
				'<aside data-titlesparks-widget="recent-posts-2" data-titlesparks-widget-enabled="1" data-titlesparks-widget-position="right-top">' +
				'<ul><li><a href="https://example.test/breaking-news-story/">' +
				'<span class="post-title">Breaking News Story</span><time>Today</time></a></li></ul></aside></main>'
		);
		const widgetEntry = {
			...ENTRY,
			position: 'right-top',
			marker: 'widget-7',
			widgetIds: [ 'recent-posts-2' ],
			widgetPositions: { 'recent-posts-2': 'right' },
		};

		const inserted = insertIcons( [ widgetEntry ], doc );

		expect( inserted ).toHaveLength( 2 );
		expect( inserted[ 0 ].parentElement.tagName ).toBe( 'H1' );
		expect( inserted[ 1 ].parentElement.className ).toBe( 'post-title' );
		expect( inserted[ 1 ].getAttribute( ICON_ATTR ) ).toBe(
			'widget-7-recent-posts-2'
		);
		expect(
			iconPlacementForEntry(
				'widget-7-recent-posts-2',
				{
					...widgetEntry,
					position: 'right-top',
					offsetX: -28,
					offsetY: -18,
				},
				'right-top'
			)
		).toEqual( {
			position: 'right-top',
			offset: { offsetX: -28, offsetY: -18 },
		} );
		expect( inserted[ 1 ].style.width ).toBe( widgetEntry.size );
		expect( inserted[ 1 ].className ).toContain( '--right-top' );
	} );

	it( 'marks a horizontal icon found inside a widget as an inline icon', () => {
		const doc = render(
			'<aside data-titlesparks-widget="recent-1" data-titlesparks-widget-enabled="1" data-titlesparks-widget-position="right">' +
				'<a href="https://example.test/breaking-news-story/">Breaking News Story</a></aside>'
		);
		const entry = {
			...ENTRY,
			marker: 'widget-7',
			widgetIds: [ 'recent-1' ],
			widgetPositions: { 'recent-1': 'right' },
		};

		const inserted = insertIcons( [ entry ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].className ).toBe(
			'titlesparks-icon titlesparks-icon--right titlesparks-icon--inline'
		);
	} );

	it( 'skips hidden text in thumbnail links and decorates the visible card title', () => {
		const doc = render(
			'<aside data-titlesparks-widget="recent-posts-2" data-titlesparks-widget-enabled="1" data-titlesparks-widget-position="right">' +
				'<a class="thumbnail" href="https://example.test/breaking-news-story/" style="font-size:0"><span>Breaking News Story</span><img src="thumb.jpg" alt="Breaking News Story"></a>' +
				'<a class="post-title" href="https://example.test/breaking-news-story/"><span class="entry-title">Breaking News Story</span></a>' +
				'</aside>'
		);
		const entry = {
			...ENTRY,
			position: 'right-top',
			marker: 'widget-7',
			widgetIds: [ 'recent-posts-2' ],
			widgetPositions: { 'recent-posts-2': 'right' },
		};

		const inserted = insertIcons( [ entry ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect(
			doc.querySelector( '.thumbnail [data-titlesparks-icon]' )
		).toBeNull();
		expect(
			doc.querySelector( '.post-title [data-titlesparks-icon]' )
		).not.toBeNull();
		expect( inserted[ 0 ].className ).toContain( '--right' );
	} );

	it( 'uses the widget side and position-matched offsets instead of stage values', () => {
		const doc = render(
			'<aside data-titlesparks-widget="recent-posts-2" data-titlesparks-widget-enabled="1" data-titlesparks-widget-position="right"><a href="https://example.test/breaking-news-story/"><span class="post-title">Breaking News Story</span><time>Today</time></a></aside>'
		);
		const entry = {
			...ENTRY,
			position: 'right-top',
			marker: 'widget-7',
			widgetIds: [ 'recent-posts-2' ],
			widgetPositions: { 'recent-posts-2': 'right' },
			widgetOffsets: { 'recent-posts-2': { x: 7, y: -3 } },
		};
		const inserted = insertIcons( [ entry ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].className ).toContain( '--right' );
		expect(
			iconPlacementForEntry( 'widget-7-recent-posts-2', entry, 'right' )
		).toEqual( {
			position: 'right',
			offset: { offsetX: 7, offsetY: -3 },
		} );
		expect( inserted[ 0 ].style.width ).toBe( entry.size );
	} );

	it( 'uses the stage position only when a widget position is invalid', () => {
		const doc = render(
			'<aside data-titlesparks-widget="recent-posts-2" data-titlesparks-widget-enabled="1" data-titlesparks-widget-position="left"><a href="https://example.test/breaking-news-story/">' +
				'Breaking News Story</a></aside>'
		);
		const widgetEntry = {
			...ENTRY,
			position: 'right-top',
			marker: 'widget-7',
			widgetIds: [ 'recent-posts-2' ],
			widgetPositions: { 'recent-posts-2': 'left' },
			widgetOffsets: { 'recent-posts-2': { x: 2, y: 3 } },
		};

		const inserted = insertIcons( [ widgetEntry ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].className ).toContain( '--left' );
		expect(
			iconPlacementForEntry(
				'widget-7-recent-posts-2',
				widgetEntry,
				'left'
			)
		).toEqual( {
			position: 'left',
			offset: { offsetX: 2, offsetY: 3 },
		} );
	} );

	it( 'inherits the post title placement when a widget has no position of its own', () => {
		const doc = render(
			'<aside data-titlesparks-widget="recent-1" data-titlesparks-widget-enabled="1">' +
				'<a href="https://example.test/breaking-news-story/">Breaking News Story</a></aside>'
		);
		const entry = {
			...ENTRY,
			// No widgetPositions/widgetOffsets: the server leaves unset widget
			// positions out so they follow the post title.
			position: 'right-top',
			offsetX: -28,
			offsetY: -18,
			marker: 'widget-7',
			widgetIds: [ 'recent-1' ],
		};

		const inserted = insertIcons( [ entry ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].className ).toBe(
			'titlesparks-icon titlesparks-icon--right-top'
		);
		expect( iconPlacementForEntry( 'widget-7-recent-1', entry ) ).toEqual( {
			position: 'right-top',
			offset: { offsetX: -28, offsetY: -18 },
		} );
	} );

	it( 'leaves matching Recent Posts links alone when the per-post widget choice is off', () => {
		const doc = render(
			'<aside data-titlesparks-widget="recent-posts-2" data-titlesparks-widget-enabled="0" data-titlesparks-widget-position="right"><a href="https://example.test/breaking-news-story/">' +
				'Breaking News Story</a></aside>'
		);

		const inserted = insertIcons(
			[ { ...ENTRY, marker: 'widget-7', widgetIds: [] } ],
			doc
		);

		expect( inserted ).toHaveLength( 0 );
	} );
} );

describe( 'the markup page builders emit', () => {
	// Every card below is the shape the builder's own templates emit for one
	// post: Elementor's loop grid and its single-post template, Divi's blog
	// module and post-title module, and Bricks' query loop. The builder owns
	// the class names, so the finder may only rely on what they have in common
	// with a theme — the words, the permalink, and whether the node reads as a
	// title at all.
	const ELEMENTOR_CARD =
		'<main><div class="elementor-posts-container elementor-posts elementor-grid">' +
		'<article class="elementor-post elementor-grid-item post-7 post type-post status-publish hentry">' +
		'<a class="elementor-post__thumbnail__link" href="https://example.test/breaking-news-story/">' +
		'<div class="elementor-post__thumbnail"><img src="thumb.jpg" width="300" height="200"></div></a>' +
		'<div class="elementor-post__text">' +
		'<h3 class="elementor-post__title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h3>' +
		'<div class="elementor-post__excerpt"><p>An excerpt that is not the title.</p></div>' +
		'<a class="elementor-post__read-more" href="https://example.test/breaking-news-story/" aria-label="Read more about Breaking News Story">Read More \u00bb</a>' +
		'</div></article></div></main>';

	it( 'decorates an Elementor loop-grid card at its title, and nowhere else', () => {
		const doc = render( ELEMENTOR_CARD );
		const inserted = insertIcons( [ ENTRY ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement ).toBe(
			doc.querySelector( '.elementor-post__title > a' )
		);
		expect(
			doc.querySelector(
				'.elementor-post__thumbnail__link [data-titlesparks-icon]'
			)
		).toBeNull();
		expect(
			doc.querySelector(
				'.elementor-post__read-more [data-titlesparks-icon]'
			)
		).toBeNull();
	} );

	it( 'decorates an Elementor single-post template that has no article header', () => {
		// Elementor's Theme Builder template is divs all the way down: no
		// `<article>`, no `.entry-header`, and a title widget whose heading is
		// the only thing naming the post.
		const doc = render(
			'<div id="content" class="site-content"><div class="elementor elementor-42 elementor-location-single post-7 post type-post">' +
				'<div class="elementor-element elementor-widget-theme-post-title">' +
				'<div class="elementor-widget-container"><h1 class="elementor-heading-title elementor-size-default">Breaking News Story</h1></div>' +
				'</div>' +
				'<div class="elementor-element elementor-widget-theme-post-content">' +
				'<div class="elementor-widget-container"><p>Words.</p></div></div>' +
				'</div></div>'
		);
		const entry = { ...ENTRY, singular: true };

		expect( findTitleElement( entry, doc ).tagName ).toBe( 'H1' );
		expect( insertIcons( [ entry ], doc ) ).toHaveLength( 1 );
	} );

	it( 'decorates a Divi blog-module card at its title', () => {
		const doc = render(
			'<main><div id="main-content"><article id="post-7" class="et_pb_post post-7 post type-post status-publish">' +
				'<a class="entry-featured-image-url" href="https://example.test/breaking-news-story/">' +
				'<img src="thumb.jpg" alt="Breaking News Story"></a>' +
				'<h2 class="entry-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2>' +
				'<p class="post-meta"><span class="published">Oct 27, 2026</span></p>' +
				'<div class="post-content"><p>An excerpt.</p></div>' +
				'</article></div></main>'
		);
		const inserted = insertIcons( [ ENTRY ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement ).toBe(
			doc.querySelector( 'h2.entry-title > a' )
		);
		expect(
			doc.querySelector(
				'.entry-featured-image-url [data-titlesparks-icon]'
			)
		).toBeNull();
	} );

	it( 'decorates a Divi post-title module on the post\u2019s own page', () => {
		const doc = render(
			'<div id="main-content"><article id="post-7" class="et_pb_post">' +
				'<div class="et_pb_module et_pb_post_title et_pb_text_align_left">' +
				'<div class="et_pb_title_container"><h1 class="entry-title">Breaking News Story</h1></div>' +
				'</div>' +
				'<div class="et_pb_module et_pb_post_content"><p>Words.</p></div>' +
				'</article></div>'
		);

		expect(
			insertIcons( [ { ...ENTRY, singular: true } ], doc )
		).toHaveLength( 1 );
	} );

	it( 'decorates a Bricks query-loop card at its title', () => {
		const doc = render(
			'<main><div class="brxe-query-loop"><article class="brxe-post-loop post-7 post type-post">' +
				'<div class="brxe-block brxe-post-loop-item">' +
				'<a class="brxe-image" href="https://example.test/breaking-news-story/"><img src="thumb.jpg"></a>' +
				'<h2 class="brxe-post-title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h2>' +
				'<p class="brxe-text-basic">An excerpt.</p>' +
				'</div></article></div></main>'
		);
		const inserted = insertIcons( [ ENTRY ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement ).toBe(
			doc.querySelector( '.brxe-post-title > a' )
		);
	} );

	it( 'finds a builder\u2019s own text element used as the title, with no title class', () => {
		// A page builder can bind dynamic post data to a plain text element:
		// no heading, no class that says "title". The words are all the finder
		// has, and the tag is not a layout container, so it still qualifies.
		const doc = render(
			'<main><div class="brxe-query-loop"><article class="brxe-post-loop post-7 post type-post">' +
				'<div class="brxe-block">' +
				'<a class="brxe-image" href="https://example.test/breaking-news-story/"><img src="thumb.jpg"></a>' +
				'<div class="brxe-text-basic">Breaking News Story</div>' +
				'<div class="brxe-text-basic">An excerpt.</div>' +
				'</div></article></div></main>'
		);
		const inserted = insertIcons( [ ENTRY ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement.className ).toBe(
			'brxe-text-basic'
		);
		expect( inserted[ 0 ].parentElement.textContent ).toBe(
			'Breaking News Story'
		);
	} );

	it( 'puts the icon in a whole-card link and measures it against the title', () => {
		// Elementor's loop item can wrap picture and title in one link. The link
		// is where the icon belongs — it stays clickable — but the words inside
		// are what it is placed beside.
		const doc = render(
			'<main><div class="e-loop-item e-loop-item-7 post-7 post type-post">' +
				'<a class="e-loop-item__link" href="https://example.test/breaking-news-story/">' +
				'<img class="e-loop-item__image" src="thumb.jpg">' +
				'<div class="e-loop-item__title">Breaking News Story</div></a>' +
				'</div></main>'
		);
		const inserted = insertIcons( [ ENTRY ], doc );

		expect( inserted ).toHaveLength( 1 );
		expect( inserted[ 0 ].parentElement ).toBe(
			doc.querySelector( '.e-loop-item__link' )
		);
		expect( iconTitleHost( inserted[ 0 ] ) ).toBe(
			doc.querySelector( '.e-loop-item__title' )
		);
	} );

	it( 'decorates every builder card for a different post on a listing', () => {
		const other = {
			...ENTRY,
			id: 8,
			title: 'Second Headline',
			permalink: 'https://example.test/second-headline/',
		};
		const doc = render(
			'<main><div class="elementor-posts-container">' +
				'<article class="elementor-post"><div class="elementor-post__text">' +
				'<h3 class="elementor-post__title"><a href="https://example.test/breaking-news-story/">Breaking News Story</a></h3>' +
				'</div></article>' +
				'<article class="elementor-post"><div class="elementor-post__text">' +
				'<h3 class="elementor-post__title"><a href="https://example.test/second-headline/">Second Headline</a></h3>' +
				'</div></article></div></main>'
		);
		const inserted = insertIcons( [ ENTRY, other ], doc );

		expect( inserted ).toHaveLength( 2 );
		expect(
			inserted.map( ( icon ) => icon.getAttribute( ICON_ATTR ) )
		).toEqual( [ '7', '8' ] );
		expect(
			doc.querySelectorAll(
				'.elementor-post__title [data-titlesparks-icon]'
			)
		).toHaveLength( 2 );
	} );
} );

describe( 'inserting the icon', () => {
	it( 'puts it after the text for a right-hand position', () => {
		const doc = render( '<h1>Breaking News Story</h1>' );
		const title = doc.querySelector( 'h1' );
		const icon = insertIcon( doc, title, ENTRY );

		expect( icon.parentElement ).toBe( title );
		expect( icon.className ).toBe(
			'titlesparks-icon titlesparks-icon--right'
		);
		expect( title.lastElementChild ).toBe( icon );
		expect( icon.getAttribute( ICON_ATTR ) ).toBe( '7' );
	} );

	it.each( [ 'left', 'left-top', 'left-bottom', 'top' ] )(
		'puts the icon before the text for a %s position',
		( position ) => {
			const doc = render( '<h1>Breaking News Story</h1>' );
			const title = doc.querySelector( 'h1' );
			const icon = insertIcon( doc, title, { ...ENTRY, position } );

			expect( title.firstElementChild ).toBe( icon );
		}
	);

	it( 'keeps the state in the alt text', () => {
		const doc = render( '<h1>Breaking News Story</h1>' );
		const icon = insertIcon( doc, doc.querySelector( 'h1' ), ENTRY );

		expect( icon.querySelector( 'img' ).alt ).toBe( 'Hot news' );
		expect( icon.hasAttribute( 'aria-hidden' ) ).toBe( false );
	} );

	it( 'leaves the icon box to the theme', () => {
		const doc = render( '<h1>Breaking News Story</h1>' );
		const icon = insertIcon( doc, doc.querySelector( 'h1' ), ENTRY );

		// No forced box: the stylesheet sizes the image and the project places
		// the icon, but the site remains free to restyle everything else.
		expect( icon.getAttribute( 'style' ) ).not.toMatch( /important/i );

		[
			'display',
			'line-height',
			'margin',
			'padding',
			'border',
			'box-sizing',
			'max-width',
			'background',
			'box-shadow',
		].forEach( ( property ) => {
			expect( icon.style.getPropertyValue( property ) ).toBe( '' );
		} );
	} );

	it( 'mirrors the icon when the stage asks it to', () => {
		const doc = render( '<h1>Breaking News Story</h1>' );
		const plain = insertIcon( doc, doc.querySelector( 'h1' ), ENTRY );
		const flipped = insertIcon( doc, doc.querySelector( 'h1' ), {
			...ENTRY,
			flip: true,
		} );

		// The page carries the class; the stylesheet does the mirroring, so the
		// icon element's own placement transform is never overwritten.
		expect( plain.classList.contains( 'titlesparks-icon--flipped' ) ).toBe(
			false
		);
		expect(
			flipped.classList.contains( 'titlesparks-icon--flipped' )
		).toBe( true );

		// The class survives the position and size classes beside it.
		expect( flipped.classList.contains( 'titlesparks-icon' ) ).toBe( true );
		expect(
			flipped.classList.contains(
				`titlesparks-icon--${ ENTRY.position }`
			)
		).toBe( true );
	} );

	it( 'leaves the image box to the theme', () => {
		const doc = render( '<h1>Breaking News Story</h1>' );
		const icon = insertIcon( doc, doc.querySelector( 'h1' ), ENTRY );
		const image = icon.querySelector( 'img' );

		expect( image.getAttribute( 'style' ) ).toBeNull();
		expect( image.className ).toBe( 'titlesparks-icon__img' );
	} );

	it( 'keeps the chosen size an ordinary declaration', () => {
		// Locking the size would take away the one thing a site may reasonably
		// restyle: the plugin sets it, but a site's own CSS can still change it.
		const doc = render( '<h1>Breaking News Story</h1>' );
		const icon = insertIcon( doc, doc.querySelector( 'h1' ), ENTRY );

		expect( icon.style.width ).toBe( '33px' );
		expect( icon.style.getPropertyPriority( 'width' ) ).toBe( '' );
	} );

	it( 'keeps the size on the icon and lets the stylesheet size the image', () => {
		const doc = render( '<h1>Breaking News Story</h1>' );
		const icon = insertIcon( doc, doc.querySelector( 'h1' ), {
			...ENTRY,
			size: '24%',
		} );

		// Repeating `24%` on the image would resolve against the icon's own
		// width — 24% of 24%, a sliver in an oversized box. The stylesheet's
		// `width: 100%` lets the icon's width decide it instead.
		expect( icon.style.width ).toBe( '24%' );
		expect(
			icon.querySelector( 'img' ).getAttribute( 'style' )
		).toBeNull();
	} );

	it( 'puts the icon in the heading even when a theme makes it inline', () => {
		const doc = render(
			'<div class="entry-header"><h1 style="display:inline">Breaking News Story</h1></div>'
		);
		const heading = doc.querySelector( 'h1' );
		const icon = insertIcon( doc, heading, { ...ENTRY, position: 'left' } );

		// The heading is what the front end measures and positions against, in
		// every theme — an inline one included. Taking the icon out of flow is
		// the placement pass's job, so insertion itself forces nothing.
		expect( icon.parentElement ).toBe( heading );
		expect( heading.firstChild ).toBe( icon );
		expect( icon.style.position ).toBe( '' );
	} );

	it( 'puts the icon in the heading, not the box around it', () => {
		// The rule every offset rests on: the icon is measured against the
		// heading itself. A theme's own wrapper holds whatever it likes — a
		// category line, a byline, an empty column — and an offset worked out
		// from that box would land somewhere else entirely.
		const doc = render(
			'<div class="entry-header"><span class="cat">News</span>' +
				'<h1 style="display:inline-block">Breaking News Story</h1>' +
				'<p class="byline">By the editor</p></div>'
		);
		const heading = doc.querySelector( 'h1' );
		const icon = insertIcon( doc, heading, {
			...ENTRY,
			position: 'right',
		} );

		expect( icon.parentElement ).toBe( heading );
		expect( heading.lastChild ).toBe( icon );
	} );

	it( 'leaves positioning to the placement pass', () => {
		// The preview markup the REST controller renders wears the same class
		// but sits in flow, so `position` cannot come from the class.
		const doc = render( '<h1>Breaking News Story</h1>' );
		const icon = insertIcon( doc, doc.querySelector( 'h1' ), ENTRY );

		expect( icon.style.position ).toBe( '' );
	} );
} );

describe( 'decorating a page', () => {
	it( 'inserts one icon per post, however often the page changes', () => {
		const doc = render( '<main><h1>Breaking News Story</h1></main>' );
		expect( insertIcons( [ ENTRY ], doc ) ).toHaveLength( 1 );

		expect( insertIcons( [ ENTRY ], doc ) ).toHaveLength( 0 );
		expect( doc.querySelectorAll( `[${ ICON_ATTR }]` ) ).toHaveLength( 1 );
	} );

	it( 'decorates the post it can find and leaves the rest alone', () => {
		const doc = render(
			'<main><h1>Breaking News Story</h1><h1>Another Post</h1></main>'
		);
		const other = {
			...ENTRY,
			id: 8,
			title: 'Missing Post',
			permalink: 'https://example.test/missing/',
		};

		insertIcons( [ ENTRY, other ], doc );

		expect( doc.querySelectorAll( `[${ ICON_ATTR }]` ) ).toHaveLength( 1 );
		expect(
			doc.querySelector( `[${ ICON_ATTR }]` ).getAttribute( ICON_ATTR )
		).toBe( '7' );
	} );

	it( 'ignores an entry with nothing to draw', () => {
		const doc = render( '<main><h1>Breaking News Story</h1></main>' );

		expect( insertIcons( [ { ...ENTRY, url: '' } ], doc ) ).toHaveLength(
			0
		);
		expect( insertIcons( undefined, doc ) ).toHaveLength( 0 );
	} );
} );

describe( 'the box a widget icon is kept in', () => {
	/**
	 * Place an icon inside a title in the given markup.
	 *
	 * @param {string} html Page markup around a `.post-title` link.
	 * @return {{icon: Element, title: Element}} The icon and its title.
	 */
	const scene = ( html ) => {
		const doc = render( html );
		const title = doc.querySelector( '.post-title' );
		const icon = doc.createElement( 'span' );
		title.appendChild( icon );

		return { icon, title };
	};

	it( 'uses the padded widget, not the unpadded list item, when the widget clips', () => {
		const { icon } = scene(
			'<div class="widget" style="padding: 30px; overflow: hidden">' +
				'<ul><li><a class="post-title">Breaking News</a></li></ul></div>'
		);

		// The nearest card is the list item, which has no padding. The widget
		// around it clips at its outer edge and owns 30px of padding, so that
		// is the box the icon may use — and the title is not indented.
		expect( fitBoundary( icon ) ).toBe(
			document.querySelector( '.widget' )
		);
	} );

	it( 'uses the nearest padded column when nothing clips', () => {
		const { icon } = scene(
			'<div class="col" style="padding: 0 12px">' +
				'<ul><li><a class="post-title">Breaking News</a></li></ul></div>'
		);

		expect( fitBoundary( icon ) ).toBe( document.querySelector( '.col' ) );
	} );

	it( 'falls back to the list item when nothing between it and the page owns space', () => {
		const { icon } = scene(
			'<ul><li><a class="post-title">Breaking News</a></li></ul>'
		);

		expect( fitBoundary( icon ) ).toBe( document.querySelector( 'li' ) );
	} );
} );

describe( 'a card the page decorates more than once', () => {
	/**
	 * The archive card this came from: a heading whose link is the only node
	 * with the title's exact text, beside the card's thumbnail.
	 *
	 * @return {string} Markup for one card.
	 */
	const card = () =>
		'<article class="bloghash-article post type-post has-post-thumbnail">' +
		'<div class="bloghash-blog-entry-wrapper bloghash-thumb-left">' +
		'<div class="post-thumb entry-media thumbnail">' +
		`<a class="entry-image-link" href="${ ENTRY.permalink }">` +
		`<img src="https://example.test/thumb.jpg" alt="${ ENTRY.title }"></a></div>` +
		'<div class="bloghash-entry-content-wrapper">' +
		'<header class="entry-header"><h4 class="entry-title" itemprop="headline">' +
		`<a href="${ ENTRY.permalink }" rel="bookmark">${ ENTRY.title }</a>` +
		'</h4></header></div></div></article>';

	it( 'keeps its icon where it was, pass after pass', () => {
		// Counting the plugin's own icon as the card's media made two answers
		// alternate: the heading while the icon was in the link, the link while
		// it was in the heading. The icon then moved between the two on every
		// pass — measured on a real archive, a pixel away from the last place,
		// for as long as the page was open.
		const doc = render( card() );

		insertIcons( [ ENTRY ], doc );

		const icon = doc.querySelector( `[${ ICON_ATTR }]` );
		const parent = icon.parentElement;
		const html = doc.body.innerHTML;

		// Two passes are enough for a flip; the page really is decorated again
		// whenever a font, an image or the reader moves it.
		insertIcons( [ ENTRY ], doc );
		insertIcons( [ ENTRY ], doc );

		expect( icon.parentElement ).toBe( parent );
		expect( doc.body.innerHTML ).toBe( html );
		expect( doc.querySelectorAll( `[${ ICON_ATTR }]` ) ).toHaveLength( 1 );
	} );
} );
