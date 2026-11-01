/**
 * Icon size.
 *
 * Two places can set how big an icon is drawn: the library asset, and the stage
 * that shows it. Which one wins has to be the same on every screen — the editor
 * sidebar, the canvas beside it, and the front end, which is served by PHP — and
 * a size is the one value here that is a *string* as well as a number, so the
 * accepting pattern has to match `Security::sanitize_css_size()` exactly. A
 * length the editor accepts and the server drops would silently resize an icon
 * on the next save.
 */

import { advancedIconWidth } from '../editorTitleDom';
import {
	DEFAULT_ICON_SIZE,
	DEFAULT_SIZING_RULES,
	MAX_SIZING_RULES,
	effectivePostDisplayLocations,
	emptyStage,
	emptyTimeline,
	iconSize,
	joinCssSize,
	normalizeAssets,
	normalizeSizingRules,
	stageSizingRules,
	POST_DISPLAY_CHOICES,
	POST_DISPLAY_LOCATIONS,
	postDisplayChoice,
	resolvesPostDisplay,
	resolvesPostDisplayMap,
	readTimelineFromJson,
	resolveTimeline,
	resolveTitleIcon,
	serializeTimeline,
	splitCssSize,
} from '../constants';

const ASSETS = normalizeAssets( [
	{ id: 'small', url: 'https://example.test/small.gif', size: '16px' },
	{ id: 'plain', url: 'https://example.test/plain.gif' },
] );

describe( 'a size the server will keep', () => {
	it( 'is a number with a unit', () => {
		[ '20px', '1.5em', '2rem', '100%', '40vw', '12.25px' ].forEach(
			( size ) => {
				expect( iconSize( { size }, {} ) ).toBe( size );
			}
		);
	} );

	it( 'rejects anything that is not one', () => {
		// The dangerous case is the last one: a value that could close the
		// declaration and start another.
		[
			'',
			'abc',
			'24',
			'24 px',
			'20px;color:red',
			'12345px',
			'px',
			null,
			24,
		].forEach( ( size ) => {
			expect( iconSize( { size }, {} ) ).toBe( DEFAULT_ICON_SIZE );
		} );
	} );

	it( 'survives a stage that carries no size at all', () => {
		expect( iconSize( {}, {} ) ).toBe( DEFAULT_ICON_SIZE );
		expect( iconSize( null, null ) ).toBe( DEFAULT_ICON_SIZE );
	} );
} );

describe( 'which size wins', () => {
	it( 'the stage, when it has one', () => {
		expect( iconSize( { size: '30px' }, { size: '16px' } ) ).toBe( '30px' );
	} );

	it( 'the asset, when the stage leaves it empty', () => {
		expect( iconSize( { size: '' }, { size: '16px' } ) ).toBe( '16px' );
	} );

	it( 'the default, when neither says anything', () => {
		expect( iconSize( { size: '' }, { size: '' } ) ).toBe( '20px' );
	} );

	it( 'the asset, when the stage holds something unusable', () => {
		expect( iconSize( { size: 'huge' }, { size: '16px' } ) ).toBe( '16px' );
	} );
} );

describe( 'the two fields in the sidebar', () => {
	it( 'describe the asset size when the stage has none of its own', () => {
		expect( splitCssSize( '', '16px' ) ).toEqual( {
			number: '16',
			unit: 'px',
		} );
	} );

	it( 'describe the stored size when there is one', () => {
		expect( splitCssSize( '1.5em' ) ).toEqual( {
			number: '1.5',
			unit: 'em',
		} );
	} );

	it( 'fall back to the default when neither size is usable', () => {
		expect( splitCssSize( 'nonsense' ) ).toEqual( {
			number: '20',
			unit: 'px',
		} );
	} );

	it( 'write the two fields back as one length', () => {
		expect( joinCssSize( '24', 'px' ) ).toBe( '24px' );
		expect( joinCssSize( '24.5', '%' ) ).toBe( '24.5%' );
		expect( joinCssSize( 32, 'em' ) ).toBe( '32em' );
	} );

	it( 'treat an empty number as no size of my own', () => {
		expect( joinCssSize( '', 'px' ) ).toBe( '' );
		expect( joinCssSize( '  ', 'px' ) ).toBe( '' );
		expect( joinCssSize( 'abc', 'px' ) ).toBe( '' );
	} );
} );

describe( 'post display overrides', () => {
	it( 'offers site inherit, explicit show, and explicit hide choices for each page context', () => {
		expect(
			POST_DISPLAY_CHOICES.map( ( choice ) => choice.value )
		).toEqual( [ 'inherit', 'on', 'off' ] );
		expect(
			POST_DISPLAY_LOCATIONS.map( ( location ) => location.key )
		).toEqual( [ 'singular', 'home', 'archive', 'search' ] );
		expect( postDisplayChoice( 'invalid' ) ).toBe( 'inherit' );
	} );

	it( 'lets each post override site defaults for locations, widgets, and sections', () => {
		expect( resolvesPostDisplay( 'inherit', true ) ).toBe( true );
		expect( resolvesPostDisplay( 'off', true ) ).toBe( false );
		expect(
			effectivePostDisplayLocations(
				{ locations: { home: 'off' } },
				{ home: true, archive: false }
			)
		).toEqual( {
			singular: false,
			home: false,
			archive: false,
			search: false,
		} );
		expect(
			resolvesPostDisplayMap(
				{ recent: 'off', featured: 'on' },
				{ recent: true, featured: false }
			)
		).toEqual( {
			recent: false,
			featured: true,
		} );
	} );

	it( 'round-trips display choices with timeline meta and defaults new choices to inherit', () => {
		const timeline = emptyTimeline( {
			display: {
				locations: { home: 'off' },
				widgets: { 'recent-posts-2': 'on' },
				sections: { 'theme-featured-grid': 'off' },
			},
		} );
		const stored = readTimelineFromJson( serializeTimeline( timeline ) );

		expect( stored.display.locations.home ).toBe( 'off' );
		expect( stored.display.widgets[ 'recent-posts-2' ] ).toBe( 'on' );
		expect( stored.display.sections[ 'theme-featured-grid' ] ).toBe(
			'off'
		);
		expect( stored.display.locations.archive ).toBe( 'inherit' );
	} );
} );

describe( 'a stage size through the editor', () => {
	it( 'is normalised, and stays empty when unset', () => {
		expect( emptyStage( { size: '1.5em' } ).size ).toBe( '1.5em' );
		expect( emptyStage( {} ).size ).toBe( '' );
		expect( emptyStage( { size: 'nonsense' } ).size ).toBe( '' );
	} );

	it( 'is what the canvas draws', () => {
		const timeline = emptyTimeline( {
			enabled: true,
			stage_1: {
				asset_id: 'plain',
				position: 'left',
				duration: 1,
				unit: 'days',
				size: '30px',
			},
			stage_2: {
				asset_id: 'small',
				position: 'left',
				duration: 1,
				unit: 'days',
				size: '',
			},
		} );
		const anchor = '2026-10-01 12:00:00';
		const now = Math.floor(
			Date.parse( anchor.replace( ' ', 'T' ) + 'Z' ) / 1000
		);

		const stage1 = resolveTitleIcon( {
			timeline,
			assets: ASSETS,
			resolved: resolveTimeline( timeline, anchor, now ),
			isEnabled: true,
		} );

		expect( stage1.show ).toBe( true );
		expect( stage1.stage ).toBe( 1 );
		// No size on the asset, so the stage's 30px is the one that shows.
		expect( stage1.size ).toBe( '30px' );

		// One day later, the timeline itself resolves stage 2, which has no
		// size of its own and therefore takes the asset's 16px.
		const stage2 = resolveTitleIcon( {
			timeline,
			assets: ASSETS,
			resolved: resolveTimeline( timeline, anchor, now + 86400 ),
			isEnabled: true,
		} );

		expect( stage2.stage ).toBe( 2 );
		expect( stage2.size ).toBe( '16px' );
	} );

	it( 'travels with the post meta, through the JSON round trip', () => {
		const stored = readTimelineFromJson(
			serializeTimeline(
				emptyTimeline( {
					stage_1: {
						asset_id: 'a1',
						size: '1.5em',
						size_mode: 'advanced',
						sizing_rules: [
							{ font: 18, icon: 14 },
							{ font: 40, icon: 30 },
						],
					},
				} )
			),
			{}
		);

		expect( stored.stage_1.size ).toBe( '1.5em' );
		expect( stored.stage_1.size_mode ).toBe( 'advanced' );
		expect( stored.stage_1.sizing_rules ).toEqual( [
			{ font: 18, icon: 14 },
			{ font: 40, icon: 30 },
		] );
		expect( stored.stage_2.size ).toBe( '' );
		expect( stored.stage_2.sizing_rules ).toEqual( [] );
	} );
} );

describe( 'title-size bands', () => {
	const RULES = [
		{ font: 12, icon: 10 },
		{ font: 16, icon: 12 },
		{ font: 32, icon: 24 },
	];

	it( 'draws each band\u2019s own size at that band\u2019s title size', () => {
		expect( advancedIconWidth( RULES, 12 ) ).toBe( 10 );
		expect( advancedIconWidth( RULES, 16 ) ).toBe( 12 );
		expect( advancedIconWidth( RULES, 32 ) ).toBe( 24 );
	} );

	it( 'holds a row\u2019s size up to the next row', () => {
		// A row is an answer the author typed. 12/10 and 16/12 mean a 13px,
		// 14px or 15px title draws 10px and a 16px one 12px; drifting to 10.5
		// between them drew a size no row named, so a title two pixels taller
		// than another looked different for no reason on the settings screen.
		expect( advancedIconWidth( RULES, 13 ) ).toBe( 10 );
		expect( advancedIconWidth( RULES, 14 ) ).toBe( 10 );
		expect( advancedIconWidth( RULES, 15.9 ) ).toBe( 10 );
		expect( advancedIconWidth( RULES, 20 ) ).toBe( 12 );
		expect( advancedIconWidth( RULES, 24 ) ).toBe( 12 );
		expect( advancedIconWidth( RULES, 31.9 ) ).toBe( 12 );
	} );

	it( 'covers every title between two rows with the lower row\u2019s size', () => {
		// The table from a site that reported this: the icon it set for 32 is
		// what a 33px title draws, all the way to 39, and 40 is where the next
		// row takes over. Nothing between the rows is invented.
		const table = [
			{ font: 12, icon: 9 },
			{ font: 16, icon: 12 },
			{ font: 20, icon: 15 },
			{ font: 24, icon: 29 },
			{ font: 32, icon: 32 },
			{ font: 40, icon: 45 },
		];

		expect( advancedIconWidth( table, 32 ) ).toBe( 32 );
		[ 33, 36, 39, 39.9 ].forEach( ( size ) => {
			expect( advancedIconWidth( table, size ) ).toBe( 32 );
		} );
		expect( advancedIconWidth( table, 40 ) ).toBe( 45 );
		expect( advancedIconWidth( table, 96 ) ).toBe( 45 );
	} );

	it( 'holds the nearest band outside the table', () => {
		// Below the first band: the smallest icon the table names. Above the
		// last: the largest, so a hero headline keeps a size that was chosen
		// rather than falling back to a different calculation.
		expect( advancedIconWidth( RULES, 6 ) ).toBe( 10 );
		expect( advancedIconWidth( RULES, 200 ) ).toBe( 24 );
	} );

	it( 'answers with a size the table names, never a fraction of one', () => {
		// The written width is read back by the placement, so it stays a
		// whole number the table holds — no interpolation to round off.
		const width = advancedIconWidth(
			[
				{ font: 10, icon: 10 },
				{ font: 13, icon: 20 },
			],
			11
		);

		expect( width ).toBe( 10 );
		expect( Number.isInteger( width ) ).toBe( true );
	} );

	it( 'reads a table it was not given in order', () => {
		// Bands arrive sorted from the server, but a stale page can hand over
		// the stored order, and the row in force is the same either way.
		expect(
			advancedIconWidth(
				[
					{ font: 32, icon: 24 },
					{ font: 12, icon: 10 },
					{ font: 16, icon: 12 },
				],
				20
			)
		).toBe( 12 );
	} );

	it( 'answers nothing it cannot measure', () => {
		expect( advancedIconWidth( null, 16 ) ).toBeNull();
		expect( advancedIconWidth( [], 16 ) ).toBeNull();
		expect( advancedIconWidth( RULES, 0 ) ).toBeNull();
		expect( advancedIconWidth( RULES, 'auto' ) ).toBeNull();
		// A row without a usable size is skipped, not read as zero.
		expect(
			advancedIconWidth(
				[
					{ font: 16, icon: 0 },
					{ font: 32, icon: 24 },
				],
				16
			)
		).toBe( 24 );
	} );

	it( 'normalises the bands the way the server does', () => {
		// A site that has never edited its table gets the default ladder: the
		// drawing code has to size an icon from something.
		expect( normalizeSizingRules( [] ) ).toEqual( DEFAULT_SIZING_RULES );
		expect( normalizeSizingRules( null ) ).toEqual( DEFAULT_SIZING_RULES );

		expect(
			normalizeSizingRules( [
				{ font: '32', icon: '24' },
				{ font: 16, icon: 12 },
				{ font: '', icon: '' },
				{ font: 20, icon: 1 },
			] )
		).toEqual( [
			{ font: 16, icon: 12 },
			{ font: 32, icon: 24 },
		] );

		// One answer per font size, and the later row is the one kept.
		expect(
			normalizeSizingRules( [
				{ font: 16, icon: 12 },
				{ font: 16, icon: 13 },
			] )
		).toEqual( [ { font: 16, icon: 13 } ] );
	} );

	it( 'clamps a band to the range the fields offer', () => {
		expect( normalizeSizingRules( [ { font: 999, icon: 999 } ] ) ).toEqual(
			[ { font: 200, icon: 512 } ]
		);
	} );

	it( 'keeps the table to the number of rows the screen can show', () => {
		const many = Array.from( { length: 12 }, ( value, index ) => ( {
			font: 10 + index,
			icon: 10 + index,
		} ) );

		expect( normalizeSizingRules( many ) ).toHaveLength( MAX_SIZING_RULES );
	} );

	it( 'lets a stage keep a table of its own, or no table at all', () => {
		// A stage's empty table means "follow the site's", so unlike the site
		// table it must not be replaced by the default ladder here.
		expect( stageSizingRules( [] ) ).toEqual( [] );
		expect( stageSizingRules( null ) ).toEqual( [] );
		expect(
			stageSizingRules( [
				{ font: 20, icon: 15 },
				{ font: 16, icon: 12 },
			] )
		).toEqual( [
			{ font: 16, icon: 12 },
			{ font: 20, icon: 15 },
		] );
		// The same cleaning rules as the site table: unusable rows are dropped
		// and the later row for a size wins.
		expect(
			stageSizingRules( [
				{ font: 16, icon: 12 },
				{ font: 16, icon: 13 },
				{ font: 2, icon: 1 },
			] )
		).toEqual( [ { font: 16, icon: 13 } ] );
	} );
} );
