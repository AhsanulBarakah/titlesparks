/**
 * The folder panel.
 *
 * A folder is made of tags, and the panel is the only place they are chosen, so
 * what it sends has to be exactly what the author typed: a name to be slugged
 * into an identifier, and the tags the folder collects. It also has to be clear
 * about the two things a tag-only folder can surprise you with — that a folder
 * with no tags holds nothing, and that deleting one takes no assets with it.
 *
 * The admin components import through the webpack alias (`@titlesparks/shared/*`,
 * see webpack.config.js), which jest is not configured with, so those specifiers
 * are mapped to the same files the bundle uses.
 */

import { createRoot } from '@wordpress/element';
import { act } from 'react';

import AssetFolders from '../AssetFolders';

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

const FOLDERS = normalizeFolders( [
	{ id: 'news', name: 'News', tags: [ 'news' ] },
	{ id: 'empty', name: 'Waiting' },
] );

const ASSETS = normalizeAssets( [
	{
		id: 'a1',
		label: 'Flash',
		url: 'https://example.test/flash.gif',
		tags: [ 'news' ],
	},
	{
		id: 'a2',
		label: 'Hot',
		url: 'https://example.test/hot.gif',
		tags: [ 'news', 'hot' ],
	},
	{
		id: 'a3',
		label: 'Plain',
		url: 'https://example.test/plain.gif',
	},
] );

/**
 * Render the panel.
 *
 * @param {Object} [overrides] Prop overrides.
 * @return {Object} Container, the callbacks and an unmount.
 */
const renderFolders = ( overrides = {} ) => {
	const handlers = {
		onSelect: jest.fn(),
		onSave: jest.fn(),
		onDelete: jest.fn(),
	};
	const container = document.createElement( 'div' );

	document.body.appendChild( container );

	const root = createRoot( container );

	act( () =>
		root.render(
			<AssetFolders
				folders={ FOLDERS }
				assets={ ASSETS }
				active=""
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

/**
 * Find a button by its visible text.
 *
 * @param {Element} container Root element.
 * @param {string}  label     Text to match.
 * @return {Element|undefined} The matching button, or undefined.
 */
const button = ( container, label ) =>
	[ ...container.querySelectorAll( 'button' ) ].find(
		( element ) => element.textContent.trim() === label
	);

/**
 * Set a control's value the way a browser does.
 *
 * @param {Element} element Input.
 * @param {string}  value   Next value.
 * @return {void}
 */
const type = ( element, value ) => {
	const setter = Object.getOwnPropertyDescriptor(
		window.HTMLInputElement.prototype,
		'value'
	).set;

	act( () => {
		setter.call( element, value );
		element.dispatchEvent( new window.Event( 'input', { bubbles: true } ) );
		element.dispatchEvent(
			new window.Event( 'change', { bubbles: true } )
		);
	} );
};

afterEach( () => {
	document.body.innerHTML = '';
} );

describe( 'the folder list', () => {
	it( 'counts each folder, and the library it comes from', () => {
		const { container, unmount } = renderFolders();

		expect( container.textContent ).toContain( 'Folders' );
		expect( container.textContent ).toContain(
			'Group the library by tag. An icon joins every folder that watches one of its tags.'
		);
		expect( container.textContent ).toContain( 'All assets' );
		expect( container.textContent ).toContain( 'News' );
		expect( container.textContent ).toContain( 'news' );
		expect( container.textContent ).toContain( '2' );
		expect( container.querySelectorAll( 'svg' ).length ).toBeGreaterThan(
			0
		);
		expect( button( container, 'All assets3' ) ).toBeDefined();

		const newsRow = container.querySelector( 'li:nth-child(2)' );
		const folderButton = newsRow.querySelector( 'button' );
		const folderIcon = folderButton.querySelector( 'svg' ).parentElement;

		expect( newsRow.querySelector( 'img' ) ).toBeNull();
		expect( folderButton.textContent ).toContain( 'News' );
		expect( newsRow.className ).toContain( 'titlesparks:border-amber-300' );
		expect( newsRow.className ).not.toContain(
			'titlesparks-border-transparent'
		);
		expect( folderIcon.className ).toContain( 'titlesparks:bg-amber-100' );
		expect( folderIcon.className ).toContain( 'titlesparks:text-red-900' );

		unmount();
	} );

	it( 'says when a folder has no tags, because it will hold nothing', () => {
		const { container, unmount } = renderFolders();

		expect( container.textContent ).toContain(
			'No tags yet — this folder is empty.'
		);

		unmount();
	} );

	it( 'marks the folder being shown', () => {
		const { container, unmount } = renderFolders( { active: 'news' } );

		const current = container.querySelector( '[aria-current="true"]' );

		expect( current.textContent ).toContain( 'News' );
		expect( current.parentElement.className ).toContain(
			'titlesparks:bg-amber-300'
		);
		expect( current.parentElement.className ).toContain(
			'titlesparks:border-amber-400'
		);
		expect(
			current.querySelector( 'svg' ).parentElement.className
		).toContain( 'titlesparks:bg-amber-500' );

		unmount();
	} );

	it( 'hands the tag and its folder id to the dashboard', () => {
		const onTagClick = jest.fn();
		const { container, unmount } = renderFolders( {
			onTagClick,
			selectedTag: 'news',
		} );

		const tagButton = button( container, 'news' );
		click( tagButton );

		expect( onTagClick ).toHaveBeenCalledWith( 'news', 'news' );
		expect( tagButton.querySelector( 'span' ).className ).toContain(
			'titlesparks:bg-brand-900'
		);

		unmount();
	} );

	it( 'hands a folder choice to the dashboard', () => {
		const { container, onSelect, unmount } = renderFolders();

		click(
			[ ...container.querySelectorAll( 'button' ) ].find( ( element ) =>
				element.textContent.includes( 'News' )
			)
		);

		expect( onSelect ).toHaveBeenCalledWith( 'news' );

		unmount();
	} );
} );

describe( 'creating a folder', () => {
	it( 'sends the name and the tags it collects', () => {
		const { container, onSave, unmount } = renderFolders();

		click( button( container, 'New' ) );
		expect( container.textContent ).toContain( 'New folder' );

		type( container.querySelector( 'input[type="text"]' ), 'Hot News' );

		// A tag that is already in use, chosen from the suggestions rather than
		// typed, so it cannot drift from the tag it is meant to match.
		click(
			[ ...container.querySelectorAll( 'button' ) ].find(
				( element ) => 'news2' === element.textContent.trim()
			)
		);

		click( button( container, 'Create folder' ) );

		expect( onSave ).toHaveBeenCalledWith( {
			id: '',
			name: 'Hot News',
			tags: [ 'news' ],
		} );

		unmount();
	} );

	it( 'takes a typed tag as well, so a new folder can start a new tag', () => {
		const { container, onSave, unmount } = renderFolders();

		click( button( container, 'New' ) );
		type( container.querySelector( 'input[type="text"]' ), 'Sports' );

		type(
			container.querySelector( '[placeholder="Add a tag…"]' ),
			'Match'
		);
		click( button( container, 'Add' ) );

		click( button( container, 'Create folder' ) );

		expect( onSave ).toHaveBeenCalledWith( {
			id: '',
			name: 'Sports',
			tags: [ 'match' ],
		} );

		unmount();
	} );

	it( 'cannot be created without a name', () => {
		const { container, onSave, unmount } = renderFolders();

		click( button( container, 'New' ) );
		click( button( container, 'Create folder' ) );

		expect( onSave ).not.toHaveBeenCalled();

		unmount();
	} );
} );

describe( 'editing and deleting', () => {
	it( 'opens the folder with its own tags', () => {
		const { container, onSave, unmount } = renderFolders();

		click( container.querySelector( '[aria-label="Edit News"]' ) );

		expect( container.querySelector( 'input[type="text"]' ).value ).toBe(
			'News'
		);

		click( button( container, 'Save folder' ) );

		expect( onSave ).toHaveBeenCalledWith( {
			id: 'news',
			name: 'News',
			tags: [ 'news' ],
		} );

		unmount();
	} );

	it( 'says that deleting a folder leaves the assets alone', () => {
		const { container, onDelete, unmount } = renderFolders();

		click( container.querySelector( '[aria-label="Delete News"]' ) );

		expect( onDelete ).not.toHaveBeenCalled();
		expect( container.textContent ).toContain( 'only the folder goes' );
		expect( container.textContent ).toContain( '2 assets are in it' );

		click( button( container, 'Delete' ) );

		expect( onDelete ).toHaveBeenCalledWith( 'news' );

		unmount();
	} );
} );
