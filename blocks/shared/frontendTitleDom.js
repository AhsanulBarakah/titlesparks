/**
 * Finding the theme's own title element on the front end, and putting the icon
 * in it.
 *
 * The plugin used to write the icon into the title with PHP, by filtering
 * `the_title`. That filter does not mean "the visible title": it fires wherever
 * the title is *read* — and a theme reads it in places where markup is not
 * allowed. Three examples from the themes a site really runs, all confirmed
 * against rendered pages:
 *
 *   1. `alt="<?php echo esc_attr( the_title() ); ?>"` — a very common template
 *      line. The title is echoed inside an attribute, so the icon markup was
 *      echoed into it: the theme's featured image lost its alt text, gained the
 *      icon's `style="width:33px"` (so it rendered 33px wide instead of 60),
 *      and the rest of the icon was parsed as stray attributes.
 *
 *   2. Secondary loops — a "Latest Posts" block or a related-posts widget calls
 *      `the_title()` for other posts while the main loop is still open, and
 *      `in_the_loop()` is true there. The icon was drawn beside a listing item
 *      instead of the post's own title, and the post's real title was then left
 *      undecorated.
 *
 *   3. Breadcrumbs, share links, `<title>`, Open Graph tags and JSON-LD all read
 *      the title too. Any of them can come first in a given theme, which is why
 *      the same settings looked different on every theme.
 *
 * So PHP no longer writes anything into the title. It resolves *what* should be
 * shown and hands that to this script, which finds the title in the finished
 * page and inserts the icon there — the same thing the editor does in its
 * canvas. Nothing a theme renders can be broken any more, because nothing is
 * injected into the title string.
 *
 * Finding the title is the whole job of this module, so it is written to be
 * verifiable: every rule below is a pure function of the element and the entry,
 * and `frontendTitleDom.test.js` runs it against the markup these themes
 * actually emit.
 */

import { buildIcon, iconComesFirst } from './editorTitleDom';

/**
 * Marks an icon this script inserted, and records which post it belongs to, so
 * a second pass can never produce a second icon.
 */
export const ICON_ATTR = 'data-titlesparks-icon';

/** Attribute identifying a marked widget wrapper. */
export const WIDGET_ATTR = 'data-titlesparks-widget';

/**
 * Elements that can act as a card around a widget title.
 *
 * Used only when nothing between the title and the page actually owns the
 * space: a list item, a post card, a slide.
 */
export const CARD = 'li, article, .slick-slide, .read-single, .card, .post';

/**
 * Whether an element holds a picture of its own.
 *
 * The plugin's icon is a picture too, and counting it as the title's media made
 * the answer depend on where the icon already was: with the icon inside a
 * card's link, both the link and the heading around it "held media", so the
 * next pass picked the heading, moved the icon back under the link, and the one
 * after that picked the link again. On a real archive that was an icon flipping
 * between two parents for as long as the page stayed open, a pixel away from
 * where it started on every pass. A picture inside `[data-titlesparks-icon]` is
 * never the title's own.
 *
 * @param {Element} node Element to inspect.
 * @return {boolean} True when it holds media that is not the plugin's icon.
 */
const holdsMedia = ( node ) => {
	if ( ! node || ! node.querySelectorAll ) {
		return false;
	}

	if ( node.matches( 'img, picture, video, svg' ) ) {
		return true;
	}

	return [ ...node.querySelectorAll( 'img, picture, video, svg' ) ].some(
		( media ) => ! media.closest( `[${ ICON_ATTR }]` )
	);
};

/**
 * The box a widget icon has to stay inside, chosen from the page itself.
 *
 * The nearest list item is often narrower than the card around it: a recent
 * posts item has no padding, while the widget that holds it has 30px and clips
 * at its outer edge. Treating the list item as the card made placement reserve
 * that missing room on the title, which indented the title's text by 30px and
 * pushed its icon inwards. The card the reader sees, and the box that actually
 * cuts the icon off, is the nearest ancestor with a clipping overflow or with
 * its own horizontal padding. The icon is allowed to use that padding, exactly
 * as a post's own icon uses the space beside its title.
 *
 * Pure with respect to the page: it reads ancestors and returns one, and is
 * checked by `frontendTitleDom.test.js` against the shapes real themes emit.
 *
 * @param {Element} icon   Icon element.
 * @param {Element} widget Marked widget wrapper, the last resort.
 * @return {Element} Element to measure the icon against.
 */
export const fitBoundary = ( icon, widget ) => {
	const doc = icon.ownerDocument;
	const view = doc.defaultView;
	let node = icon.parentElement && icon.parentElement.parentElement;
	let padded = null;
	let depth = 0;

	while ( node && node !== doc.body && depth < 12 && view ) {
		const style = view.getComputedStyle( node );
		const overflow = `${ style.overflowX } ${ style.overflowY }`;

		if ( /(hidden|clip|scroll|auto)/.test( overflow ) ) {
			return node;
		}

		const left = Number.parseFloat( style.paddingLeft ) || 0;
		const right = Number.parseFloat( style.paddingRight ) || 0;

		if ( ! padded && ( left > 0 || right > 0 ) ) {
			padded = node;
		}

		node = node.parentElement;
		depth++;
	}

	return padded || icon.closest( CARD ) || widget;
};

/**
 * Class carrying the icon's place, as the stylesheet expects it.
 */
const ICON_CLASS = 'titlesparks-icon';

/**
 * Classes that name a title, matched as whole tokens.
 *
 * Tokens, not substrings: `wp-block-latest-posts__post-title` is a link inside
 * a listing, and a substring test would treat it as the post's own title — the
 * one mistake that would put the icon next to the wrong text on a page that has
 * both.
 */
const TITLE_CLASSES = [
	'entry-title',
	'post-title',
	'page-title',
	'article-title',
	'headline',
	'wp-block-post-title',
	'jeg_post_title',
	'td-post-title',
	'post_title',
	'post__title',
	'entry_title',
	'article__title',
	'elementor-heading-title',
	'entry__title',
	'fusion-post-title',
	'fl-heading-text',
	'et_pb_title',
	'fusion-title-heading',
	'wp-block-query-title',
];

/**
 * Classes naming a title vary by theme, so recognize title-like class tokens in
 * addition to the common exact names above.
 *
 * @param {Element} element Candidate node.
 * @return {boolean} Whether one of the node's classes describes a title.
 */
const hasTitleClass = ( element ) =>
	[ ...element.classList ].some( ( name ) => /title|headline/i.test( name ) );

/**
 * Classes or attributes which positively identify a theme's title text.
 */
const WIDGET_TITLE_SELECTOR = [
	...TITLE_CLASSES.map( ( name ) => `.${ name }` ),
	'[data-title]',
	'[itemprop="headline"]',
	'[role="heading"]',
	'[class*="title"]',
	'[class*="headline"]',
].join( ',' );

const TITLE_CLASS_PATTERN = /title|headline/i;

const validWidgetPosition = ( value ) =>
	[
		'left',
		'right',
		'top',
		'bottom',
		'left-top',
		'left-bottom',
		'right-top',
		'right-bottom',
	].includes( value );

/**
 * Find the text element for a matching post link in a widget.
 *
 * Inspect every descendant rather than relying on one theme's title class.
 * The permalink identifies the post; exact text identifies its title inside a
 * link that may also contain a date, excerpt, or thumbnail.
 *
 * @param {Element} link   Widget link to a post.
 * @param {string}  wanted Normalized post title.
 * @return {Element|null} Title node or null when the link has no title text.
 */
const widgetTitle = ( link, wanted ) => {
	const candidates = [ ...link.querySelectorAll( '*' ), link ].filter(
		( candidate ) => {
			if (
				normalizeTitle( candidate.textContent ) !== wanted ||
				holdsMedia( candidate )
			) {
				return false;
			}

			for (
				let ancestor = candidate;
				ancestor && ancestor !== link.parentElement;
				ancestor = ancestor.parentElement
			) {
				if (
					ancestor.hidden ||
					ancestor.getAttribute( 'aria-hidden' ) === 'true'
				) {
					return false;
				}

				const view = ancestor.ownerDocument.defaultView;
				const style = view && view.getComputedStyle( ancestor );

				if (
					style &&
					( style.display === 'none' ||
						style.visibility === 'hidden' ||
						style.visibility === 'collapse' ||
						parseFloat( style.fontSize ) === 0 )
				) {
					return false;
				}
			}

			return true;
		}
	);
	const named = candidates.filter(
		( candidate ) =>
			candidate.matches( WIDGET_TITLE_SELECTOR ) ||
			[ ...candidate.classList ].some( ( name ) =>
				TITLE_CLASS_PATTERN.test( name )
			)
	);
	const pool = named.length ? named : candidates;
	const leaves = pool.filter(
		( candidate ) =>
			! pool.some(
				( parent ) =>
					parent !== candidate && parent.contains( candidate )
			)
	);

	return leaves[ 0 ] || null;
};

/**
 * Headings, plus common text elements themes use for titles without a heading
 * tag, and anything wearing one of the title classes.
 */
const CANDIDATE_SELECTOR = [
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'b',
	'p',
	'a[href]',
	'span',
	'strong',
	'em',
	...TITLE_CLASSES.map( ( name ) => `.${ name }` ),
	'[data-title]',
	'[itemprop="headline"]',
	'[role="heading"]',
	'[class*="title"]',
	'[class*="headline"]',
].join( ',' );

/**
 * Where a title really lives, as opposed to a heading that is site chrome.
 */
const CONTENT_AREAS = [
	'main',
	'article',
	'#content',
	'.site-content',
	'.content-area',
	'[role="main"]',
].join( ',' );

/**
 * Regions whose headings are the site's, not the post's.
 */
const BRANDING_AREAS = [
	'.site-title',
	'.site-branding',
	'.site-header',
	'#masthead',
	'.navbar',
	'.main-navigation',
	'nav',
	'header.site-header',
].join( ',' );

/**
 * A previous/next post link, which names another post and is content.
 *
 * The adjacent-post links are navigation in markup and content for a reader:
 * they print the post's title and link to it, so they are decorated like any
 * other copy of that title. Both of the rules that keep the site's menus bare —
 * `nav` in `BRANDING_AREAS` and `.post-navigation` in `NOT_TITLE_AREAS` — also
 * matched them, which is why the two titles beside a post were the only copies
 * on the page a reader ever saw without an icon.
 *
 * `.nav-previous` and `.nav-next` are the containers `the_post_navigation()`
 * and `the_posts_navigation()` both print, and a page's own pagination
 * (`.pagination`) is not listed here: it holds page numbers, not titles.
 */
const ADJACENT_POST_AREAS = [
	'a[rel="prev"]',
	'a[rel="next"]',
	'a[rel="previous"]',
	'.post-navigation',
	'.posts-navigation',
	'.post-nav',
	'.nav-previous',
	'.nav-next',
].join( ',' );

/**
 * Text tickers in a site header are content widgets, not the site's branding.
 * Newsonline/Newsmash put animated post titles inside their header, so exclude
 * those containers from the broad header rejection while retaining the
 * protection for the site logo and navigation.
 */
const HEADER_CONTENT_AREAS = [ '.dt-news-headline' ].join( ',' );

/**
 * A theme's word-by-word animation splits one title across many child tags.
 * Match the intact animated item as a unit, not its individual letters.
 */
const ANIMATED_TITLE_AREAS = [ '.dt_heading_inner > b' ].join( ',' );

/**
 * Regions that hold someone else's title, when the page is a post.
 *
 * On a single post the reader is looking at one title, and every other heading
 * on the page belongs to a list: a related-posts carousel, a sidebar's latest
 * posts, a "you may also like" rail. Measured on a real theme, a carousel card
 * and the article's own heading both carried the post's title and both linked
 * to it, so only the region they sit in told them apart.
 */
const SIDE_AREAS = [
	'aside',
	'.widget-area',
	'.sidebar',
	'[class*="carousel"]',
	'[class*="slider"]',
	'[class*="swiper"]',
	'.slick-slide',
	'[class*="related"]',
	'[class*="latest"]',
].join( ',' );

/**
 * Regions that hold the article's own title.
 *
 * The opposite signal to `SIDE_AREAS`, and the one that picks the heading a
 * reader thinks of as "the title" when a theme prints it twice — several themes
 * repeat it in a page banner above the article.
 */
const ARTICLE_AREAS = [
	'article',
	'.entry-header',
	'.post-header',
	'.entry-title',
	// The theme's own card title container. This site's listing cards use it
	// without an <article> around them, so their titles were skipped entirely
	// (a card for a second post never received an icon).
	'.read-title',
].join( ',' );

/**
 * The entry's own header block, where its title is printed.
 *
 * A candidate found inside one of these is the entry's title and cannot be
 * talked out of it by a region name further up the page. That overrule is what
 * makes the search survive a theme that reuses a listing word for ordinary
 * markup, and it was measured: MoreNews wraps the article's own
 * `header.entry-header` in `div.entry-header-details.af-cat-widget-carousel`,
 * so the substring test in `SIDE_AREAS` matched the article's title as a
 * carousel card and pushed it below a comment heading.
 *
 * Only applied on a single post. In a list every card is an entry of its own,
 * so "the entry's header" says nothing about *which* card this entry is —
 * there the permalink is what identifies the title, exactly as before.
 *
 * Container classes only. `entry-title` and `post-title` are deliberately not
 * listed even though they name a title, because a listing card wears them too:
 * adding them made a carousel card outscore the article's own heading, which
 * the test suite caught.
 */
const ARTICLE_HEADER_AREAS = [
	'.entry-header',
	'.post-header',
	'.article-header',
	'.single-header',
].join( ',' );

/**
 * Marks a heading as one a reader cannot see, which must never win.
 */
const HIDDEN_AREAS = [
	'.screen-reader-text',
	'.sr-only',
	'.visually-hidden',
].join( ',' );

/**
 * Regions that talk *about* the post rather than name it.
 *
 * A comment thread and the reply form are not the post's title, but they read
 * like one: `h2.comments-title` says "1 thought on “Breaking News We Nev”",
 * and the reply form says "Leave a Reply Cancel reply" and links to the post.
 * Both things this search identifies a title by — the words, and a link to the
 * post — are satisfied by markup that is emphatically not the title, so these
 * are refused outright rather than merely out-scored.
 *
 * Measured on MoreNews: `h2.comments-title` beat the article's exact-match
 * `<h1 class="entry-title">` once the theme's wrapper class tripped
 * `SIDE_AREAS`, and the icon was drawn on the comment thread.
 *
 * A theme's previous/next post links are deliberately *not* here. They were,
 * on the theory that "navigation" means the same thing everywhere, and the
 * result was a post page whose two adjacent titles — printed in full, linked to
 * the post they name — were the only copies of a title without an icon. They
 * are named in `ADJACENT_POST_AREAS` and decorated like any other occurrence;
 * what stays bare here is a page's own pagination and a breadcrumb trail.
 */
const NOT_TITLE_AREAS = [
	'#comments',
	'.comments-area',
	'.comment-respond',
	'.comment-list',
	'.comment-meta',
	'.comments-title',
	'.comment-reply-title',
	'#reply-title',
	'.pingback-title',
	'#respond',
	// A latest-comments widget names the post each comment is on, and links
	// to it — both of the things this search identifies a title by.
	'.wp-block-latest-comments',
	'.widget_recent_comments',
	'.recentcomments',
	'.pagination',
	'.breadcrumb',
	'.breadcrumbs',
].join( ',' );

/**
 * Extra weight for the entry's own header on a single post.
 *
 * Larger than everything else a candidate can earn put together, so the title
 * in the article's header wins whenever it is identified at all — which is the
 * whole point: on a single post there is exactly one title a reader is looking
 * at, and the page may show that post's name in half a dozen other places.
 */
const ARTICLE_HEADER_BONUS = 50;

/**
 * Extra weight for matching the title exactly rather than merely containing it.
 *
 * An exact match *identifies* the element; a containing one is a guess that the
 * theme wrapped the title in something. A guess must never beat an
 * identification, whatever region the two sit in — a comment heading ("1
 * thought on “Title”"), a breadcrumb trail ("Home / Title") and a related-posts
 * card all contain the title verbatim.
 */
const EXACT_TIER = 1000;

const HEADING = /^h[1-6]$/;
const SECTION_MARKERS = {
	'theme-main-featured': [ '.mainfeatured_section' ],
	'theme-featured-grid': [ '.post_columns-grid' ],
	'theme-latest-post': [ '.dt-posts-module' ],
	'theme-other-story': [ '.post-carousel-missed' ],
	'theme-popular-categories': [ '.popular-categories' ],
};

const SMART_CHARS = {
	'\u2018': "'",
	'\u2019': "'",
	'\u201c': '"',
	'\u201d': '"',
	'\u2013': '-',
	'\u2014': '-',
	'\u2026': '...',
	'\u00a0': ' ',
};

/**
 * The HTML entities a title can arrive with, and the character each names.
 *
 * The server's copy of a title is the one WordPress hands out, and WordPress
 * encodes a bare `&` as `&#038;` on the way out. The theme prints that into
 * the page, where the parser turns it back into an `&`, so the same title is
 * `A & B` in the document and `A &#038; B` in the entry — and a title with an
 * ampersand in it matched *nothing*, which is what "the icon is missing on
 * this one post, on every theme" turns out to be. `&amp;`, `&lt;`, `&gt;`,
 * `&quot;`, `&nbsp;` and `&hellip;` arrive the same way from an editor's own
 * markup or a title filter.
 *
 * Folded in one pass over the string, so an entity that has already been
 * decoded is never decoded a second time (`&amp;lt;` stays `&lt;`).
 */
const ENTITIES = {
	'&amp;': '&',
	'&#038;': '&',
	'&#38;': '&',
	'&lt;': '<',
	'&#060;': '<',
	'&#60;': '<',
	'&gt;': '>',
	'&#062;': '>',
	'&#62;': '>',
	'&quot;': '"',
	'&#034;': '"',
	'&#34;': '"',
	'&#039;': "'",
	'&#39;': "'",
	'&nbsp;': ' ',
	'&hellip;': '...',
	'&#8230;': '...',
};

const ENTITY =
	/&(?:amp|lt|gt|quot|nbsp|hellip|#0?38|#0?60|#0?62|#0?34|#0?39|#8230);/gi;

/**
 * A title reduced to the form two of them can be compared in.
 *
 * Themes hand the title through `wptexturize`, so the same title arrives with
 * curly quotes on the page and straight ones in the data; whitespace is folded
 * because markup around the text adds newlines. Entities are folded too, so
 * the document's decoded `&` and the entry's `&#038;` are one title rather
 * than two — see `ENTITIES`. Pure, so the comparison the whole search rests on
 * can be checked without a browser.
 *
 * @param {string} value Any string.
 * @return {string} Folded, lower-cased text.
 */
export const normalizeTitle = ( value ) =>
	String( value === undefined || value === null ? '' : value )
		.replace( ENTITY, ( entity ) => {
			const name = entity.toLowerCase();

			return undefined === ENTITIES[ name ] ? entity : ENTITIES[ name ];
		} )
		.replace(
			/[\u2018\u2019\u201c\u201d\u2013\u2014\u2026\u00a0]/g,
			( character ) => SMART_CHARS[ character ]
		)
		.replace( /\s+/g, ' ' )
		.trim()
		.toLowerCase();

/**
 * Whether an element is a heading.
 *
 * @param {Element} element Candidate.
 * @return {boolean} True for h1-h6.
 */
const isHeading = ( element ) =>
	HEADING.test( element.tagName.toLowerCase() ) ||
	'heading' === element.getAttribute( 'role' );

/**
 * Whether an element is named like a title.
 *
 * @param {Element} element Candidate.
 * @return {boolean} True when one of its classes is a title class.
 */
const isTitleClassed = ( element ) =>
	TITLE_CLASSES.some( ( name ) => element.classList.contains( name ) ) ||
	hasTitleClass( element ) ||
	element.hasAttribute( 'data-title' ) ||
	'headline' === element.getAttribute( 'itemprop' ) ||
	'heading' === element.getAttribute( 'role' );

/**
 * Whether a theme lays this title out as a block-level element.
 *
 * Custom theme elements commonly use their own tag name, so their display
 * style is the only clue that distinguishes the title container from an inner
 * span carrying the same text.
 *
 * @param {Element} element Candidate.
 * @return {boolean} True when the element is block-level.
 */
const isBlockTitleElement = ( element ) => {
	const view = element.ownerDocument.defaultView;

	return Boolean(
		view &&
		view.getComputedStyle &&
		/^(block|flow-root|flex|grid|table|list-item|table-caption)$/.test(
			view.getComputedStyle( element ).display
		)
	);
};

/**
 * Whether a title occurrence is a card in a list rather than the page's title.
 *
 * A block theme's "More posts" query loop prints the article's title again —
 * usually as a link inside an `<li>`, wearing the same `wp-block-post-title`
 * class as the article's own heading, so the classes cannot tell the two apart.
 * The list item can: the page's own title is never a card in a list.
 *
 * Used only to choose between occurrences of the same text on a singular page;
 * a listing is still decorated when it is the only occurrence there is.
 *
 * @param {Element} element Candidate.
 * @return {boolean} True when the candidate sits inside a post listing.
 */
const isListingTitle = ( element ) =>
	Boolean(
		element.closest( 'li, .wp-block-post-template, .wp-block-query' )
	);

/**
 * Tags that are layout containers rather than text/title elements. These
 * cannot be a theme's custom title host simply because their text matches.
 */
const STRUCTURAL_TITLE_TAGS = new Set( [
	'html',
	'body',
	'main',
	'article',
	'section',
	'header',
	'footer',
	'aside',
	'nav',
	'ul',
	'ol',
	'li',
] );

/**
 * Prefer a named title element over an unlabelled wrapper when several nodes
 * contain the same exact text.
 *
 * @param {Element[]} elements Exact text matches.
 * @return {Element[]} Most specific title matches.
 */
const mostSpecificTitleElements = ( elements ) => {
	const named = elements.filter(
		( element ) => isHeading( element ) || isTitleClassed( element )
	);
	const blocks = elements.filter(
		( element ) =>
			isBlockTitleElement( element ) &&
			! STRUCTURAL_TITLE_TAGS.has( element.tagName.toLowerCase() )
	);
	let pool = elements;

	if ( named.length ) {
		pool = named;
	} else if ( blocks.length ) {
		pool = blocks;
	}

	return pool.filter(
		( candidate ) =>
			! pool.some(
				( child ) => child !== candidate && candidate.contains( child )
			)
	);
};

/**
 * A URL in the form two of them can be compared in.
 *
 * @param {string} href Any URL.
 * @return {string} Lower-cased, without a trailing slash, query or fragment.
 */
export const normalizeUrl = ( href ) =>
	String( href || '' )
		.toLowerCase()
		.replace( /[?#].*$/, '' )
		.replace( /\/+$/, '' );

/**
 * Whether an element links to a post.
 *
 * The archive and query-loop case: the title sits inside a link to the post, so
 * the link identifies the title exactly — which is what stops a listing that
 * shows several titles from being decorated in the wrong order.
 *
 * @param {Element} element   Candidate.
 * @param {string}  permalink Post permalink.
 * @return {boolean} True when the element or a descendant links to it.
 */
export const linksTo = ( element, permalink ) => {
	const wanted = normalizeUrl( permalink );

	if ( ! wanted ) {
		return false;
	}

	if (
		'a' === element.tagName.toLowerCase() &&
		normalizeUrl( element.getAttribute( 'href' ) ) === wanted
	) {
		return true;
	}

	return [ ...element.querySelectorAll( 'a[href]' ) ].some(
		( link ) => normalizeUrl( link.getAttribute( 'href' ) ) === wanted
	);
};

/**
 * Whether a candidate is site chrome rather than the post's title.
 *
 * A site name is usually an `<h1>` as well, and assistive tech already
 * announces the page, so neither may ever be chosen — the icon would read as if
 * the post were called "FivePrayer".
 *
 * @param {Element} element Candidate.
 * @return {boolean} True for the site's own headings and screen-reader text.
 */
export const isSiteChrome = ( element ) =>
	Boolean(
		( element.closest( BRANDING_AREAS ) &&
			! element.closest( HEADER_CONTENT_AREAS ) &&
			! element.closest( ADJACENT_POST_AREAS ) ) ||
		element.closest( HIDDEN_AREAS )
	);

/**
 * Whether a candidate is genuinely hidden rather than an inactive carousel
 * slide. Slick marks slides `aria-hidden="true"` while they are offscreen, but
 * those titles must already have icons when the carousel advances to them.
 *
 * @param {Element} element Candidate.
 * @return {boolean} True when hidden outside a carousel slide.
 */
const isHiddenTitle = ( element ) => {
	if ( element.closest( '[hidden]' ) ) {
		return true;
	}

	const hidden = element.closest( '[aria-hidden="true"]' );

	if ( ! hidden ) {
		return false;
	}

	const slide = element.closest( '.slick-slide' );

	return ! slide || ! slide.contains( hidden );
};

/**
 * Score one candidate as "this page's title for this entry".
 *
 * A candidate that cannot be *identified* scores below zero and is never used:
 * the title text or a link to the post has to agree, because a heading that
 * holds different words is a different post's title. That check is the whole
 * reason this is a score rather than a selector — the weights only decide
 * between candidates that are both plausible:
 *
 *   - An exact match beats a containing one, whatever region the two sit in.
 *     Identity first: "Home / Title", "1 thought on “Title”" and "Post: Title"
 *     all contain the title, and the first two are not the title at all.
 *   - A heading beats a link. A "Latest Posts" list also holds the post's title
 *     as a link to it, and on a single post that link carries the post's own
 *     permalink, so without this the icon could be drawn in the sidebar.
 *   - On a single post, the title in the article's own header wins outright.
 *   - Otherwise a candidate inside the article beats one in a sidebar.
 *
 * Refusal comes first: site chrome, hidden headings and the comment and
 * navigation regions are rejected before any of this is weighed, because those
 * are places where a heading can carry the post's title *and* link to it — the
 * exact things this search identifies a title by — while still not being it.
 *
 * Pure, so the search can be run against real theme markup in a test.
 *
 * @param {Element} element Candidate.
 * @param {Object}  entry   Icon entry from the server.
 * @return {number} Score; at or below zero means "not this title".
 */
export const scoreTitle = ( element, entry ) => {
	if (
		isSiteChrome( element ) ||
		isHiddenTitle( element ) ||
		element.closest( NOT_TITLE_AREAS ) ||
		element.closest( `[${ WIDGET_ATTR }]` )
	) {
		return -1;
	}

	const wanted = normalizeTitle( entry.title );
	const text = normalizeTitle( element.textContent );
	const exact = Boolean( wanted ) && text === wanted;
	// A theme may add a screen-reader prefix inside the heading, e.g.
	// "Post: Title", so a containing heading is still this title.
	const contains = Boolean( wanted ) && text.includes( wanted );

	const hasMedia = holdsMedia( element );
	let linked = false;

	if ( hasMedia && ! exact && ! contains ) {
		return -1;
	}

	if ( ! exact && ! contains ) {
		if ( entry.singular ) {
			return -1;
		}

		linked = linksTo( element, entry.permalink );

		if ( ! linked ) {
			return -1;
		}
	}

	// A page's own title is identified by its text. Its permalink is no help:
	// a carousel of other posts links to this post exactly as the article does,
	// and the article's own heading is usually not a link at all.
	if ( entry.singular && ! exact && ! contains ) {
		return -1;
	}

	// The tier, not the weights, decides between an identification and a
	// guess — see `EXACT_TIER`.
	let score = exact ? EXACT_TIER : 0;

	if ( isHeading( element ) ) {
		score += 20;
	}

	if ( isTitleClassed( element ) ) {
		score += 4;
	}

	if ( isBlockTitleElement( element ) ) {
		score += 8;
	}

	if ( element.matches( ANIMATED_TITLE_AREAS ) ) {
		// Newsonline splits ticker titles into animated character spans. Prefer
		// the complete bold ticker item over its exact-text wrapper span.
		score += 20;
	}

	if ( exact ) {
		score += 12;
	} else if ( contains ) {
		score += 4;
	}

	if ( linked ) {
		// Only meaningful in a list of posts, where it is what tells one card
		// from another.
		score += entry.singular ? 0 : 6;
	}

	if ( element.closest( CONTENT_AREAS ) ) {
		score += 4;
	}

	if ( entry.singular ) {
		if ( element.closest( ARTICLE_HEADER_AREAS ) ) {
			// The article's own header: the title, and nothing further up the
			// page gets to argue with it.
			score += ARTICLE_HEADER_BONUS;
		} else if ( element.closest( SIDE_AREAS ) ) {
			score -= 20;
		} else if ( element.closest( ARTICLE_AREAS ) ) {
			score += 6;
		}
	}

	return score;
};

const sectionForTitle = ( element, entry ) => {
	// A post page is gated only by the sections the server sent for that page.
	// The built-in selectors are a homepage list, and applying them here would
	// refuse a copy inside a news theme's related-story rail that was never a
	// homepage section at all. A singular entry without a selector map has no
	// per-page sections, so nothing on it is gated.
	if ( entry.singular && ! entry.sectionSelectors ) {
		return null;
	}

	if ( ! entry.singular && ! entry.sectionIds ) {
		return null;
	}

	// Keep the built-in selectors as a fallback for callers that explicitly
	// send section IDs but no selector map.
	const configured = entry.sectionSelectors || SECTION_MARKERS;
	const enabled = new Set( entry.sectionIds );
	let matched = null;
	let depth = -1;

	Object.entries( configured ).forEach( ( [ id, selectors ] ) => {
		( selectors || [] ).forEach( ( selector ) => {
			const section = element.closest( selector );

			if ( ! section ) {
				return;
			}

			let currentDepth = 0;

			for ( let node = section; node; node = node.parentElement ) {
				currentDepth++;
			}

			if ( currentDepth > depth ) {
				matched = { enabled: enabled.has( id ) };
				depth = currentDepth;
			}
		} );
	} );

	return matched;
};

/**
 * The best-matching title element for an entry, or null when none matches.
 *
 * Every candidate is scored and the best one wins; the sort is stable, so the
 * document order decides a tie. An icon that is not drawn is a small loss,
 * while an icon drawn beside the wrong words is a visible bug — so the fallback
 * is narrow, and only fires when the page holds exactly one candidate to be
 * wrong about.
 *
 * @param {Object}   entry Entry from the server.
 * @param {Document} doc   Document to search.
 * @return {Element|null} Title element.
 */
const titleCandidates = ( entry, doc ) => {
	const standard = [ ...doc.querySelectorAll( CANDIDATE_SELECTOR ) ];
	const seen = new Set( standard );
	const wanted = normalizeTitle( entry.title );
	const custom = [ ...doc.querySelectorAll( '*' ) ].filter( ( candidate ) => {
		if (
			seen.has( candidate ) ||
			STRUCTURAL_TITLE_TAGS.has( candidate.tagName.toLowerCase() )
		) {
			return false;
		}

		return normalizeTitle( candidate.textContent ) === wanted;
	} );

	return [ ...standard, ...custom ].filter(
		( candidate ) =>
			! candidate.closest( ANIMATED_TITLE_AREAS ) ||
			candidate.matches( ANIMATED_TITLE_AREAS )
	);
};

export const findTitleElement = ( entry, doc = document ) => {
	const candidates = titleCandidates( entry, doc );
	const wanted = normalizeTitle( entry.title );
	const exactCandidates = candidates.filter(
		( candidate ) => normalizeTitle( candidate.textContent ) === wanted
	);
	const containingCandidates = exactCandidates.length
		? exactCandidates
		: candidates.filter( ( candidate ) =>
				normalizeTitle( candidate.textContent ).includes( wanted )
			);
	const focusedCandidates = containingCandidates.length
		? containingCandidates
		: candidates;
	const eligibleCandidates = focusedCandidates.filter( ( candidate ) => {
		const section = sectionForTitle( candidate, entry );

		return (
			( entry.allowTitles !== false || ( section && section.enabled ) ) &&
			( ! section || section.enabled )
		);
	} );
	let best = null;
	let bestScore = 0;
	let bestDepth = -1;
	const exact = exactCandidates.filter( ( candidate ) =>
		eligibleCandidates.includes( candidate )
	);
	// On the post's own page, an occurrence outside a listing is the article's
	// title; a "More posts" list that repeats the current post is not. The
	// filter is skipped when it would leave nothing to choose from, so a page
	// whose only title occurrence really is in a list still gets its icon.
	const pageExact =
		entry.singular && exact.length > 1
			? exact.filter( ( candidate ) => ! isListingTitle( candidate ) )
			: [];
	const primary = pageExact.length ? pageExact : exact;
	let likelyTitles = [];

	if ( entry.singular && primary.length ) {
		const headingTitleNodes = primary.filter( ( candidate ) => {
			const heading = candidate.closest(
				'h1, h2, h3, h4, h5, h6, [role="heading"]'
			);
			const headingIsAListing = heading && heading.closest( SIDE_AREAS );
			const isNestedInAnotherTitleNode = primary.some(
				( child ) => child !== candidate && candidate.contains( child )
			);

			return (
				heading &&
				( ! headingIsAListing ||
					candidate.closest( ARTICLE_HEADER_AREAS ) ||
					candidate.closest( 'article' ) ) &&
				candidate !== heading &&
				! isNestedInAnotherTitleNode &&
				! candidate.querySelector( '[data-titlesparks-icon]' ) &&
				! candidate.closest( ANIMATED_TITLE_AREAS )
			);
		} );
		const articleHeaderTitles = primary.filter( ( candidate ) => {
			if (
				! candidate.closest( ARTICLE_HEADER_AREAS ) ||
				candidate.closest( `[${ WIDGET_ATTR }]` )
			) {
				return false;
			}

			const containsMoreSpecificTitle = primary.some(
				( child ) =>
					child !== candidate &&
					candidate.contains( child ) &&
					child.closest( ARTICLE_HEADER_AREAS )
			);

			return (
				( isHeading( candidate ) || isTitleClassed( candidate ) ) &&
				! containsMoreSpecificTitle
			);
		} );
		const headingsExact = primary.filter( isHeading );
		const titleClassedExact = primary.filter( isTitleClassed );
		const entryTitlesInHeader = primary.filter(
			( candidate ) =>
				candidate.classList.contains( 'entry-title' ) &&
				candidate.closest( ARTICLE_HEADER_AREAS ) &&
				! candidate.closest( SIDE_AREAS )
		);
		const markedTitleInsideHeading = primary.filter( ( candidate ) => {
			const heading = candidate.parentElement?.closest(
				'h1, h2, h3, h4, h5, h6, [role="heading"]'
			);

			return isTitleClassed( candidate ) && Boolean( heading );
		} );
		const blockTitleInsideHeading = primary.filter( ( candidate ) => {
			const heading = candidate.parentElement?.closest(
				'h1, h2, h3, h4, h5, h6, [role="heading"]'
			);

			return isBlockTitleElement( candidate ) && Boolean( heading );
		} );
		const classedInHeader = titleClassedExact.filter(
			( candidate ) =>
				candidate.closest( ARTICLE_HEADER_AREAS ) &&
				! candidate.closest( SIDE_AREAS )
		);
		const headingsOutsideSideAreas = headingsExact.filter(
			( candidate ) => ! candidate.closest( SIDE_AREAS )
		);
		let preferred = primary;

		if ( articleHeaderTitles.length ) {
			preferred = articleHeaderTitles;
		} else if ( headingTitleNodes.length ) {
			preferred = headingTitleNodes;
		} else if ( markedTitleInsideHeading.length ) {
			preferred = markedTitleInsideHeading;
		} else if ( blockTitleInsideHeading.length ) {
			preferred = blockTitleInsideHeading;
		} else if ( entryTitlesInHeader.length ) {
			preferred = entryTitlesInHeader;
		} else if ( classedInHeader.length ) {
			preferred = classedInHeader;
		} else if ( headingsOutsideSideAreas.length ) {
			preferred = headingsOutsideSideAreas;
		} else if ( titleClassedExact.length ) {
			preferred = titleClassedExact;
		}

		const blocks = preferred.filter( isBlockTitleElement );
		likelyTitles = mostSpecificTitleElements(
			blocks.length ? blocks : preferred
		);
	}

	eligibleCandidates.forEach( ( candidate ) => {
		if (
			entry.singular &&
			primary.length &&
			! likelyTitles.includes( candidate )
		) {
			return;
		}

		const score = scoreTitle( candidate, entry );
		let depth = 0;

		for ( let parent = candidate; parent; parent = parent.parentElement ) {
			depth++;
		}

		if (
			score > bestScore ||
			( score > 0 && score === bestScore && depth > bestDepth )
		) {
			bestScore = score;
			bestDepth = depth;
			best = candidate;
		}
	} );

	if ( best ) {
		return best;
	}

	// Nothing identified the title. A site that rewrites titles through a filter
	// of its own leaves nothing to match on, so a page with a single candidate
	// inside the article is taken at its word.
	const alone = eligibleCandidates.filter(
		( candidate ) =>
			( entry.allowTitles !== false ||
				( sectionForTitle( candidate, entry ) || {} ).enabled ) &&
			! isSiteChrome( candidate ) &&
			! candidate.closest( NOT_TITLE_AREAS ) &&
			candidate.closest( CONTENT_AREAS ) &&
			( isTitleClassed( candidate ) || isHeading( candidate ) )
	);

	return 1 === alone.length ? alone[ 0 ] : null;
};

/**
 * One element per occurrence: the innermost node that carries the words.
 *
 * A title is rarely one node. `h2.entry-title > span > a` is three elements
 * with the same text, and they are one title, so only the innermost of an
 * occurrence is decorated — whatever the theme wrapped it in, the icon goes
 * beside the words rather than around them. Two sibling cards are two
 * occurrences and keep one icon each.
 *
 * @param {Element[]} elements Candidates.
 * @return {Element[]} Those that do not contain another of them.
 */
const innermostTitles = ( elements ) =>
	elements.filter(
		( candidate ) =>
			! elements.some(
				( child ) => child !== candidate && candidate.contains( child )
			)
	);

/**
 * Order occurrences the way they sit on the page.
 *
 * The order is part of the contract: an icon beyond the first is named after
 * the position it was found in (`7-title-2`), so the same occurrence has to
 * keep the same number on every pass or a repeated pass would renumber the
 * icons and look for them in the wrong elements. Document order is the one
 * order a page cannot change without changing itself.
 *
 * @param {Element[]} elements Elements to order.
 * @return {Element[]} The same elements, in document order.
 */
const sortInDocumentOrder = ( elements ) =>
	[ ...elements ].sort( ( a, b ) => {
		const position = a.compareDocumentPosition( b );
		const Node = a.ownerDocument.defaultView.Node;

		if ( position === Node.DOCUMENT_POSITION_PRECEDING ) {
			return 1;
		}

		if ( position === Node.DOCUMENT_POSITION_FOLLOWING ) {
			return -1;
		}

		return 0;
	} );

/**
 * Every other place this page prints the post's title.
 *
 * A page usually shows the title it is about more than once: a sidebar's
 * "latest posts", a related-posts rail, a "More posts" query loop, a widget, a
 * second card for the same post further down. The same post with the same
 * settings should read the same in all of them, so each occurrence gets the
 * entry's icon — a reader who sees the title twice and the icon once is
 * looking at the bug this used to be, on whichever theme drew the page.
 *
 * This used to decorate only the occurrences that happened to sit in a
 * carousel, a slider or one of a few named article containers, so on most
 * themes the copy in the sidebar was left bare while the copy beside the words
 * had an icon.
 *
 * What is left out is what is not the title:
 *
 *   - the post's own title is handed in and never repeated here;
 *   - a copy inside a marked widget is placed by the widget rules instead, so
 *     a widget switched off in Settings stays off;
 *   - the letter-level pieces of an animated ticker are one title, not many;
 *   - a hidden region is not on the page, and `scoreTitle` refuses the
 *     comment, navigation, breadcrumb and site-branding regions as well;
 *   - words that merely *contain* the title — a heading reading "Latest: the
 *     title", a paragraph quoting it — only qualify when the element also
 *     reads as a title: a heading, a title class, or a link to the post.
 *
 * @param {Object}   entry Entry from the server.
 * @param {Element}  title The entry's own title, already chosen.
 * @param {Document} doc   Document to search.
 * @return {Element[]} Further occurrences, in document order.
 */
const otherTitleOccurrences = ( entry, title, doc ) => {
	const wanted = normalizeTitle( entry.title );
	const found = titleCandidates( entry, doc ).filter( ( candidate ) => {
		if ( candidate === title ) {
			return false;
		}

		if ( candidate.closest( `[${ WIDGET_ATTR }]` ) ) {
			return false;
		}

		if (
			candidate.closest( ANIMATED_TITLE_AREAS ) &&
			! candidate.matches( ANIMATED_TITLE_AREAS )
		) {
			return false;
		}

		const section = sectionForTitle( candidate, entry );

		if ( section && ! section.enabled ) {
			return false;
		}

		const text = normalizeTitle( candidate.textContent );

		if ( text !== wanted && ! text.includes( wanted ) ) {
			return false;
		}

		const readsAsATitle =
			isHeading( candidate ) ||
			isTitleClassed( candidate ) ||
			linksTo( candidate, entry.permalink );

		return (
			( text === wanted || readsAsATitle ) &&
			scoreTitle( candidate, entry ) > 0
		);
	} );

	return sortInDocumentOrder( innermostTitles( found ) );
};

/**
 * Find every matching title, including inactive Slick slides and clones.
 *
 * @param {Object}   entry Entry from the server.
 * @param {Document} doc   Document to search.
 * @return {Element[]} Matching title elements.
 */
export const findTitleElements = ( entry, doc = document ) => {
	if ( entry.singular ) {
		if ( entry.allowTitles === false ) {
			return [];
		}

		const title = findTitleElement( entry, doc );

		if ( ! title ) {
			return [];
		}

		return [ title, ...otherTitleOccurrences( entry, title, doc ) ];
	}

	const wanted = normalizeTitle( entry.title );
	const candidates = titleCandidates( entry, doc );
	const exactCandidates = candidates.filter(
		( candidate ) => normalizeTitle( candidate.textContent ) === wanted
	);
	const containingCandidates = exactCandidates.length
		? exactCandidates
		: candidates.filter( ( candidate ) =>
				normalizeTitle( candidate.textContent ).includes( wanted )
			);
	const focusedCandidates = containingCandidates.length
		? containingCandidates
		: candidates;
	const matches = focusedCandidates.filter( ( candidate ) => {
		if (
			candidate.closest( ANIMATED_TITLE_AREAS ) &&
			! candidate.matches( ANIMATED_TITLE_AREAS )
		) {
			return false;
		}

		const widget = candidate.closest( `[${ WIDGET_ATTR }]` );

		if ( widget ) {
			const wrapper = candidate.closest( 'a[href]' );

			if (
				! wrapper ||
				! linksTo( wrapper, entry.permalink ) ||
				! ( isTitleClassed( candidate ) || isHeading( candidate ) )
			) {
				return false;
			}
		}

		const text = normalizeTitle( candidate.textContent );

		// The ticker's span is only a wrapper around its animated bold title.
		// Ignore it so each rendered title occurrence gets one icon.
		if (
			text === wanted &&
			candidate.querySelector( ANIMATED_TITLE_AREAS )
		) {
			return false;
		}

		const matchesText = text === wanted || text.includes( wanted );

		// A linked thumbnail identifies the post, but it is not a title.
		// When the link has no matching title text, never decorate its image.
		if (
			! matchesText &&
			candidate.querySelector( 'img, picture, video, svg' )
		) {
			return false;
		}

		if ( scoreTitle( candidate, entry ) <= 0 ) {
			return false;
		}

		const section = sectionForTitle( candidate, entry );

		return (
			( entry.allowTitles !== false || ( section && section.enabled ) ) &&
			( ! section || section.enabled )
		);
	} );
	const exact = matches.filter(
		( element ) => normalizeTitle( element.textContent ) === wanted
	);
	const titles = exact.length ? exact : matches;
	const blocksExact = exact.filter( isBlockTitleElement );
	let unique = titles;

	if ( exact.length ) {
		const preferred = mostSpecificTitleElements(
			blocksExact.length ? blocksExact : titles
		);

		if ( preferred.length ) {
			unique = preferred;
		}

		/*
		 * The preference above is answered for the whole page, so a single exact
		 * heading anywhere drops every inline candidate everywhere else. A post
		 * page is exactly that shape: its previous/next links are inline links
		 * with no heading inside them, and the same page lists posts as cards
		 * whose titles are headings — so the two adjacent titles were the copies
		 * that stayed bare while every card was decorated.
		 *
		 * An occurrence that identifies itself is a copy of the title wherever
		 * it sits: its own heading, a title class, or a link whose whole text is
		 * this post's title, which is what an adjacent-post link is. The body
		 * element that merely holds the same words — the reason the preference
		 * exists — identifies nothing and stays bare.
		 */
		const identified = innermostTitles( titles ).filter(
			( candidate ) =>
				! unique.some(
					( kept ) =>
						kept === candidate ||
						kept.contains( candidate ) ||
						candidate.contains( kept )
				) &&
				( isHeading( candidate ) ||
					isTitleClassed( candidate ) ||
					linksTo( candidate, entry.permalink ) )
		);

		if ( identified.length ) {
			unique = sortInDocumentOrder( [ ...unique, ...identified ] );
		}
	} else {
		unique = titles.filter(
			( element ) =>
				! titles.some(
					( parent ) =>
						parent !== element &&
						parent.contains( element ) &&
						( isHeading( parent ) || isTitleClassed( parent ) )
				)
		);
	}

	unique = sortInDocumentOrder( unique );

	if ( unique.length ) {
		return unique;
	}

	const fallback = findTitleElement( entry, doc );

	return fallback ? [ fallback ] : [];
};

/**
 * The title an icon was measured against.
 *
 * Most icons sit inside their title. A card link that also carries the
 * thumbnail is different: the icon is inserted beside the card's text box
 * rather than inside it, so a theme's rules for the text (`span { padding }`) or
 * the thumbnail (`img { margin-left }`) cannot resize the icon to nothing. That
 * outside node is still the same link, so the icon stays clickable.
 *
 * @param {Element} icon Icon element.
 * @return {Element} The title the icon belongs to.
 */
const iconTitleHosts = new WeakMap();

export const iconTitleHost = ( icon ) =>
	iconTitleHosts.get( icon ) || icon.parentElement;

/**
 * Insert the icon into the visible title node.
 *
 * When the title text is an exact permalink link, that link is the title node:
 * the icon must be its child, not a sibling beside it inside a heading. For an
 * unlinked title, the matched heading or theme title element remains the node.
 *
 * A title inside a card link that also holds a thumbnail is the one exception:
 * the icon is inserted into the link beside the card's content, so it stays
 * clickable without inheriting the theme's text and thumbnail box rules. The
 * title it is measured against is remembered, and `placeIcon` uses it.
 *
 * *Where* the icon goes is all this decides. *That* it goes into a finished
 * document is the other half: markup written here cannot land in an attribute,
 * a feed, a meta tag or another loop's title.
 *
 * @param {Document} doc   Document owning the title.
 * @param {Element}  title Title element.
 * @param {Object}   entry Entry from the server.
 * @return {Element} The inserted icon.
 */
export const insertIcon = ( doc, title, entry ) => {
	const isWidgetIcon = Boolean( entry.widgetPosition );
	// One size everywhere: the stage's own. A widget icon used to be forced to
	// `1em`, which made a Posts Slider draw a 36px icon where the post and the
	// editor drew the saved 54px.
	const icon = buildIcon( doc, {
		url: entry.url,
		size: entry.size,
	} );
	const inlineWidget =
		[ 'left', 'right' ].includes( entry.position ) &&
		( isWidgetIcon || Boolean( title.closest( `[${ WIDGET_ATTR }]` ) ) );

	icon.className = `${ ICON_CLASS } ${ ICON_CLASS }--${ entry.position }${
		inlineWidget ? ` ${ ICON_CLASS }--inline` : ''
	}${ entry.flip ? ` ${ ICON_CLASS }--flipped` : '' }`;
	icon.setAttribute( ICON_ATTR, String( entry.id ) );

	const image = icon.querySelector( 'img' );

	// The icon reports state rather than decoration, so it keeps the alt text
	// the server resolved instead of being hidden from assistive tech.
	if ( image && entry.alt ) {
		image.alt = entry.alt;
		icon.removeAttribute( 'aria-hidden' );
	}

	// Horizontal widget icons remain in text flow; the frontend applies author
	// nudges with relative movement from their natural, CSS-measured gap. The
	// theme keeps control of the icon's presentation.

	const cardLink = ( () => {
		const link = title.closest( 'a[href]' );

		return link && link !== title && holdsMedia( link ) ? link : null;
	} )();
	const host = cardLink || title;

	// *Where the icon goes* and *what it is measured against* are two
	// answers. A nav link, or a card link whose thumbnail arrived after the
	// icon did, has no picture to send the icon to the words, so the words
	// are looked up on their own: measuring the link's box would put the icon
	// at the link's edge instead of beside its text.
	iconTitleHosts.set(
		icon,
		textHostWithin( title, normalizeTitle( entry.title ) ) || title
	);

	if ( iconComesFirst( entry.position ) ) {
		host.insertBefore( icon, host.firstChild );
	} else {
		host.appendChild( icon );
	}

	return icon;
};

/**
 * Resolve the placement for one icon, keeping a widget's position independent
 * from the nudge configured for the post's main title.
 *
 * @param {string} id             Rendered icon identifier.
 * @param {Object} entry          Frontend icon entry.
 * @param {string} widgetPosition Position used by the widget.
 * @return {Object|null} Position and offset, or null when the entry doesn't
 *                       own this icon.
 */
export const iconPlacementForEntry = ( id, entry, widgetPosition ) => {
	const widgetId = ( entry.widgetIds || [] )
		.map( String )
		.find( ( key ) => entry.marker && id === `${ entry.marker }-${ key }` );

	if ( widgetId ) {
		const requestedPosition =
			widgetPosition || entry.widgetPositions?.[ widgetId ];
		let position = 'right';

		if ( validWidgetPosition( widgetPosition ) ) {
			position = widgetPosition;
		} else if ( validWidgetPosition( requestedPosition ) ) {
			position = requestedPosition;
		} else if ( validWidgetPosition( entry.position ) ) {
			position = entry.position;
		}

		const widgetOffset = entry.widgetOffsets?.[ widgetId ];

		return {
			position,
			offset: widgetOffset
				? {
						offsetX: widgetOffset.x || 0,
						offsetY: widgetOffset.y || 0,
					}
				: {
						offsetX: entry.offsetX || 0,
						offsetY: entry.offsetY || 0,
					},
		};
	}

	const regularTitle =
		id === String( entry.id ) ||
		id.startsWith( `${ entry.id }-slide-` ) ||
		id.startsWith( `${ entry.id }-title-` );

	if ( regularTitle ) {
		return {
			position: entry.position,
			offset: {
				offsetX: entry.offsetX || 0,
				offsetY: entry.offsetY || 0,
			},
		};
	}

	return null;
};

/**
 * The icons this document already carries.
 *
 * @param {Document} doc Document to search.
 * @return {Array<{post: string, icon: Element}>} Inserted icons, by post id.
 */
export const insertedIcons = ( doc = document ) =>
	[ ...doc.querySelectorAll( `[${ ICON_ATTR }]` ) ].map( ( icon ) => ( {
		post: icon.getAttribute( ICON_ATTR ),
		icon,
	} ) );

/**
 * Insert the icon for every entry that does not have one yet.
 *
 * Idempotent: an entry whose icon is already in the document is left alone, so
 * this is safe to run again whenever the page changes — which is what lets the
 * icon survive a theme that renders its titles after load, or a page that
 * inserts content as the reader scrolls.
 *
 * @param {Array}    entries Entries from the server.
 * @param {Document} doc     Document to decorate.
 * @return {Array<Element>} Icons inserted by this call.
 */
/**
 * The innermost element that carries a title's words.
 *
 * A theme is free to hang the words off a wrapper: a card link that also holds
 * the thumbnail, or a previous/next link whose title sits in a box of its own
 * beside it. Measuring against that wrapper measures its whole box — and a
 * block-level child reports a rect as wide as the link — so an icon placed
 * against the "text" landed at the far edge of the link, a hundred pixels from
 * the words, leaving the space it should have been drawn in empty.
 *
 * Descending to the innermost element whose whole text is the title, and which
 * holds no picture, measures the words themselves instead. A title with no such
 * wrapper is its own host, so an ordinary heading is unchanged.
 *
 * @param {Element} element Candidate title element.
 * @param {string}  wanted  Normalized title text.
 * @return {Element} Element holding the words.
 */
const textHostWithin = ( element, wanted ) => {
	if ( ! element ) {
		return element;
	}

	const hosts = [ ...element.querySelectorAll( '*' ) ].filter(
		( node ) =>
			normalizeTitle( node.textContent ) === wanted &&
			! holdsMedia( node )
	);

	return hosts.length ? hosts[ hosts.length - 1 ] : element;
};

/**
 * The element the icon is inserted into.
 *
 * A theme can make the card's whole link the only exact-text candidate it
 * offers, while that link also wraps the card's thumbnail. Inserting there puts
 * the icon beside the picture — and under the theme's rules for the picture's
 * text box — so a link that carries a picture hands its icon to the text-only
 * node inside it instead.
 *
 * Where the icon goes and what it is measured against are two answers: the
 * insertion keeps to the link, while the title it is placed beside is always the
 * words (`textHostWithin`), which `insertIcon` records for `placeIcon`.
 *
 * @param {Element} element Candidate title element.
 * @param {string}  wanted  Normalized title text.
 * @return {Element} Element to insert the icon into.
 */
const titleTextHost = ( element, wanted ) => {
	if ( ! element || ! holdsMedia( element ) ) {
		return element;
	}

	return textHostWithin( element, wanted );
};

export const insertIcons = ( entries = [], doc = document ) => {
	const existing = insertedIcons( doc );
	const done = new Set( existing.map( ( item ) => item.post ) );
	const existingById = new Map(
		existing.map( ( item ) => [ item.post, item.icon ] )
	);

	return ( Array.isArray( entries ) ? entries : [] )
		.filter( ( entry ) => entry && entry.url && entry.id !== undefined )
		.flatMap( ( entry ) => {
			const inserted = [];
			const id = String( entry.id );

			findTitleElements( entry, doc ).forEach( ( title, index ) => {
				const wantedTitle = normalizeTitle( entry.title );
				const hasMedia = holdsMedia;
				const titleLink = ( node ) =>
					Boolean(
						node &&
						! hasMedia( node ) &&
						linksTo( node, entry.permalink ) &&
						normalizeTitle( node.textContent ) === wantedTitle
					);
				const link = title.matches( 'a[href]' )
					? title
					: title.closest( 'a[href]' );
				const linkedTitle = titleLink( link )
					? link
					: [ ...title.querySelectorAll( 'a[href]' ) ].find(
							titleLink
						);
				const tickerTitle = title.matches( '.dt_heading_inner > b' )
					? title
					: title.closest( '.dt_heading_inner > b' );
				const target = titleTextHost(
					tickerTitle || linkedTitle || title,
					wantedTitle
				);
				const slide = target.closest( '.slick-slide' );
				const slideIndex = slide && slide.dataset.slickIndex;
				let key;

				if ( slide && undefined !== slideIndex ) {
					key = `${ id }-slide-${ slideIndex }`;
				} else if ( 0 === index ) {
					key = id;
				} else {
					key = `${ id }-title-${ index }`;
				}

				const siblingIcon = target.parentElement
					? [
							...target.parentElement.querySelectorAll(
								`[${ ICON_ATTR }]`
							),
						].find(
							( icon ) =>
								icon.parentElement === target.parentElement &&
								( icon.getAttribute( ICON_ATTR ) === id ||
									icon
										.getAttribute( ICON_ATTR )
										.startsWith( `${ id }-title-` ) ||
									icon
										.getAttribute( ICON_ATTR )
										.startsWith( `${ id }-slide-` ) )
						)
					: null;
				const existingIcon = existingById.get( key ) || siblingIcon;

				if ( existingIcon ) {
					// Markup from an older page cache may have a measured icon class
					// but no definite box width. Give that legacy node the same
					// one-time size the current builder assigns before positioning.
					if ( ! existingIcon.style.width ) {
						existingIcon.style.width = entry.size || '20px';
					}

					if (
						target !== existingIcon.parentElement &&
						( target.contains( existingIcon ) ||
							existingIcon.parentElement ===
								target.parentElement )
					) {
						if ( iconComesFirst( entry.position ) ) {
							target.insertBefore(
								existingIcon,
								target.firstChild
							);
						} else {
							target.appendChild( existingIcon );
						}
					}

					return;
				}

				if (
					done.has( key ) ||
					target.querySelector( `[${ ICON_ATTR }]` )
				) {
					return;
				}

				const icon = insertIcon( doc, target, { ...entry, id: key } );
				inserted.push( icon );
				done.add( key );
				existingById.set( key, icon );
			} );

			if ( entry.marker && Array.isArray( entry.widgetIds ) ) {
				const allowedWidgets = new Set( entry.widgetIds.map( String ) );
				const wanted = normalizeTitle( entry.title );

				doc.querySelectorAll( `[${ WIDGET_ATTR }] a[href]` ).forEach(
					( link ) => {
						const wrapper = link.closest( `[${ WIDGET_ATTR }]` );
						const widgetId = wrapper.getAttribute( WIDGET_ATTR );
						const key = `${ entry.marker }-${ widgetId }`;

						if ( ! allowedWidgets.has( widgetId ) ) {
							return;
						}

						const title = widgetTitle( link, wanted );

						if (
							normalizeUrl( link.getAttribute( 'href' ) ) !==
								normalizeUrl( entry.permalink ) ||
							! title ||
							title.closest( NOT_TITLE_AREAS ) ||
							done.has( key ) ||
							title.querySelector( `[${ ICON_ATTR }]` )
						) {
							return;
						}

						const requestedPosition =
							wrapper.getAttribute(
								'data-titlesparks-widget-position'
							) || entry.widgetPositions?.[ widgetId ];
						let widgetPosition = 'right';

						if ( validWidgetPosition( requestedPosition ) ) {
							widgetPosition = requestedPosition;
						} else if ( validWidgetPosition( entry.position ) ) {
							widgetPosition = entry.position;
						}

						const position = widgetPosition;

						inserted.push(
							insertIcon( doc, title, {
								...entry,
								id: key,
								position,
								widgetPosition,
								widgetOffsets: entry.widgetOffsets,
							} )
						);
						done.add( key );
					}
				);
			}

			return inserted;
		} );
};
