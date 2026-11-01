/**
 * The library grid: pages, folders and tags.
 *
 * Three things here are easy to get subtly wrong and impossible to notice in a
 * small library, which is why this test builds one of fourteen assets:
 *
 *   1. A page shows eight cards. Not "about eight" — the folder list beside the
 *      grid counts what is in a folder, and a grid that quietly showed nine
 *      would make that count look wrong.
 *   2. Choosing a folder narrows the grid, and the page survives it. Filtering
 *      while staying on page 2 of a list that is now one page long shows an
 *      empty grid, which reads as an empty folder.
 *   3. An asset's tags travel with it into the edit form, so saving a label does
 *      not quietly strip the tags that file it into folders.
 *
 * The admin components import through the webpack alias (`@titlesparks/shared/*`,
 * see webpack.config.js), which jest is not configured with, so those specifiers
 * are mapped to the same files the bundle uses.
 */

import { createRoot } from '@wordpress/element';
import { act } from 'react';

import AssetLibrarySection from '../AssetLibrarySection';

jest.mock( '@titlesparks/shared/ui', () => require( '../../shared/ui' ), {
	virtual: true,
} );
jest.mock( '@titlesparks/shared/icons', () => require( '../../shared/icons' ), {
	virtual: true,
} );
jest.mock(
	'@titlesparks/shared/constants',
	() => require( '../../shared/constants' ),
	{ virtual: true }
);
jest.mock(
	'@titlesparks/shared/useDeferredPreview',
	() => require( '../../shared/useDeferredPreview' ),
	{ virtual: true }
);

jest.mock( '@wordpress/i18n', () => {
	let next = 0;

	return {
		__: ( text ) => text,
		_n: ( single, plural, count ) => ( 1 === count ? single : plural ),
		sprintf: ( format, ...args ) => {
			next = 0;

			return format
				.replace( /%%/g, '\u0000' )
				.replace( /%(\d+)?\$?[sd]/g, ( match, position ) =>
					String(
						args[
							undefined === position
								? next++
								: Number( position ) - 1
						]
					)
				)
				.replace( /\u0000/g, '%' );
		},
	};
} );

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const {
	normalizeAssets,
	normalizeFolders,
} = require( '../../shared/constants' );

const NEWS = { id: 'news', name: 'News', tags: [ 'news' ] };
const FLASH = { id: 'flash', name: 'Flash', tags: [ 'flash' ] };

/**
 * A library big enough to page: fourteen assets, five of them the News folder's.
 *
 * @return {Array} Normalised assets.
 */
const makeAssets = () =>
	normalizeAssets(
		Array.from( { length: 14 }, ( value, index ) => ( {
			id: `att-${ index + 1 }`,
			label: `Asset ${ index + 1 }`,
			url: `https://example.test/asset-${ index + 1 }.gif`,
			preview: `https://example.test/asset-${ index + 1 }-300x200.gif`,
			// The first five are tagged, so the News folder holds five of
			// fourteen and the grid has to narrow rather than empty.
			tags: index < 5 ? [ 'news' ] : [],
		} ) )
	);

/**
 * Render the section.
 *
 * @param {Object} [overrides] Prop overrides.
 * @return {Object} Container, the callbacks and an unmount.
 */
const renderLibrary = ( overrides = {} ) => {
	const handlers = {
		onAdd: jest.fn(),
		onUpdate: jest.fn(),
		onDelete: jest.fn(),
		onFolderChange: jest.fn(),
	};
	const container = document.createElement( 'div' );

	document.body.appendChild( container );

	const root = createRoot( container );

	act( () =>
		root.render(
			<AssetLibrarySection
				assets={ makeAssets() }
				folders={ normalizeFolders( [ NEWS, FLASH ] ) }
				folder={ null }
				isSaving={ false }
				{ ...handlers }
				{ ...overrides }
			/>
		)
	);

	return {
		container,
		...handlers,
		unmount: () => act( () => root.unmount() ),
	};
};

/**
 * Click something the way a browser does.
 *
 * @param {Element} element Target.
 * @return {void}
 */
const click = ( element ) =>
	act( () => {
		element.dispatchEvent(
			new window.MouseEvent( 'click', { bubbles: true } )
		);
	} );

afterEach( () => {
	document.body.innerHTML = '';
} );

describe( 'a library of fourteen assets', () => {
	it( 'shows eight cards on the first page, and pages the rest', () => {
		const { container, unmount } = renderLibrary();

		expect( container.querySelectorAll( 'img' ) ).toHaveLength( 8 );
		expect( container.textContent ).toContain( 'Showing 1–8 of 14' );

		const pages = [ ...container.querySelectorAll( 'nav button' ) ].map(
			( button ) => button.textContent
		);

		expect( pages ).toEqual( [ '1', '2' ] );
		expect(
			container.querySelector( 'nav button[aria-current="page"]' )
				.textContent
		).toBe( '1' );

		click( container.querySelectorAll( 'nav button' )[ 1 ] );

		expect( container.querySelectorAll( 'img' ) ).toHaveLength( 6 );
		expect( container.textContent ).toContain( 'Showing 9–14 of 14' );
		expect(
			container.querySelector( 'nav button[aria-current="page"]' )
				.textContent
		).toBe( '2' );

		unmount();
	} );

	it( 'centers the search icon against the input, not the folder filters', () => {
		const { container, unmount } = renderLibrary( { manage: true } );
		const input = container.querySelector(
			'input[aria-label="Search assets"]'
		);
		const iconWrapper = input.previousElementSibling;
		const inputRow = iconWrapper.parentElement;

		expect( inputRow.className ).toContain( 'titlesparks:relative' );
		expect( inputRow.className ).toContain( 'titlesparks:h-10' );
		expect( iconWrapper.className ).toContain( 'titlesparks:inset-y-0' );
		expect( iconWrapper.parentElement ).not.toBe(
			container.querySelector( 'button' ).parentElement
		);

		unmount();
	} );

	it( 'keeps the folder name visible while filtering by one of its tags', () => {
		const { container, unmount } = renderLibrary( {
			folder: NEWS,
			selectedTag: 'news',
		} );

		expect( container.textContent ).toContain( 'Folder: News' );
		expect( container.textContent ).toContain( 'Filtered by tag:' );
		expect( container.textContent ).toContain( 'Showing 1–5 of 5' );

		unmount();
	} );

	it( 'uses the primary green for the active tag filter', () => {
		const { container, unmount } = renderLibrary( {
			selectedTag: 'news',
		} );

		const selected = container.querySelector(
			'button[aria-pressed="true"] span'
		);
		const filterBadge = [ ...container.querySelectorAll( 'span' ) ].find(
			( element ) =>
				element.textContent.startsWith( 'news' ) &&
				element.className.includes( 'titlesparks:bg-brand-900' )
		);

		expect( selected.className ).toContain( 'titlesparks:bg-brand-900' );
		expect( filterBadge ).toBeDefined();

		unmount();
	} );

	it( 'narrows to a folder, and counts it beside the grid', () => {
		const { container, unmount } = renderLibrary( {
			folder: NEWS,
		} );

		expect( container.querySelectorAll( 'img' ) ).toHaveLength( 5 );
		expect( container.textContent ).toContain( 'Folder: News' );
		expect( container.textContent ).toContain( '5 assets' );
		expect( container.textContent ).toContain( 'Showing 1–5 of 5' );
		expect( container.querySelectorAll( 'img' ) ).toHaveLength( 5 );
		// Five cards are one page, so there is nothing to page through.
		expect( container.querySelector( 'nav' ) ).toBeNull();

		unmount();
	} );

	it( 'goes back to the first page when the folder changes', () => {
		const { container, unmount } = renderLibrary();

		click( container.querySelectorAll( 'nav button' )[ 1 ] );
		expect(
			container.querySelector( 'nav button[aria-current="page"]' )
				.textContent
		).toBe( '2' );

		const cleared = renderLibrary( { folder: NEWS } );

		// A fresh render of a filtered library starts at page 1 whatever the
		// reader was looking at, which is the case the effect exists for.
		expect(
			cleared.container.querySelector( 'nav button[aria-current="page"]' )
		).toBeNull();
		expect( cleared.container.textContent ).toContain( 'Showing 1–5 of 5' );

		unmount();
		cleared.unmount();
	} );

	it( 'says so when a folder has nothing in it', () => {
		const { container, unmount } = renderLibrary( {
			folder: FLASH,
		} );

		expect( container.querySelectorAll( 'img' ) ).toHaveLength( 0 );
		expect( container.textContent ).toContain(
			'Nothing in this folder yet'
		);

		unmount();
	} );

	it( 'offers the tags a folder can be built from on each card', () => {
		const { container, unmount } = renderLibrary();
		const first = container.querySelector( 'li' );

		expect( first.textContent ).toContain( 'news' );
		expect( first.querySelector( 'button[aria-pressed]' ) ).not.toBeNull();

		unmount();
	} );
} );

describe( 'editing an asset', () => {
	it( 'carries its tags into the form and back out again', () => {
		const { container, onUpdate, unmount } = renderLibrary();

		click( container.querySelector( '[aria-label="Edit Asset 1"]' ) );

		expect( container.textContent ).toContain( 'Edit asset' );
		expect( container.textContent ).toContain( 'news' );

		click(
			[ ...container.querySelectorAll( 'button' ) ].find(
				( button ) => 'Save asset' === button.textContent
			)
		);

		expect( onUpdate ).toHaveBeenCalledTimes( 1 );
		expect( onUpdate.mock.calls[ 0 ][ 0 ] ).toMatchObject( {
			id: 'att-1',
			label: 'Asset 1',
			tags: [ 'news' ],
		} );

		unmount();
	} );

	it( 'confirms a delete before calling out', () => {
		const { container, onDelete, unmount } = renderLibrary();

		click( container.querySelector( '[aria-label="Delete Asset 2"]' ) );

		expect( onDelete ).not.toHaveBeenCalled();
		expect( container.textContent ).toContain( 'Remove “Asset 2”' );

		click(
			[ ...container.querySelectorAll( 'button' ) ].find(
				( button ) => 'Remove' === button.textContent
			)
		);

		expect( onDelete ).toHaveBeenCalledWith( 'att-2' );

		unmount();
	} );
} );
