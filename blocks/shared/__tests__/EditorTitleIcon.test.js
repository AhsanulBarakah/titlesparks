/**
 * EditorTitleIcon store wiring.
 *
 * The component's job is to turn a change in the editor store into a change on
 * the canvas, and that is the layer that cannot be checked by importing the
 * pure helpers: the placement maths was already verified, but nothing proved
 * that editing a stage reaches it.
 *
 * `@wordpress/data` here is the real package — real registry, real `useSelect`,
 * real subscription and equality behaviour — with a fake `core/editor` store
 * registered in it, so the test exercises the actual wiring rather than a
 * stand-in for it. Only the two things a test environment cannot provide are
 * mocked: the DOM side (assertions are about what the component asked for) and
 * the asset library (which would otherwise call the REST API).
 */

import { createRegistry, RegistryProvider } from '@wordpress/data';
import { createRoot } from '@wordpress/element';
import { act } from 'react';

import EditorTitleIcon from '../EditorTitleIcon';
import { removeEditorIcon, syncEditorIcon } from '../editorTitleDom';
import { getPreviewState } from '../editorPreview';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock( '@wordpress/i18n', () => ( {
	__: ( text ) => text,
	sprintf: ( format ) => format,
} ) );

// The editor store is replaced by its name only; the registry below supplies
// the real store, so every other `@wordpress/data` behaviour stays genuine.
jest.mock( '@wordpress/editor', () => ( { store: { name: 'core/editor' } } ) );

// Built inside the factory, not closed over: the component reads the editor
// bootstrap as the module loads, which runs before any module-level test value
// would be initialised.
jest.mock( '../useAssetLibrary', () => {
	const boot = {
		metaKey: 'titlesparks_timeline_schema',
		postDate: '2026-10-01 12:00:00',
		// The post date sits inside stage 1, so stage 1 is the live stage.
		now: Math.floor( Date.parse( '2026-10-01T12:00:00' ) / 1000 ),
		isEnabled: true,
		// The site's stacking order, so the canvas draws the icon where the
		// page does when an offset brings it over the words.
		iconZIndex: 30,
		// The site's size table, which a stage without its own follows.
		sizingRules: [ { font: 12, icon: 10 } ],
		timeline: {},
	};

	return {
		getEditorData: () => boot,
		useAssetLibrary: () => ( {
			assets: [
				{
					id: 'a1',
					url: 'https://example.test/one.gif',
					label: 'One',
					size: '24px',
				},
				{
					id: 'a3',
					url: 'https://example.test/three.gif',
					label: 'Three',
					size: '30px',
				},
			],
			isLoading: false,
		} ),
	};
} );

// Documents the component should look in. The real module reads the admin
// document and the editor canvas iframe; a test only needs the first.
const mockDocuments = [];

jest.mock( '../editorTitleDom', () => ( {
	syncEditorIcon: jest.fn(),
	removeEditorIcon: jest.fn(),
	canvasDocuments: () => mockDocuments,
	editorTitleTarget: () => null,
} ) );

/**
 * A minimal stand-in for the post editor store.
 *
 * @return {Object} Store definition.
 */
const editorStore = () => ( {
	reducer: ( state = { meta: {} }, action ) =>
		'SET_META' === action.type ? { ...state, meta: action.meta } : state,
	actions: {
		setMeta: ( meta ) => ( { type: 'SET_META', meta } ),
	},
	selectors: {
		getEditedPostAttribute: ( state, attribute ) =>
			'meta' === attribute ? state.meta : undefined,
	},
} );

const META_KEY = 'titlesparks_timeline_schema';

/**
 * Post meta in the shape the editor holds it: a field per registered key.
 *
 * The component reads the timeline out of the meta object rather than treating
 * the whole object as the value, so the fixture has to do the same.
 *
 * @param {string[]} positions Position per stage.
 * @param {string[]} assetIds  Asset id per stage.
 * @return {Object} Post meta.
 */
const timelineMeta = ( positions, assetIds ) => ( {
	[ META_KEY ]: JSON.stringify( {
		enabled: true,
		stage_1: {
			asset_id: assetIds[ 0 ] || '',
			position: positions[ 0 ],
			duration: 1,
			unit: 'hours',
		},
		stage_2: {
			asset_id: assetIds[ 1 ] || '',
			position: positions[ 1 ],
			duration: 1,
			unit: 'hours',
		},
		stage_3: {
			asset_id: assetIds[ 2 ] || '',
			position: positions[ 2 ],
			duration: 1,
			unit: 'hours',
		},
		stage_3_behaviour: 'keep',
	} ),
} );

let registry;
let root;

/**
 * Mount the component against the fake editor store.
 *
 * @param {Object} meta Initial post meta.
 * @return {void}
 */
const mount = ( meta ) => {
	mockDocuments.length = 0;
	mockDocuments.push( document );

	registry = createRegistry();
	registry.registerStore( 'core/editor', editorStore() );
	registry.dispatch( 'core/editor' ).setMeta( meta );

	const container = document.createElement( 'div' );

	root = createRoot( container );

	act( () => {
		root.render(
			<RegistryProvider value={ registry }>
				<EditorTitleIcon />
			</RegistryProvider>
		);
	} );
};

/**
 * Change the post meta the way the sidebar does.
 *
 * @param {Object} meta Next meta.
 * @return {void}
 */
const setMeta = ( meta ) => {
	act( () => {
		registry.dispatch( 'core/editor' ).setMeta( meta );
	} );
};

/**
 * The arguments of the most recent canvas update.
 *
 * @return {Object} `{ asset, position, signature }`.
 */
const lastCall = () =>
	syncEditorIcon.mock.calls[ syncEditorIcon.mock.calls.length - 1 ][ 0 ];

beforeEach( () => {
	syncEditorIcon.mockClear();
	removeEditorIcon.mockClear();
} );

afterEach( () => {
	if ( root ) {
		act( () => root.unmount() );
		root = null;
	}
} );

describe( 'EditorTitleIcon', () => {
	it( 'shows the live stage read out of the post meta', () => {
		const meta = timelineMeta(
			[ 'left', 'left', 'right' ],
			[ 'a1', '', 'a3' ]
		);

		mount( meta );

		// The store is the first thing to confirm: if this fails, nothing
		// downstream of it can be trusted.
		expect(
			registry.select( 'core/editor' ).getEditedPostAttribute( 'meta' )
		).toBe( meta );

		expect( syncEditorIcon ).toHaveBeenCalled();
		expect( lastCall().position ).toBe( 'left' );
		expect( lastCall().asset.url ).toBe( 'https://example.test/one.gif' );
	} );

	it( 'mirrors the stage the canvas draws', () => {
		mount( {
			[ META_KEY ]: JSON.stringify( {
				enabled: true,
				stage_1: {
					asset_id: 'a1',
					position: 'left',
					duration: 1,
					unit: 'hours',
					flip: true,
				},
				stage_3_behaviour: 'keep',
			} ),
		} );

		expect( lastCall().asset.flip ).toBe( true );
		// The signature carries the mirror too, so turning it on or off rebuilds
		// the icon rather than leaving the last class in place.
		expect( lastCall().signature ).toContain( 'true' );
	} );

	it( 'passes the site’s stacking order through to the canvas', () => {
		mount( timelineMeta( [ 'left', '', '' ], [ 'a1', '', '' ] ) );

		expect( lastCall().zIndex ).toBe( 30 );
	} );

	it( 'sizes a title-following icon from the stage’s own table', () => {
		mount( {
			[ META_KEY ]: JSON.stringify( {
				enabled: true,
				stage_1: {
					asset_id: 'a1',
					position: 'left',
					duration: 1,
					unit: 'hours',
					size_mode: 'advanced',
					sizing_rules: [
						{ font: 20, icon: 15 },
						{ font: 40, icon: 30 },
					],
				},
				stage_3_behaviour: 'keep',
			} ),
		} );

		expect( lastCall().asset.sizeMode ).toBe( 'advanced' );
		expect( lastCall().sizingRules ).toEqual( [
			{ font: 20, icon: 15 },
			{ font: 40, icon: 30 },
		] );
	} );

	it( 'falls back to the site’s table when the stage has none', () => {
		mount( {
			[ META_KEY ]: JSON.stringify( {
				enabled: true,
				stage_1: {
					asset_id: 'a1',
					position: 'left',
					duration: 1,
					unit: 'hours',
					size_mode: 'advanced',
				},
				stage_3_behaviour: 'keep',
			} ),
		} );

		expect( lastCall().sizingRules ).toEqual( [ { font: 12, icon: 10 } ] );

		// A fixed stage keeps its own size, so the canvas is told not to size
		// it from the bands even though a table is still on hand.
		setMeta( timelineMeta( [ 'left', '', '' ], [ 'a1', '', '' ] ) );

		expect( lastCall().asset.sizeMode ).toBe( 'fixed' );
	} );

	it( 'passes the stored offset through so 0/0 is centred like the front end', () => {
		mount( timelineMeta( [ 'left', '', '' ], [ 'a1', '', '' ] ) );

		// No editor-only nudge: an empty offset reaches the shared placement
		// untouched, so the canvas centres the icon on the title's text just
		// as the front end does. `iconOffset.test.js` checks the centring.
		expect( lastCall().offsetX ).toBe( 0 );
		expect( lastCall().offsetY ).toBe( 0 );
	} );

	it( 'moves the icon it already has when only the nudge changes', () => {
		mount( timelineMeta( [ 'left', '', '' ], [ 'a1', '', '' ] ) );

		const identity = lastCall().signature;

		removeEditorIcon.mockClear();

		setMeta( {
			[ META_KEY ]: JSON.stringify( {
				enabled: true,
				stage_1: {
					asset_id: 'a1',
					position: 'left',
					duration: 1,
					unit: 'hours',
				},
				stage_3_behaviour: 'keep',
				position_offsets: { left: { x: 12, y: -7 } },
			} ),
		} );

		// The icon's identity does not include where it sits, so the canvas
		// re-measures the node it already has. Rebuilding it would restart an
		// animated GIF and re-decode it, which is what made a small nudge read
		// as flicker rather than as movement.
		expect( lastCall().signature ).toBe( identity );
		expect( lastCall().offsetX ).toBe( 12 );
		expect( lastCall().offsetY ).toBe( -7 );
		expect( removeEditorIcon ).not.toHaveBeenCalled();
	} );

	it( 'passes an authored nudge through to the canvas unchanged', () => {
		mount( {
			[ META_KEY ]: JSON.stringify( {
				enabled: true,
				stage_1: {
					asset_id: 'a1',
					position: 'left',
					duration: 1,
					unit: 'hours',
				},
				stage_3_behaviour: 'keep',
				position_offsets: { left: { x: 12, y: -7 } },
			} ),
		} );

		expect( lastCall().offsetX ).toBe( 12 );
		expect( lastCall().offsetY ).toBe( -7 );
	} );

	it( 'moves the icon when the stored position changes', () => {
		mount( timelineMeta( [ 'left', '', '' ], [ 'a1', '', '' ] ) );

		expect( lastCall().position ).toBe( 'left' );

		setMeta( timelineMeta( [ 'right', '', '' ], [ 'a1', '', '' ] ) );

		expect( lastCall().position ).toBe( 'right' );
		expect( lastCall().signature ).toContain( 'right' );
	} );

	it( 'updates the live stage when its position changes', () => {
		mount(
			timelineMeta( [ 'left', 'left', 'right' ], [ 'a1', '', 'a3' ] )
		);

		setMeta(
			timelineMeta( [ 'right', 'left', 'right' ], [ 'a1', '', 'a3' ] )
		);

		expect( lastCall().position ).toBe( 'right' );
	} );

	it( 'keeps the live icon on the resolved stage when a future stage icon changes', () => {
		mount( timelineMeta( [ 'left', '', 'right' ], [ 'a1', '', '' ] ) );

		expect( getPreviewState().stage ).toBe( 1 );
		expect( lastCall().asset.url ).toBe( 'https://example.test/one.gif' );

		setMeta( timelineMeta( [ 'left', '', 'right' ], [ 'a1', '', 'a3' ] ) );

		expect( getPreviewState().stage ).toBe( 1 );
		expect( lastCall().position ).toBe( 'left' );
		expect( lastCall().asset.url ).toBe( 'https://example.test/one.gif' );
	} );

	it( 'reports what the canvas resolved to, for the sidebar readout', () => {
		mount( timelineMeta( [ 'right', '', '' ], [ 'a1', '', '' ] ) );

		expect( getPreviewState() ).toEqual( {
			show: true,
			stage: 1,
			position: 'right',
			label: 'One',
		} );
	} );

	it( 'clears the icon when the post switch is off', () => {
		const off = {
			[ META_KEY ]: JSON.stringify( {
				enabled: false,
				stage_1: {
					asset_id: 'a1',
					position: 'left',
					duration: 1,
					unit: 'hours',
				},
			} ),
		};

		mount( off );

		expect( syncEditorIcon ).not.toHaveBeenCalled();
		expect( removeEditorIcon ).toHaveBeenCalled();
		expect( getPreviewState().show ).toBe( false );
	} );

	it( 'survives meta it cannot read', () => {
		mount( { [ META_KEY ]: 'not json at all' } );

		expect( removeEditorIcon ).toHaveBeenCalled();
	} );

	it( 'ignores a stage whose asset is not in the library', () => {
		mount(
			timelineMeta( [ 'left', '', '' ], [ 'deleted-asset', '', '' ] )
		);

		expect( syncEditorIcon ).not.toHaveBeenCalled();
	} );
} );
