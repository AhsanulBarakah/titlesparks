/**
 * The canvas title keeps its own left edge.
 *
 * The canvas icon is drawn *over* the page: it is absolutely positioned in
 * WordPress' title wrapper, which only becomes a positioning context. Nothing
 * the pass does may reserve room beside the heading or turn it into a box that
 * starts its lines part-way across — leftover space on the left of a title is
 * exactly what a reader sees as the title being indented.
 *
 * `iconOffset.test.js` pins where the icon lands. This file pins what the pass
 * leaves behind: the heading untouched, the wrapper with no inline space, and
 * an injected stylesheet that declares none either, for every side. The layout
 * half of the same rule needs real text rects, which jsdom has none of, so it
 * is measured in a browser by
 * `tests/integration/editor-title-left-space.cjs`.
 */

import { STYLE_ID, removeEditorIcon, syncEditorIcon } from '../editorTitleDom';

const ASSET = {
	id: 'a1',
	url: 'https://example.test/hot-news.gif',
	alt: 'Hot news',
	sizeMode: 'fixed',
	fixedSize: '20px',
};

/**
 * A canvas title, with the box WordPress gives it.
 *
 * The wrapper is the positioning context and holds nothing but the heading;
 * the heading's text starts 4px inside it, which is what WordPress renders.
 * jsdom has no layout, so both rects are stubbed.
 *
 * @return {{wrapper: Element, title: Element}} The wrapper and its heading.
 */
const scene = () => {
	document.body.innerHTML =
		'<div class="editor-visual-editor__post-title-wrapper" id="w">' +
		'<h1 class="editor-post-title editor-post-title__input" id="t">' +
		'Breaking News Story</h1></div>';

	const wrapper = document.getElementById( 'w' );
	const title = document.getElementById( 't' );

	wrapper.getBoundingClientRect = () => ( {
		left: 200,
		top: 0,
		width: 600,
		height: 120,
		right: 800,
		bottom: 120,
	} );
	document.createRange = () => ( {
		selectNodeContents: () => {},
		setStartAfter: () => {},
		setEndBefore: () => {},
		setStartBefore: () => {},
		setEndAfter: () => {},
		getBoundingClientRect: () => ( {
			left: 204,
			top: 40,
			width: 300,
			height: 60,
			right: 504,
			bottom: 100,
		} ),
		getClientRects: () => [
			{
				left: 204,
				top: 40,
				width: 300,
				height: 60,
				right: 504,
				bottom: 100,
			},
		],
	} );

	return { wrapper, title };
};

/**
 * Run the canvas pass for one side, as `EditorTitleIcon` does.
 *
 * @param {string} position Position keyword.
 * @return {void}
 */
const place = ( position ) =>
	syncEditorIcon( {
		asset: ASSET,
		position,
		signature: 'a1',
		offsetX: 0,
		offsetY: 0,
	} );

afterEach( () => {
	removeEditorIcon();
	document.body.innerHTML = '';
} );

describe( 'the canvas title and its left edge', () => {
	it.each( [ 'left', 'right', 'top', 'bottom' ] )(
		'reserves no space for a %s icon',
		( position ) => {
			const { wrapper, title } = scene();

			place( position );

			// The wrapper is a positioning context through its class, so it
			// needs no inline style at all — and the heading never had one.
			expect( wrapper.getAttribute( 'style' ) ).toBe( null );
			expect( title.getAttribute( 'style' ) ).toBe( null );
			expect(
				wrapper.classList.contains( 'titlesparks-title-icon-host' )
			).toBe( true );
		}
	);

	it( 'draws the icon beside the heading, out of its text flow', () => {
		const { wrapper, title } = scene();

		place( 'left' );

		const icon = wrapper.querySelector( '[data-titlesparks-editor-icon]' );

		expect( icon ).not.toBe( null );
		// Inside the heading, typing would save the icon into the title.
		expect( title.contains( icon ) ).toBe( false );
		expect( icon.parentElement ).toBe( wrapper );
		expect( icon.nextElementSibling ).toBe( title );
		expect( icon.style.position ).toBe( 'absolute' );
	} );

	it( 'injects a stylesheet that declares no space beside the title', () => {
		scene();

		place( 'left' );

		const css = document.getElementById( STYLE_ID );

		expect( css ).not.toBe( null );
		// The wrapper's positioning context and the image's box are the whole
		// stylesheet. Padding, a margin, a float or an indent would reserve
		// room beside the words the icon is drawn over.
		expect( css.textContent ).not.toMatch(
			/(?:^|[;{])\s*(?:padding|margin|float|text-indent|text-align)(?:-[a-z-]+)?\s*:/i
		);
	} );

	it( 'gives every trace of the pass back when the icon goes', () => {
		const { wrapper, title } = scene();

		place( 'left' );
		removeEditorIcon();

		expect(
			wrapper.classList.contains( 'titlesparks-title-icon-host' )
		).toBe( false );
		expect(
			wrapper.querySelector( '[data-titlesparks-editor-icon]' )
		).toBe( null );
		expect( document.getElementById( STYLE_ID ) ).toBe( null );
		expect( wrapper.getAttribute( 'style' ) ).toBe( null );
		expect( title.getAttribute( 'style' ) ).toBe( null );
	} );
} );
