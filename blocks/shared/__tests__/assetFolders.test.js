/**
 * Folders, tags and pages.
 *
 * A folder is a saved question about the library, not a list of members, and
 * these are the functions that answer it. What matters is that the answer is the
 * same as the server's: a tag is normalised here and again in
 * `Security::asset_tag()` before it is stored, and a folder's identifier is
 * derived from its name on both sides — so a tag typed with a capital letter, or
 * a folder whose name was retyped with different spacing, has to land on the
 * value the stored row already holds rather than beside it.
 *
 * The page maths is here for the same reason. A page is a view of a list that
 * changes underneath it: deleting the last card on the last page has to leave a
 * page that exists, not an empty grid over a full library.
 */

import {
	LIBRARY_PAGE_SIZE,
	MAX_ASSET_TAGS,
	assetsInFolder,
	filterAssets,
	folderHas,
	folderId,
	normalizeAssets,
	normalizeFolders,
	paginate,
	sanitizeTag,
	sanitizeTags,
	tagIndex,
} from '../constants';

const ASSETS = normalizeAssets( [
	{
		id: 'a1',
		label: 'Flash',
		url: 'https://example.test/flash.gif',
		tags: [ 'News', 'flash' ],
	},
	{
		id: 'a2',
		label: 'Hot',
		url: 'https://example.test/hot.png',
		tags: [ 'hot news' ],
	},
	{
		id: 'a3',
		label: 'Plain',
		url: 'https://example.test/plain.svg',
	},
	{
		id: 'a4',
		label: 'Both',
		url: 'https://example.test/both.gif',
		tags: [ 'news', 'hot news' ],
	},
] );

const NEWS = { id: 'news', name: 'News', tags: [ 'news' ] };
const HOT = { id: 'hot', name: 'Hot', tags: [ 'hot', 'hot news' ] };

describe( 'a tag', () => {
	it( 'is lower case, single spaced and trimmed', () => {
		expect( sanitizeTag( '  Hot   News  ' ) ).toBe( 'hot news' );
		expect( sanitizeTag( 'NEWS' ) ).toBe( 'news' );
	} );

	it( 'is capped, and empty when there is nothing left', () => {
		expect( sanitizeTag( 'x'.repeat( 80 ) ) ).toHaveLength( 32 );
		expect( sanitizeTag( '   ' ) ).toBe( '' );
		expect( sanitizeTag( null ) ).toBe( '' );
	} );
} );

describe( 'a list of tags', () => {
	it( 'keeps a tag with a space in it whole', () => {
		// The field posts `news, hot news`; the second one is a tag a person
		// typed, not two.
		expect( sanitizeTags( 'news, hot news' ) ).toEqual( [
			'news',
			'hot news',
		] );
	} );

	it( 'drops repeats, whatever case they arrive in', () => {
		expect( sanitizeTags( [ 'News', 'news', 'NEWS' ] ) ).toEqual( [
			'news',
		] );
	} );

	it( 'drops the blanks and caps the count', () => {
		expect( sanitizeTags( [ '', '  ', 'a' ] ) ).toEqual( [ 'a' ] );
		expect(
			sanitizeTags( Array.from( { length: 30 }, ( v, i ) => `t${ i }` ) )
		).toHaveLength( MAX_ASSET_TAGS );
		expect( sanitizeTags( undefined ) ).toEqual( [] );
	} );
} );

describe( 'a folder identifier', () => {
	it( 'is the name, slugged the way the server slugs it', () => {
		expect( folderId( 'News Desk' ) ).toBe( 'news-desk' );
		expect( folderId( '  Hot  News! ' ) ).toBe( 'hot-news' );
	} );

	it( 'is empty for a name with nothing usable in it', () => {
		expect( folderId( '***' ) ).toBe( '' );
	} );
} );

describe( 'the folder list', () => {
	it( 'derives a missing identifier from the name', () => {
		expect( normalizeFolders( [ { name: 'News Desk' } ] ) ).toEqual( [
			{ id: 'news-desk', name: 'News Desk', tags: [] },
		] );
	} );

	it( 'collapses two folders that would be the same folder', () => {
		const folders = normalizeFolders( [
			{ name: 'News' },
			{ name: 'News', tags: [ 'news' ] },
		] );

		expect( folders ).toHaveLength( 1 );
		expect( folders[ 0 ].tags ).toEqual( [ 'news' ] );
	} );

	it( 'drops anything without a name, and survives rubbish', () => {
		expect( normalizeFolders( [ { tags: [ 'a' ] }, null, 'x' ] ) ).toEqual(
			[]
		);
		expect( normalizeFolders( undefined ) ).toEqual( [] );
	} );
} );

describe( 'what a folder holds', () => {
	it( 'is the assets carrying any one of its tags', () => {
		// A union: naming a second tag widens the folder rather than narrowing
		// it to assets tagged both ways.
		expect( assetsInFolder( ASSETS, HOT ).map( ( a ) => a.id ) ).toEqual( [
			'a2',
			'a4',
		] );
	} );

	it( 'is case insensitive, because the tags were normalised', () => {
		expect( assetsInFolder( ASSETS, NEWS ).map( ( a ) => a.id ) ).toEqual( [
			'a1',
			'a4',
		] );
	} );

	it( 'is nothing at all for a folder with no tags', () => {
		expect( folderHas( { id: 'empty', tags: [] }, ASSETS[ 0 ] ) ).toBe(
			false
		);
		expect( assetsInFolder( ASSETS, { id: 'empty', tags: [] } ) ).toEqual(
			[]
		);
	} );

	it( 'is the whole library when no folder is chosen', () => {
		expect( assetsInFolder( ASSETS, null ) ).toHaveLength( 4 );
	} );
} );

describe( 'filtering the library', () => {
	it( 'starts from the folder, then the type, then the words', () => {
		// A query matches a tag by substring, so `news` finds a2 as well: its tag
		// is `hot news`, and someone looking for news wants it.
		expect(
			filterAssets( ASSETS, 'all', 'news' ).map( ( a ) => a.id )
		).toEqual( [ 'a1', 'a2', 'a4' ] );
		expect(
			filterAssets( ASSETS, 'gif', '', NEWS ).map( ( a ) => a.id )
		).toEqual( [ 'a1', 'a4' ] );
		expect(
			filterAssets( ASSETS, 'icon', '', HOT ).map( ( a ) => a.id )
		).toEqual( [ 'a2' ] );
	} );

	it( 'still finds an asset by its label', () => {
		expect(
			filterAssets( ASSETS, 'all', 'plain' ).map( ( a ) => a.id )
		).toEqual( [ 'a3' ] );
	} );
} );

describe( 'the tag index', () => {
	it( 'lists every tag in use, A-Z, with its count', () => {
		expect( tagIndex( ASSETS ) ).toEqual( [
			{ tag: 'flash', count: 1 },
			{ tag: 'hot news', count: 2 },
			{ tag: 'news', count: 2 },
		] );
	} );
} );

describe( 'paging a list', () => {
	const list = Array.from( { length: 14 }, ( v, i ) => i + 1 );

	it( 'shows eight at a time, four to a row and two rows', () => {
		expect( LIBRARY_PAGE_SIZE ).toBe( 8 );

		const first = paginate( list, 1 );

		expect( first.items ).toEqual( [ 1, 2, 3, 4, 5, 6, 7, 8 ] );
		expect( first.pageCount ).toBe( 2 );
		expect( first.from ).toBe( 1 );
		expect( first.to ).toBe( 8 );
		expect( first.total ).toBe( 14 );
	} );

	it( 'shows the rest on the last page', () => {
		const last = paginate( list, 2 );

		expect( last.items ).toHaveLength( 6 );
		expect( last.from ).toBe( 9 );
		expect( last.to ).toBe( 14 );
	} );

	it( 'clamps a page past the end, so a shorter list still shows something', () => {
		// Deleting the last card on the last page calls this with page 2 on a
		// list that is now one page long.
		const clamped = paginate( [ 1, 2, 3 ], 2 );

		expect( clamped.page ).toBe( 1 );
		expect( clamped.items ).toEqual( [ 1, 2, 3 ] );
	} );

	it( 'treats an empty list as one empty page, not zero pages', () => {
		const empty = paginate( [], 1 );

		expect( empty.pageCount ).toBe( 1 );
		expect( empty.items ).toEqual( [] );
		expect( empty.from ).toBe( 0 );
	} );
} );
