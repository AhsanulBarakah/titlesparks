/**
 * The default stages on the settings screen.
 *
 * They are edited the way a stage is edited in the post editor — by the date
 * and time the icon stops — but what gets saved is still a length, because that
 * is what the front end reads for a post that has not been published yet. So
 * the two things worth checking are that the fields show real calendar dates
 * counted from the timeline start, and that picking one writes the length it
 * implies rather than the date.
 *
 * Admin component module mocks resolve to the same shared source modules used
 * by the webpack bundle.
 */

import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock( '../shared/ui', () => require( '../../shared/ui' ), {
	virtual: true,
} );
jest.mock( '../shared/icons', () => require( '../../shared/icons' ), {
	virtual: true,
} );
jest.mock( '../shared/constants', () => require( '../../shared/constants' ), {
	virtual: true,
} );
jest.mock( '../shared/stageDates', () => require( '../../shared/stageDates' ), {
	virtual: true,
} );

import DefaultSettings from '../DefaultSettings';

// Enough of `@wordpress/i18n` to render real sentences: the assertions below
// are about the words an author reads, so `%d` and `%s` have to be filled in.
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

const { emptyTimeline } = require( '../../shared/constants' );

const ANCHOR = '2026-10-01 12:00:00';

/**
 * A settings draft with the shipped default lengths.
 *
 * @return {Object} Draft.
 */
const makeDraft = () => ( {
	enabled: true,
	post_types: [ 'post' ],
	display_locations: {
		singular: true,
		home: true,
		archive: true,
		search: true,
	},
	widget_display: {},
	section_display: {},
	default_stage_1: {
		asset_id: '',
		position: 'left',
		duration: 1,
		unit: 'days',
	},
	default_stage_2: {
		asset_id: '',
		position: 'left',
		duration: 2,
		unit: 'days',
	},
	default_stage_3: {
		asset_id: '',
		position: 'left',
		duration: 7,
		unit: 'days',
	},
	default_behaviour: 'keep',
	tight_fit: 'keep',
	icon_anchor: 'first_line',
	icon_z_index: 0,
	anchor_source: 'post',
	anchor_datetime: '',
} );

/**
 * Render the card.
 *
 * @param {Object} [overrides] Draft overrides.
 * @return {Object} Container, setDraft and an unmount.
 */
const renderSettings = ( overrides = {} ) => {
	const draft = { ...makeDraft(), ...overrides };
	const setDraft = jest.fn();
	const container = document.createElement( 'div' );

	document.body.appendChild( container );

	const root = createRoot( container );

	act( () =>
		root.render(
			<DefaultSettings
				draft={ draft }
				setDraft={ setDraft }
				timeline={ emptyTimeline( {
					stage_1: draft.default_stage_1,
					stage_2: draft.default_stage_2,
					stage_3: draft.default_stage_3,
					stage_3_behaviour: draft.default_behaviour,
				} ) }
				postTypes={ [
					{ value: 'post', label: 'Post' },
					{ value: 'page', label: 'Page' },
				] }
				widgets={ overrides.widgets || [] }
				sections={ overrides.sections || [] }
				theme={ overrides.theme || {} }
				anchorDate={ ANCHOR }
				onRescan={ overrides.onRescan }
				scanning={ overrides.scanning }
			/>
		)
	);

	return {
		container,
		draft,
		setDraft,
		unmount: () => act( () => root.unmount() ),
	};
};

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

describe( 'the tight-card switch', () => {
	it( 'is one switch, off by default', () => {
		const { container, unmount } = renderSettings();
		const control = container.querySelector( '#titlesparks-tight-fit' );

		// `keep` is the shipped default, so an untouched site draws every icon
		// exactly where the author placed it.
		expect( control ).not.toBeNull();
		expect( control.getAttribute( 'role' ) ).toBe( 'switch' );
		expect( control.getAttribute( 'aria-checked' ) ).toBe( 'false' );
		// The four answers are gone; the switch is the whole control.
		expect(
			container.querySelectorAll( 'input[name="titlesparks-tight-fit"]' )
		).toHaveLength( 0 );

		unmount();
	} );

	it( 'stores `shrink` when switched on', () => {
		const { container, setDraft, unmount } = renderSettings();

		act( () =>
			container.querySelector( '#titlesparks-tight-fit' ).click()
		);

		const next = setDraft.mock.calls[ 0 ][ 0 ]( makeDraft() );

		expect( next.tight_fit ).toBe( 'shrink' );

		unmount();
	} );

	it( 'stores `keep` when switched off again', () => {
		const { container, setDraft, unmount } = renderSettings( {
			tight_fit: 'shrink',
		} );
		const control = container.querySelector( '#titlesparks-tight-fit' );

		expect( control.getAttribute( 'aria-checked' ) ).toBe( 'true' );

		act( () => control.click() );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( makeDraft() );

		expect( next.tight_fit ).toBe( 'keep' );

		unmount();
	} );

	it( 'draws a retired answer as off, never as a fit', () => {
		// A site that chose `hide` while that answer existed must not have an
		// icon dropped behind its author's back.
		[ 'hide', 'nonsense' ].forEach( ( tightFit ) => {
			const { container, unmount } = renderSettings( {
				tight_fit: tightFit,
			} );

			expect(
				container
					.querySelector( '#titlesparks-tight-fit' )
					.getAttribute( 'aria-checked' )
			).toBe( 'false' );

			unmount();
		} );
	} );
} );

describe( 'what the icon lines up with', () => {
	/**
	 * The anchor answers, in the order they are offered.
	 *
	 * @param {Element} container Rendered card.
	 * @return {Array} Radio inputs.
	 */
	const answers = ( container ) => [
		...container.querySelectorAll(
			'input[name="titlesparks-icon-anchor"]'
		),
	];

	it( 'offers the first line first, because that is what the offsets count from', () => {
		const { container, unmount } = renderSettings();
		const radios = answers( container );

		expect( radios.map( ( radio ) => radio.value ) ).toEqual( [
			'first_line',
			'last_line',
			'block',
		] );
		expect( radios[ 0 ].checked ).toBe( true );

		// Each choice says what happens to a title that wraps, which is the
		// whole point of the setting.
		const sentences = radios.map( ( radio ) =>
			radio.closest( 'label' ).textContent.trim()
		);

		expect( sentences[ 0 ] ).toContain( 'stays on the first line' );
		expect( sentences[ 1 ] ).toContain( 'stays on the last line' );
		expect( sentences[ 2 ] ).toContain(
			'wrapped title pushes the icon down'
		);

		unmount();
	} );

	it( 'stores the anchor the author picks', () => {
		const { container, setDraft, unmount } = renderSettings();
		const block = answers( container ).find(
			( radio ) => 'block' === radio.value
		);

		act( () => {
			block.click();
		} );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( makeDraft() );

		expect( next.icon_anchor ).toBe( 'block' );

		unmount();
	} );

	it( 'stores the last line when the author picks it', () => {
		const { container, setDraft, unmount } = renderSettings();
		const last = answers( container ).find(
			( radio ) => 'last_line' === radio.value
		);

		act( () => {
			last.click();
		} );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( makeDraft() );

		expect( next.icon_anchor ).toBe( 'last_line' );

		unmount();
	} );

	it( 'shows the first line when a settings row predates the control', () => {
		const { container, unmount } = renderSettings( {
			icon_anchor: undefined,
		} );

		expect(
			answers( container ).find( ( radio ) => radio.checked ).value
		).toBe( 'first_line' );

		unmount();
	} );
} );

describe( 'the icon’s stacking order', () => {
	/**
	 * The stacking-order field.
	 *
	 * @param {Element} container Rendered card.
	 * @return {Element} Number input.
	 */
	const field = ( container ) =>
		container.querySelector( 'input[type="number"]' );

	it( 'starts at the page’s normal order, and says what the number means', () => {
		const { container, unmount } = renderSettings();
		const input = field( container );

		expect( input.value ).toBe( '0' );
		expect( input.step ).toBe( '1' );

		// "Stacking order" alone does not tell an author what 0 does, or that
		// the number is the same one their theme's CSS calls z-index.
		expect( container.textContent ).toContain( 'z-index' );
		expect( container.textContent ).toContain(
			'0 is the page’s normal order'
		);

		unmount();
	} );

	it( 'shows what the site has stored', () => {
		const { container, unmount } = renderSettings( {
			icon_z_index: 30,
		} );

		expect( field( container ).value ).toBe( '30' );

		unmount();
	} );

	it( 'stores the number the author types, for the server to bound', () => {
		const { container, setDraft, unmount } = renderSettings();

		type( field( container ), '25' );

		expect( setDraft ).toHaveBeenCalledTimes( 1 );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( makeDraft() );

		expect( next.icon_z_index ).toBe( '25' );

		unmount();
	} );
} );

describe( 'the default stages', () => {
	it( 'show the end each length lands on, counted from the anchor', () => {
		const { container, unmount } = renderSettings();
		const ends = [
			...container.querySelectorAll( 'input[type="datetime-local"]' ),
		];

		// Stage 1: a day after the start; stage 2: three days after (1 + 2);
		// stage 3: ten days after (1 + 2 + 7).
		expect( ends.map( ( end ) => end.value ) ).toEqual( [
			'2026-10-02T12:00',
			'2026-10-04T12:00',
			'2026-10-11T12:00',
		] );

		// The window and the length in words sit under each field.
		expect( container.textContent ).toContain( '1 day' );
		expect( container.textContent ).toContain( '2 days' );

		unmount();
	} );

	it( 'offers only the two sides as the default position', () => {
		const { container, unmount } = renderSettings();
		const position = [ ...container.querySelectorAll( 'select' ) ].find(
			( select ) =>
				[ ...select.options ].some(
					( option ) => option.value === 'left'
				)
		);

		expect(
			[ ...position.options ].map( ( option ) => option.value )
		).toEqual( [ 'left', 'right' ] );

		unmount();
	} );

	it( 'cannot end before the stage starts', () => {
		const { container, unmount } = renderSettings();
		const ends = [
			...container.querySelectorAll( 'input[type="datetime-local"]' ),
		];

		expect( ends[ 0 ].min ).toBe( '2026-10-01T12:00' );
		expect( ends[ 1 ].min ).toBe( '2026-10-02T12:00' );

		unmount();
	} );

	it( 'save a length, not a date', () => {
		const { container, setDraft, unmount } = renderSettings();
		const ends = [
			...container.querySelectorAll( 'input[type="datetime-local"]' ),
		];

		// Two days after the start is a length of two days.
		type( ends[ 0 ], '2026-10-03T12:00' );

		expect( setDraft ).toHaveBeenCalledTimes( 1 );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( makeDraft() );

		expect( next.default_stage_1 ).toEqual( {
			asset_id: '',
			position: 'left',
			flip: false,
			duration: 2,
			unit: 'days',
			size: '',
			size_mode: 'fixed',
			sizing_rules: [],
		} );

		unmount();
	} );

	it( 'measure a stage from where the one before it ends', () => {
		const { container, setDraft, unmount } = renderSettings();
		const ends = [
			...container.querySelectorAll( 'input[type="datetime-local"]' ),
		];

		// Stage 2 starts 1 day in, so ending 4 days in makes it 3 days long —
		// not the 4 days the whole timeline would measure.
		type( ends[ 1 ], '2026-10-05T12:00' );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( makeDraft() );

		expect( next.default_stage_2.duration ).toBe( 3 );
		expect( next.default_stage_2.unit ).toBe( 'days' );

		unmount();
	} );

	it( 'keep a half hour exact, in minutes', () => {
		const { container, setDraft, unmount } = renderSettings();
		const ends = [
			...container.querySelectorAll( 'input[type="datetime-local"]' ),
		];

		type( ends[ 0 ], '2026-10-01T12:45' );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( makeDraft() );

		expect( next.default_stage_1.unit ).toBe( 'minutes' );
		expect( next.default_stage_1.duration ).toBe( 45 );

		unmount();
	} );

	it( 'skip a stage left with no end', () => {
		const { container, setDraft, unmount } = renderSettings();
		const ends = [
			...container.querySelectorAll( 'input[type="datetime-local"]' ),
		];

		type( ends[ 1 ], '' );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( makeDraft() );

		expect( next.default_stage_2.duration ).toBe( 0 );

		unmount();
	} );

	it( 'say which moment the dates are counted from', () => {
		const fixed = renderSettings( {
			anchor_source: 'fixed',
			anchor_datetime: '2026-06-01T09:00',
		} );

		expect( fixed.container.textContent ).toContain(
			'counted from your timeline start'
		);
		fixed.unmount();

		const fromPost = renderSettings();

		expect( fromPost.container.textContent ).toContain(
			'counted from now'
		);
		fromPost.unmount();
	} );

	it( 'offer independent controls for singular, home, archive and search contexts', () => {
		const { container, setDraft, unmount } = renderSettings();
		const checkboxes = [
			...container.querySelectorAll( 'input[type="checkbox"]' ),
		];

		expect( checkboxes ).toHaveLength( 6 );
		expect(
			checkboxes.slice( 2 ).map( ( input ) => input.checked )
		).toEqual( [ true, true, true, true ] );

		act( () => checkboxes[ 4 ].click() );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( makeDraft() );

		expect( next.display_locations ).toEqual( {
			singular: true,
			home: true,
			archive: false,
			search: true,
		} );

		// Search results are their own switch: turning archives off leaves
		// them showing icons, and turning them off leaves archives alone.
		act( () => checkboxes[ 5 ].click() );

		expect(
			setDraft.mock.calls[ 1 ][ 0 ]( makeDraft() ).display_locations
		).toEqual( {
			singular: true,
			home: true,
			archive: true,
			search: false,
		} );

		unmount();
	} );

	it( 'shows active widget choices and stores each widget choice separately', () => {
		const { container, setDraft, unmount } = renderSettings( {
			sections: [
				{ id: 'theme-main-featured', name: 'Main Featured' },
				{ id: 'theme-featured-grid', name: 'Featured Posts' },
				{ id: 'theme-latest-post', name: 'Latest Post' },
				{ id: 'theme-other-story', name: 'Other Story' },
				{ id: 'theme-popular-categories', name: 'Popular Categories' },
			],
			widgets: [
				{
					id: 'block-3',
					name: 'Recent Posts',
				},
				{
					id: 'block-4',
					name: 'Recent Comments',
				},
			],
		} );
		const checkboxes = container.querySelectorAll(
			'input[type="checkbox"]'
		);
		const recent = checkboxes[ 11 ];

		expect( recent.checked ).toBe( true );
		expect( container.textContent ).toContain( 'Main Featured' );
		expect( container.textContent ).toContain( 'Featured Posts' );
		expect( container.textContent ).toContain( 'Latest Post' );
		expect( container.textContent ).toContain( 'Other Story' );
		expect( container.textContent ).toContain( 'Popular Categories' );
		expect( container.textContent ).toContain( 'Recent Posts' );
		expect( container.textContent ).toContain( 'Recent Comments' );
		expect( container.textContent ).toContain( 'Theme areas and widgets' );
		expect( container.textContent ).not.toContain( 'Homepage sidebar' );

		act( () => recent.click() );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( makeDraft() );

		expect( next.widget_display ).toEqual( {
			'block-3': false,
		} );

		const other = checkboxes[ 12 ];

		act( () => other.click() );

		const nextWithOther = setDraft.mock.calls[ 1 ][ 0 ]( next );

		expect( nextWithOther.widget_display ).toEqual( {
			'block-3': false,
			'block-4': false,
		} );

		unmount();
	} );

	it( 'shows theme-coded homepage sections and stores their choices separately', () => {
		const { container, setDraft, unmount } = renderSettings( {
			sections: [
				{ id: 'theme-main-featured', name: 'Main Featured' },
				{ id: 'theme-featured-grid', name: 'Featured Posts' },
				{ id: 'theme-latest-post', name: 'Latest Post' },
				{ id: 'theme-other-story', name: 'Other Story' },
				{ id: 'theme-popular-categories', name: 'Popular Categories' },
			],
		} );
		const checkboxes = container.querySelectorAll(
			'input[type="checkbox"]'
		);

		expect( container.textContent ).toContain( 'Main Featured' );
		expect( container.textContent ).toContain( 'Featured Posts' );
		expect( container.textContent ).toContain( 'Latest Post' );
		expect( container.textContent ).toContain( 'Other Story' );
		expect( container.textContent ).toContain( 'Popular Categories' );

		act( () => checkboxes[ 6 ].click() );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( makeDraft() );

		expect( next.section_display ).toEqual( {
			'theme-main-featured': false,
		} );

		act( () => checkboxes[ 7 ].click() );

		const nextWithOther = setDraft.mock.calls[ 1 ][ 0 ]( next );

		expect( nextWithOther.section_display ).toEqual( {
			'theme-main-featured': false,
			'theme-featured-grid': false,
		} );
		expect( nextWithOther.widget_display ).toEqual( {} );

		unmount();
	} );

	it( 'separates theme areas from widgets and runs a deep scan', () => {
		const onRescan = jest.fn();
		const { container, unmount } = renderSettings( {
			sections: [
				{
					id: 'page-class-wp-block-latest-posts',
					name: 'Latest Posts',
				},
			],
			widgets: [ { id: 'block-3', name: 'Query Loop' } ],
			onRescan,
		} );

		expect( container.textContent ).toContain( 'Theme areas' );
		expect( container.textContent ).toContain( 'Widgets' );
		expect( container.textContent ).toContain( 'Latest Posts' );
		expect( container.textContent ).toContain( 'Query Loop' );

		const scan = [ ...container.querySelectorAll( 'button' ) ].find(
			( button ) => button.textContent.includes( 'Deep scan' )
		);

		expect( scan ).toBeTruthy();
		act( () => scan.click() );
		expect( onRescan ).toHaveBeenCalledTimes( 1 );

		unmount();
	} );

	it( 'names the theme the scan read beside the areas it found', () => {
		// The list of areas is the cached result of a scan, so the screen says
		// which theme it was read from: without it, a site that has switched
		// theme reads the previous one's sections as if they were its own.
		const { container, unmount } = renderSettings( {
			sections: [
				{
					id: 'page-class-wp-block-latest-posts',
					name: 'Latest Posts',
				},
			],
			theme: { name: 'Twenty Twenty-Five' },
		} );

		expect( container.textContent ).toContain(
			'Active theme: Twenty Twenty-Five.'
		);

		unmount();
	} );

	it( 'names the parent theme when the active one is built on it', () => {
		// A child theme is active while its parent's templates are what the site
		// renders, so a section that is not in the child's own files is still a
		// section this site prints.
		const { container, unmount } = renderSettings( {
			theme: { name: 'News', parent: 'Twenty Twenty-Five' },
		} );

		expect( container.textContent ).toContain(
			'Active theme: News, a child of Twenty Twenty-Five.'
		);

		unmount();
	} );

	it( 'says nothing about a theme it was not told', () => {
		const { container, unmount } = renderSettings( {} );

		expect( container.textContent ).not.toContain( 'Active theme' );

		unmount();
	} );

	it( 'says which pages a section appears on and follows those page switches', () => {
		const { container, setDraft, unmount } = renderSettings( {
			display_locations: {
				singular: true,
				home: false,
				archive: false,
				search: false,
			},
			sections: [
				{
					id: 'page-class-related',
					name: 'Related posts',
					contexts: [ 'singular' ],
					sources: [ 'Single post template' ],
				},
				{
					id: 'page-class-front-grid',
					name: 'Front grid',
					contexts: [ 'home' ],
					sources: [ 'Front page' ],
				},
			],
			widgets: [
				{ id: 'block-3', name: 'Recent Posts', areas: [ 'Sidebar' ] },
			],
		} );
		const checkboxes = [
			...container.querySelectorAll( 'input[type="checkbox"]' ),
		];

		expect( container.textContent ).toContain( 'Post and page content' );
		expect( container.textContent ).toContain( 'Single post template' );
		expect( container.textContent ).toContain( 'Appears in Sidebar' );

		// The single-post section follows the post-page switch, the front-page
		// section follows the homepage switch, and a widget stays available
		// while any page type can show icons.
		expect( checkboxes[ 6 ].disabled ).toBe( false );
		expect( checkboxes[ 7 ].disabled ).toBe( true );
		expect( checkboxes[ 8 ].disabled ).toBe( false );

		act( () => checkboxes[ 6 ].click() );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( makeDraft() );

		expect( next.section_display ).toEqual( {
			'page-class-related': false,
		} );

		unmount();
	} );

	it( 'says which sidebars a widget appears in and follows their pages', () => {
		const { container, setDraft, unmount } = renderSettings( {
			display_locations: {
				singular: false,
				home: false,
				archive: true,
				search: false,
			},
			widgets: [
				{
					id: 'block-3',
					name: 'Recent Posts',
					areas: [ 'Single Sidebar' ],
					contexts: [ 'singular' ],
				},
				{
					id: 'recent-posts-2',
					name: 'Latest News',
					areas: [ 'Footer' ],
					contexts: [ 'all' ],
				},
			],
		} );
		const checkboxes = [
			...container.querySelectorAll( 'input[type="checkbox"]' ),
		];

		expect( container.textContent ).toContain(
			'Appears in Single Sidebar'
		);
		expect( container.textContent ).toContain( 'Every page' );

		// The single-page sidebar follows the post-page switch; the footer
		// sidebar renders on every page, so it stays available while any page
		// type is on.
		expect( checkboxes[ 6 ].disabled ).toBe( true );
		expect( checkboxes[ 7 ].disabled ).toBe( false );

		act( () => checkboxes[ 7 ].click() );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( makeDraft() );

		expect( next.widget_display ).toEqual( {
			'recent-posts-2': false,
		} );

		unmount();
	} );

	it( 'disables the deep scan while it is running', () => {
		const { container, unmount } = renderSettings( {
			onRescan: jest.fn(),
			scanning: true,
		} );
		const scan = [ ...container.querySelectorAll( 'button' ) ].find(
			( button ) => button.textContent.includes( 'Deep scan' )
		);

		expect( scan.disabled ).toBe( true );

		unmount();
	} );

	it( 'explains an empty list and points at the deep scan', () => {
		const { container, unmount } = renderSettings();

		expect( container.textContent ).toContain(
			'No theme areas or widgets were found yet.'
		);
		expect( container.textContent ).toContain( 'Deep scan' );

		unmount();
	} );

	it( 'are disabled while the feature is off', () => {
		const { container, unmount } = renderSettings( { enabled: false } );

		expect(
			container.querySelector( 'input[type="datetime-local"]' ).disabled
		).toBe( true );

		unmount();
	} );
} );

describe( 'the title-size bands', () => {
	/**
	 * One band's field.
	 *
	 * @param {Element} container Rendered card.
	 * @param {number}  index     Row number, from 1.
	 * @param {string}  key       `title font size` or `icon size`.
	 * @return {Element} Number input.
	 */
	const band = ( container, index, key ) =>
		container.querySelector(
			`[aria-label="Size ${ index } ${ key } in pixels"]`
		);

	const BANDS = {
		sizing_rules: [ { font: '12', icon: '10' } ],
	};

	it( 'shows the bands without asking for a calculation first', () => {
		// Standard is gone, so there is nothing to switch: a title-following
		// icon is always sized from this table.
		const { container, unmount } = renderSettings( BANDS );

		expect(
			container.querySelector( '[aria-label="Icon size calculation"]' )
		).toBeNull();
		expect( band( container, 1, 'title font size' ).value ).toBe( '12' );
		expect( band( container, 1, 'icon size' ).value ).toBe( '10' );

		unmount();
	} );

	it( 'keeps a half-typed size instead of cleaning it up', () => {
		// `4` is the first key of `40`, and below the smallest band. Writing it
		// through the normaliser would delete the row mid-entry, which is the
		// same trap the editor's own bounds fields had.
		const { container, setDraft, unmount } = renderSettings( BANDS );

		type( band( container, 1, 'title font size' ), '4' );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( {
			...makeDraft(),
			...BANDS,
		} );

		expect( next.sizing_rules ).toEqual( [ { font: '4', icon: '10' } ] );

		unmount();
	} );

	it( 'adds an empty row, and keeps at least one', () => {
		const { container, setDraft, unmount } = renderSettings( BANDS );
		const add = [ ...container.querySelectorAll( 'button' ) ].find(
			( button ) => 'Add size' === button.textContent
		);

		act( () => add.click() );

		const next = setDraft.mock.calls[ 0 ][ 0 ]( {
			...makeDraft(),
			...BANDS,
		} );

		expect( next.sizing_rules ).toEqual( [
			{ font: '12', icon: '10' },
			{ font: '', icon: '' },
		] );

		unmount();

		// The last row cannot be removed: the drawing code has to size an icon
		// from something.
		const single = renderSettings( BANDS );

		expect(
			single.container.querySelector( '[aria-label="Remove size 1"]' )
				.disabled
		).toBe( true );

		single.unmount();
	} );

	it( 'removes the row that was asked for', () => {
		const twoBands = {
			sizing_rules: [
				{ font: '12', icon: '10' },
				{ font: '16', icon: '12' },
			],
		};
		const { container, setDraft, unmount } = renderSettings( twoBands );

		act( () =>
			container.querySelector( '[aria-label="Remove size 1"]' ).click()
		);

		const next = setDraft.mock.calls[ 0 ][ 0 ]( {
			...makeDraft(),
			...twoBands,
		} );

		expect( next.sizing_rules ).toEqual( [ { font: '16', icon: '12' } ] );

		unmount();
	} );
} );
