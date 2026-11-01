/**
 * Default settings card.
 *
 * These values seed every new post; an author can still override all of them in
 * the editor sidebar. The master switch and the post type list are included here
 * because the sidebar refuses to render its controls until the feature is on for
 * the post type being edited.
 */

import { __, sprintf } from '@wordpress/i18n';

import {
	ANCHOR_SOURCES,
	BEHAVIOURS,
	ICON_ANCHORS,
	ICON_SPACINGS,
	ICON_Z_INDEX_DEFAULT,
	MAX_SIZING_FONT,
	MAX_SIZING_ICON,
	MAX_SIZING_RULES,
	MIN_SIZING_RULE,
	POSITIONS,
	STAGE_INDEXES,
	emptyStage,
	formatSeconds,
	formatStageWindow,
	iconAnchorMode,
	iconSpacingMode,
	tightFitMode,
	stageSeconds,
} from '../shared/constants';
import {
	stageEndValue,
	stageStartValue,
	withStageEnd,
} from '../shared/stageDates';
import {
	Button,
	Card,
	Checkbox,
	DateTimeInput,
	NumberInput,
	Select,
	Spinner,
	Switch,
	cx,
} from '../shared/ui';

/**
 * Turn a stored anchor into the value a date and time field wants.
 *
 * The server stores `Y-m-d H:i:s`; the field reads and writes `Y-m-dTH:i`.
 *
 * @param {string} value Stored anchor.
 * @return {string} Field value, or an empty string.
 */
const anchorFieldValue = ( value ) =>
	typeof value === 'string' && value
		? value.replace( ' ', 'T' ).slice( 0, 16 )
		: '';

/**
 * The page types a section or widget can appear on, in words.
 *
 * A scanned section records the pages its template renders on, so the switch
 * can say where it applies instead of looking like a homepage-only control.
 * `all` is a template part or a theme-registered area, which any page may
 * print.
 *
 * @param {string[]} contexts Page contexts.
 * @return {string} Comma-separated page names.
 */
const contextLabel = ( contexts ) => {
	const names = {
		home: __( 'Homepage', 'titlesparks' ),
		singular: __( 'Post and page content', 'titlesparks' ),
		archive: __( 'Archives', 'titlesparks' ),
		search: __( 'Search results', 'titlesparks' ),
		all: __( 'Every page', 'titlesparks' ),
	};
	const list =
		Array.isArray( contexts ) && contexts.length ? contexts : [ 'all' ];

	return list.map( ( context ) => names[ context ] || context ).join( ', ' );
};

/**
 * Whether any page type allows icons, so a widget can still appear.
 *
 * A widget belongs to a sidebar rather than to one page type, so it stays
 * available while any page may show icons.
 *
 * @param {Object} locations Enabled page types.
 * @return {boolean} Whether at least one page type is on.
 */
const anyLocationEnabled = ( locations = {} ) =>
	Object.values( locations ).some( Boolean );

/**
 * Whether a section's own pages are switched on.
 *
 * @param {Object}   locations Enabled page types.
 * @param {string[]} contexts  Pages the section appears on.
 * @return {boolean} Whether the section could render anywhere.
 */
const sectionLocationEnabled = ( locations = {}, contexts ) => {
	const list =
		Array.isArray( contexts ) && contexts.length ? contexts : [ 'all' ];

	return list.some( ( context ) =>
		'all' === context
			? anyLocationEnabled( locations )
			: Boolean( locations[ context ] )
	);
};

/**
 * Row wrapper: label above the control on narrow screens, beside it on wide.
 *
 * @param {Object} props          Component props.
 * @param {string} props.label    Row label.
 * @param {Object} props.children Rendered controls.
 * @return {Object} Rendered row.
 */
const Row = ( { label, children } ) => (
	<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-2 titlesparks:sm:flex-row titlesparks:sm:items-center titlesparks:sm:gap-4">
		<span className="titlesparks:text-sm titlesparks:font-medium titlesparks:text-gray-700 titlesparks:sm:w-40 titlesparks:sm:shrink-0">
			{ label }
		</span>
		<div className="titlesparks:w-full titlesparks:sm:max-w-md">
			{ children }
		</div>
	</div>
);

/**
 * A group of radio cards, one sentence under each label.
 *
 * A select can only show its labels, and both of the choices here mean nothing
 * without the sentence that says when the choice applies — so every option is
 * drawn in full, selected or not.
 *
 * @param {Object}   props
 * @param {string}   props.name     Radio group name.
 * @param {string}   props.label    Group label, also read out by screen readers.
 * @param {Array}    props.options  `{ value, label, description }` entries.
 * @param {string}   props.value    Selected value.
 * @param {boolean}  props.disabled Whether the whole group is off.
 * @param {Function} props.onChange Receives the chosen value.
 * @return {Object} Rendered fieldset.
 */
const RadioCards = ( { name, label, options, value, disabled, onChange } ) => (
	<fieldset className="titlesparks:m-0 titlesparks:flex titlesparks:flex-col titlesparks:gap-2">
		<legend className="titlesparks:sr-only">{ label }</legend>
		{ options.map( ( option ) => {
			const chosen = value === option.value;
			const optionId = `titlesparks-${ name }-${ option.value }`;

			return (
				<label
					key={ option.value }
					htmlFor={ optionId }
					className={ cx(
						'titlesparks:grid titlesparks:grid-cols-[auto_1fr] titlesparks:items-start titlesparks:gap-x-3 titlesparks:gap-y-0.5 titlesparks:rounded-lg titlesparks:border titlesparks:px-3 titlesparks:py-2.5',
						chosen
							? 'titlesparks:border-brand-500 titlesparks:bg-brand-50'
							: 'titlesparks:border-gray-200 titlesparks:bg-white',
						disabled
							? 'titlesparks:cursor-not-allowed titlesparks:opacity-50'
							: 'titlesparks:cursor-pointer'
					) }
				>
					<input
						id={ optionId }
						type="radio"
						name={ `titlesparks-${ name }` }
						value={ option.value }
						checked={ chosen }
						disabled={ disabled }
						onChange={ () => onChange( option.value ) }
						className="titlesparks:mt-0.5 titlesparks:h-4 titlesparks:w-4 titlesparks:shrink-0"
					/>
					<span className="titlesparks:text-sm titlesparks:font-medium titlesparks:text-gray-800">
						{ option.label }
					</span>
					<span className="titlesparks:col-start-2 titlesparks:text-xs titlesparks:text-gray-500">
						{ option.description }
					</span>
				</label>
			);
		} ) }
	</fieldset>
);

/**
 * DefaultSettings component.
 *
 * The default stages are edited the way a stage is edited in the post editor:
 * by the date and time its icon stops, not by a number of days. A stage's
 * length is what the front end reads, so picking an end stores the length it
 * implies (`withStageEnd()`, shared with the editor); the dates shown are
 * counted from the site's timeline start, and for a post-date start they are
 * counted from the clock, because a new post has no date of its own yet.
 *
 * @param {Object}   props
 * @param {Object}   props.draft      Settings draft.
 * @param {Function} props.setDraft   Draft updater.
 * @param {Object}   props.timeline   Normalised default timeline.
 * @param {Array}    props.postTypes  Available post types.
 * @param {Array}    props.widgets    Active WordPress widget instances.
 * @param {Array}    props.sections   Theme sections found across the templates, posts and pages.
 * @param {Object}   props.theme      Theme the scan read, named beside those areas.
 * @param {string}   props.anchorDate Moment the defaults are counted from.
 * @param {Function} props.onRescan   Re-runs the deep scan.
 * @param {boolean}  props.scanning   Whether that scan is in flight.
 * @return {Object} Rendered settings card.
 */
const DefaultSettings = ( {
	draft,
	setDraft,
	timeline,
	postTypes,
	widgets = [],
	sections = [],
	theme = {},
	anchorDate = '',
	onRescan,
	scanning = false,
} ) => {
	const setStage = ( index, patch ) =>
		setDraft( ( current ) => ( {
			...current,
			[ `default_stage_${ index }` ]: {
				...emptyStage( current[ `default_stage_${ index }` ] ),
				...patch,
			},
		} ) );

	const setAllPositions = ( position ) =>
		setDraft( ( current ) => {
			const next = { ...current };

			STAGE_INDEXES.forEach( ( index ) => {
				const key = `default_stage_${ index }`;
				next[ key ] = { ...emptyStage( current[ key ] ), position };
			} );

			return next;
		} );

	// Picking an end rebalances one stage only: the stages are contiguous, so a
	// mid stage's end moves where the next one starts, and both keep their own
	// lengths.
	const setEnd = ( index, value ) => {
		const next = withStageEnd( timeline, index, anchorDate, value );

		if ( next ) {
			setStage( index, next );
		}
	};

	// A default saved by an older version still has to show in the picker,
	// which offers the two sides a new stage may choose.
	const defaultPosition = emptyStage( draft.default_stage_1 ).position;

	const togglePostType = ( value ) =>
		setDraft( ( current ) => ( {
			...current,
			post_types: current.post_types.includes( value )
				? current.post_types.filter( ( item ) => item !== value )
				: [ ...current.post_types, value ],
		} ) );

	// The advanced calculation's bands, edited as text. A number being typed
	// is not a number yet — `1` on the way to `12` is below the smallest band —
	// so the draft holds exactly what was typed and the server normalises,
	// sorts and drops the rows when the settings are saved. Writing each
	// keystroke through the normaliser would delete the row mid-entry.
	const sizingRules = Array.isArray( draft.sizing_rules )
		? draft.sizing_rules
		: [];

	const setSizingRule = ( index, key ) => ( event ) => {
		// Read before the update runs: React restores a controlled input's value
		// on the re-render, so an updater that reads the event later sees the
		// old one.
		const { value } = event.target;

		setDraft( ( current ) => ( {
			...current,
			sizing_rules: current.sizing_rules.map( ( row, position ) =>
				position === index ? { ...row, [ key ]: value } : row
			),
		} ) );
	};

	const addSizingRule = () =>
		setDraft( ( current ) => ( {
			...current,
			sizing_rules: [ ...current.sizing_rules, { font: '', icon: '' } ],
		} ) );

	const removeSizingRule = ( index ) =>
		setDraft( ( current ) => ( {
			...current,
			sizing_rules: current.sizing_rules.filter(
				( row, position ) => position !== index
			),
		} ) );

	// Which theme the areas below were read from. The list is the cached result
	// of a scan, so a site that has switched theme can be looking at the
	// previous one's sections until it scans again — the name is what says so.
	// A child theme is the active one while its parent's templates are what the
	// site renders, so both names are given when there are two.
	let themeLabel = '';

	if ( theme.name ) {
		themeLabel = theme.parent
			? sprintf(
					/* translators: 1: the active theme's name, 2: the name of the theme it is built on. */
					__( 'Active theme: %1$s, a child of %2$s.', 'titlesparks' ),
					theme.name,
					theme.parent
				)
			: sprintf(
					/* translators: %s: the active theme's name. */
					__( 'Active theme: %s.', 'titlesparks' ),
					theme.name
				);
	}

	return (
		<Card
			title={ __( 'Default Settings', 'titlesparks' ) }
			description={ __(
				'These settings will be used for new posts unless overridden in the block editor.',
				'titlesparks'
			) }
		>
			<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-4">
				<div className="titlesparks:flex titlesparks:items-center titlesparks:justify-between titlesparks:gap-4 titlesparks:rounded-xl titlesparks:border titlesparks:border-gray-200 titlesparks:bg-white titlesparks:px-4 titlesparks:py-3">
					<div>
						<p className="titlesparks:m-0 titlesparks:text-sm titlesparks:font-medium titlesparks:text-gray-800">
							{ __( 'Enable TitleSparks', 'titlesparks' ) }
						</p>
						<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
							{ __(
								'Post titles only show a decaying icon while this is on.',
								'titlesparks'
							) }
						</p>
					</div>
					<Switch
						id="titlesparks-enabled"
						checked={ draft.enabled }
						onChange={ ( enabled ) =>
							setDraft( ( current ) => ( {
								...current,
								enabled,
							} ) )
						}
					/>
				</div>

				<fieldset className="titlesparks:m-0 titlesparks:rounded-xl titlesparks:border titlesparks:border-gray-200 titlesparks:p-4">
					<legend className="titlesparks:px-2 titlesparks:text-sm titlesparks:font-medium titlesparks:text-gray-700">
						{ __( 'Post types', 'titlesparks' ) }
					</legend>
					<div
						className={ cx(
							'titlesparks:grid titlesparks:grid-cols-2 titlesparks:gap-x-4 titlesparks:gap-y-3 titlesparks:sm:grid-cols-3',
							! draft.enabled && 'titlesparks:opacity-50'
						) }
					>
						{ postTypes.map( ( type ) => (
							<Checkbox
								key={ type.value }
								label={ type.label }
								checked={ draft.post_types.includes(
									type.value
								) }
								onChange={ () => togglePostType( type.value ) }
							/>
						) ) }
					</div>
				</fieldset>

				<fieldset className="titlesparks:m-0 titlesparks:rounded-xl titlesparks:border titlesparks:border-gray-200 titlesparks:p-4">
					<legend className="titlesparks:px-2 titlesparks:text-sm titlesparks:font-medium titlesparks:text-gray-700">
						{ __( 'Show icons on', 'titlesparks' ) }
					</legend>
					<p className="titlesparks:m-0 titlesparks:mb-3 titlesparks:text-xs titlesparks:text-gray-500">
						{ __(
							'Choose which page types may show icons beside post titles, including featured sections on listing pages.',
							'titlesparks'
						) }
					</p>
					<div
						className={ cx(
							'titlesparks:grid titlesparks:grid-cols-1 titlesparks:gap-3 titlesparks:sm:grid-cols-2',
							! draft.enabled && 'titlesparks:opacity-50'
						) }
					>
						{ [
							{
								key: 'singular',
								label: __( 'Post pages', 'titlesparks' ),
							},
							{
								key: 'home',
								label: __( 'Homepage', 'titlesparks' ),
							},
							{
								key: 'archive',
								label: __(
									'Archives and categories',
									'titlesparks'
								),
							},
							{
								key: 'search',
								label: __( 'Search results', 'titlesparks' ),
							},
						].map( ( location ) => (
							<Checkbox
								key={ location.key }
								label={ location.label }
								checked={
									draft.display_locations[ location.key ]
								}
								disabled={ ! draft.enabled }
								onChange={ ( checked ) =>
									setDraft( ( current ) => ( {
										...current,
										display_locations: {
											...current.display_locations,
											[ location.key ]: checked,
										},
									} ) )
								}
							/>
						) ) }
					</div>
				</fieldset>

				<fieldset className="titlesparks:m-0 titlesparks:rounded-xl titlesparks:border titlesparks:border-gray-200 titlesparks:p-4">
					<legend className="titlesparks:px-2 titlesparks:text-sm titlesparks:font-medium titlesparks:text-gray-700">
						{ __( 'Theme areas and widgets', 'titlesparks' ) }
					</legend>
					<div className="titlesparks:mb-3 titlesparks:flex titlesparks:flex-wrap titlesparks:items-start titlesparks:justify-between titlesparks:gap-3">
						<div className="titlesparks:flex titlesparks:max-w-md titlesparks:flex-col titlesparks:gap-1">
							<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
								{ __(
									'Choose which areas can show icons. The scan reads your theme templates, your posts and pages, and your widgets, so a section says which pages it appears on.',
									'titlesparks'
								) }
							</p>
							{ themeLabel && (
								<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:font-medium titlesparks:text-gray-600">
									{ themeLabel }
								</p>
							) }
						</div>
						<Button
							variant="secondary"
							size="sm"
							disabled={ scanning }
							onClick={ onRescan }
						>
							{ scanning && <Spinner /> }
							{ __( 'Deep scan', 'titlesparks' ) }
						</Button>
					</div>
					<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-4">
						{ sections.length > 0 && (
							<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-3">
								<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:font-semibold titlesparks:uppercase titlesparks:tracking-wide titlesparks:text-gray-400">
									{ __( 'Theme areas', 'titlesparks' ) }
								</p>
								{ sections.map( ( section ) => (
									<Checkbox
										key={ section.id }
										label={ section.name }
										description={ [
											contextLabel( section.contexts ),
											section.sources?.length
												? section.sources
														.slice( 0, 2 )
														.join( ', ' )
												: '',
										]
											.filter( Boolean )
											.join( ' · ' ) }
										checked={
											draft.section_display[
												section.id
											] !== false
										}
										disabled={
											! draft.enabled ||
											! sectionLocationEnabled(
												draft.display_locations,
												section.contexts
											)
										}
										onChange={ ( checked ) =>
											setDraft( ( current ) => ( {
												...current,
												section_display: {
													...current.section_display,
													[ section.id ]: checked,
												},
											} ) )
										}
									/>
								) ) }
							</div>
						) }
						{ widgets.length > 0 && (
							<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-3">
								<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:font-semibold titlesparks:uppercase titlesparks:tracking-wide titlesparks:text-gray-400">
									{ __( 'Widgets', 'titlesparks' ) }
								</p>
								{ widgets.map( ( widget ) => (
									<Checkbox
										key={ widget.id }
										label={ widget.name }
										description={ [
											widget.areas?.length
												? `${ __(
														'Appears in',
														'titlesparks'
													) } ${ widget.areas.join( ', ' ) }`
												: '',
											contextLabel( widget.contexts ),
										]
											.filter( Boolean )
											.join( ' · ' ) }
										checked={
											draft.widget_display[
												widget.id
											] !== false
										}
										disabled={
											! draft.enabled ||
											! sectionLocationEnabled(
												draft.display_locations,
												widget.contexts
											)
										}
										onChange={ ( checked ) =>
											setDraft( ( current ) => ( {
												...current,
												widget_display: {
													...current.widget_display,
													[ widget.id ]: checked,
												},
											} ) )
										}
									/>
								) ) }
							</div>
						) }
						{ sections.length === 0 && widgets.length === 0 && (
							<p className="titlesparks:m-0 titlesparks:rounded-lg titlesparks:border titlesparks:border-dashed titlesparks:border-gray-300 titlesparks:bg-gray-50 titlesparks:px-4 titlesparks:py-3 titlesparks:text-xs titlesparks:text-gray-500">
								{ __(
									'No theme areas or widgets were found yet. Add a widget, or put a post-list block on a post, a page or your front page, then choose Deep scan.',
									'titlesparks'
								) }
							</p>
						) }
					</div>
				</fieldset>

				<Row label={ __( 'Timeline starts', 'titlesparks' ) }>
					<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-2">
						<Select
							value={ draft.anchor_source }
							options={ ANCHOR_SOURCES }
							disabled={ ! draft.enabled }
							onChange={ ( source ) =>
								setDraft( ( current ) => ( {
									...current,
									anchor_source: source,
								} ) )
							}
						/>

						{ 'fixed' === draft.anchor_source && (
							<>
								<DateTimeInput
									value={ anchorFieldValue(
										draft.anchor_datetime
									) }
									disabled={ ! draft.enabled }
									aria-label={ __(
										'Date and time the timeline starts',
										'titlesparks'
									) }
									onChange={ ( event ) =>
										setDraft( ( current ) => ( {
											...current,
											anchor_datetime: event.target.value,
										} ) )
									}
								/>
								<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
									{ __(
										'Every post counts its timeline from this moment unless it sets its own. Written as site time.',
										'titlesparks'
									) }
								</p>
							</>
						) }
					</div>
				</Row>

				<Row label={ __( 'Default Position', 'titlesparks' ) }>
					<Select
						value={ defaultPosition }
						options={ POSITIONS }
						disabled={ ! draft.enabled }
						onChange={ setAllPositions }
					/>
				</Row>

				{ /* The two numbers on an icon count from a line of the title. Saying
				     which line, and what happens to a title that wraps, is the
				     difference between an icon that stays put and one that drifts. */ }
				<Row label={ __( 'Icon lines up with', 'titlesparks' ) }>
					<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-2">
						<RadioCards
							name="icon-anchor"
							label={ __( 'Icon lines up with', 'titlesparks' ) }
							options={ ICON_ANCHORS }
							value={ iconAnchorMode( draft.icon_anchor ) }
							disabled={ ! draft.enabled }
							onChange={ ( value ) =>
								setDraft( ( current ) => ( {
									...current,
									icon_anchor: value,
								} ) )
							}
						/>
						<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
							{ __(
								'This decides where the X and Y offsets start from, on every icon. With the first line, a title that wraps to two or three lines keeps the icon exactly where you placed it.',
								'titlesparks'
							) }
						</p>
					</div>
				</Row>

				{ /* The icon usually stands a fraction of the title's own size away
				     from the words. An icon whose picture is meant to finish the
				     last word can be drawn right against it instead, and a post can
				     make either answer its own. */ }
				<Row label={ __( 'Space beside the icon', 'titlesparks' ) }>
					<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-2">
						<RadioCards
							name="icon-spacing"
							label={ __(
								'Space beside the icon',
								'titlesparks'
							) }
							options={ ICON_SPACINGS }
							value={ iconSpacingMode( draft.icon_spacing ) }
							disabled={ ! draft.enabled }
							onChange={ ( value ) =>
								setDraft( ( current ) => ( {
									...current,
									icon_spacing: value,
								} ) )
							}
						/>
						<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
							{ __(
								'This is the space every icon uses unless its own post chooses another. Flush drops both the gap and the small-icon centring, so the icon\u2019s own edge touches the last character.',
								'titlesparks'
							) }
						</p>
					</div>
				</Row>

				{ /* A card in a widget owns no space beside it, so a theme may clip
				     whatever leaves it. One switch decides what happens there: on
				     draws the icon smaller so it fits, off leaves the author's icon
				     exactly as it was placed. Neither moves the title's words. */ }
				{ /* An animated GIF cannot be paused by CSS. One switch decides
				     whether a reader whose system asks for less motion is drawn
				     a still frame instead. On by default: it only changes the page
				     for readers who asked, and movement they cannot stop is worse
				     than a picture that holds still. */ }
				<Row label={ __( 'Respect reduced motion', 'titlesparks' ) }>
					<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-2">
						<Switch
							id="titlesparks-reduced-motion"
							checked={ Boolean( draft.reduced_motion ) }
							onChange={ ( respect ) =>
								setDraft( ( current ) => ( {
									...current,
									reduced_motion: respect,
								} ) )
							}
							aria-label={ __(
								'Respect reduced motion',
								'titlesparks'
							) }
						/>
						<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
							{ __(
								'An animated GIF cannot be paused with CSS. On draws a still frame of that GIF for any reader whose system asks for less motion; off keeps the animation for everyone. Only animated GIFs are affected, and every other icon is drawn exactly as before.',
								'titlesparks'
							) }
						</p>
					</div>
				</Row>

				<Row
					label={ __(
						'Fit icons inside tight cards',
						'titlesparks'
					) }
				>
					<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-2">
						<Switch
							id="titlesparks-tight-fit"
							checked={
								'shrink' === tightFitMode( draft.tight_fit )
							}
							onChange={ ( fit ) =>
								setDraft( ( current ) => ( {
									...current,
									tight_fit: fit ? 'shrink' : 'keep',
								} ) )
							}
							aria-label={ __(
								'Fit icons inside tight cards',
								'titlesparks'
							) }
						/>
						<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
							{ __(
								'Only affects icons inside a card — a widget or homepage section — whose edge hides what leaves it. On draws an icon that would be cut off at a smaller size, down to 8px, so it fits; off draws the icon exactly where you placed it and leaves the card edge to your theme. The title\u2019s words never move either way, and a post\u2019s own title is never affected.',
								'titlesparks'
							) }
						</p>
					</div>
				</Row>

				{ /* How an icon that follows the title is sized: this site's own
				     title-size bands. A stage in the post editor can carry a table
				     of its own; this one is what a stage without one follows, so
				     there is nothing to switch on. */ }
				<Row
					label={ __( 'Title size \u2192 icon size', 'titlesparks' ) }
				>
					<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-3">
						<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-2 titlesparks:rounded-lg titlesparks:border titlesparks:border-gray-200 titlesparks:bg-gray-50 titlesparks:p-3">
							<div className="titlesparks:grid titlesparks:grid-cols-[1fr_1fr_auto] titlesparks:gap-2 titlesparks:text-xs titlesparks:font-medium titlesparks:text-gray-600">
								<span>
									{ __( 'Title size (px)', 'titlesparks' ) }
								</span>
								<span>
									{ __( 'Icon size (px)', 'titlesparks' ) }
								</span>
								<span className="titlesparks:sr-only">
									{ __( 'Remove size', 'titlesparks' ) }
								</span>
							</div>

							{ sizingRules.map( ( rule, index ) => (
								<div
									key={ index }
									className="titlesparks:grid titlesparks:grid-cols-[1fr_1fr_auto] titlesparks:items-center titlesparks:gap-2"
								>
									<NumberInput
										value={ rule.font }
										min={ MIN_SIZING_RULE }
										max={ MAX_SIZING_FONT }
										step={ 1 }
										disabled={ ! draft.enabled }
										placeholder="16"
										aria-label={ sprintf(
											/* translators: %d: row number in the size table. */
											__(
												'Size %d title font size in pixels',
												'titlesparks'
											),
											index + 1
										) }
										onChange={ setSizingRule(
											index,
											'font'
										) }
									/>
									<NumberInput
										value={ rule.icon }
										min={ MIN_SIZING_RULE }
										max={ MAX_SIZING_ICON }
										step={ 1 }
										disabled={ ! draft.enabled }
										placeholder="12"
										aria-label={ sprintf(
											/* translators: %d: row number in the size table. */
											__(
												'Size %d icon size in pixels',
												'titlesparks'
											),
											index + 1
										) }
										onChange={ setSizingRule(
											index,
											'icon'
										) }
									/>
									<Button
										variant="ghost"
										size="sm"
										disabled={
											! draft.enabled ||
											sizingRules.length <= 1
										}
										aria-label={ sprintf(
											/* translators: %d: row number in the size table. */
											__(
												'Remove size %d',
												'titlesparks'
											),
											index + 1
										) }
										onClick={ () =>
											removeSizingRule( index )
										}
									>
										{ __( 'Remove', 'titlesparks' ) }
									</Button>
								</div>
							) ) }

							<Button
								variant="secondary"
								size="sm"
								className="titlesparks:self-start"
								disabled={
									! draft.enabled ||
									sizingRules.length >= MAX_SIZING_RULES
								}
								onClick={ addSizingRule }
							>
								{ __( 'Add size', 'titlesparks' ) }
							</Button>
						</div>

						<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
							{ __(
								'Each row sets the icon size for titles from that title size up to the next row — 12 and 10, 16 and 12: a 14px title gets a 10px icon, a 16px title 12px. A title smaller than every row uses the first, one larger than the last uses the last. An empty cell is dropped when you save. Each stage in the post editor can set its own table instead.',
								'titlesparks'
							) }
						</p>
					</div>
				</Row>

				{ /* The icon is positioned, so it already paints above the words.
				     A theme can still stack its own layers over the title — a
				     ribbon, a badge, a hover overlay — and this is the number that
				     decides whether the icon stays in front of them. */ }
				<Row label={ __( 'Icon stacking order', 'titlesparks' ) }>
					<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-2">
						<NumberInput
							value={ draft.icon_z_index ?? ICON_Z_INDEX_DEFAULT }
							step={ 1 }
							disabled={ ! draft.enabled }
							aria-label={ __(
								'Icon stacking order',
								'titlesparks'
							) }
							onChange={ ( event ) => {
								// Read before the update runs: React restores a
								// controlled input's value on the re-render, so an
								// updater that reads the event later sees the old one.
								const { value } = event.target;

								setDraft( ( current ) => ( {
									...current,
									icon_z_index: value,
								} ) );
							} }
						/>
						<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
							{ __(
								'This is the icon\u2019s z-index. 0 is the page\u2019s normal order, which is what every icon has had so far. A higher number draws the icon in front of anything your theme stacks at a lower number; a negative one puts it behind. It applies in the editor and on your site alike.',
								'titlesparks'
							) }
						</p>
					</div>
				</Row>

				{ /* The dates above are counted from here, so say which moment that
				     is: a fixed start is a real date, a post-date start is the clock. */ }
				<p className="titlesparks:m-0 titlesparks:rounded-lg titlesparks:border titlesparks:border-gray-200 titlesparks:bg-white titlesparks:px-4 titlesparks:py-3 titlesparks:text-xs titlesparks:text-gray-500">
					{ 'fixed' === draft.anchor_source
						? __(
								'The dates above are counted from your timeline start.',
								'titlesparks'
							)
						: __(
								'The dates above are counted from now. A new post counts from its own publish date, so only the lengths are saved.',
								'titlesparks'
							) }
				</p>

				{ STAGE_INDEXES.map( ( index ) => {
					const stage = emptyStage(
						draft[ `default_stage_${ index }` ]
					);
					const end = stageEndValue( timeline, index, anchorDate );
					const start = stageStartValue(
						timeline,
						index,
						anchorDate
					);
					const windowLabel = formatStageWindow(
						timeline,
						index,
						anchorDate
					);

					return (
						<Row
							key={ index }
							label={ sprintf(
								/* translators: %d: stage number. */
								__( 'Stage %d icon ends', 'titlesparks' ),
								index
							) }
						>
							<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-1">
								<DateTimeInput
									value={ end }
									min={ start }
									disabled={ ! draft.enabled }
									aria-label={ sprintf(
										/* translators: %d: stage number. */
										__(
											'Date and time stage %d ends',
											'titlesparks'
										),
										index
									) }
									onChange={ ( event ) =>
										setEnd( index, event.target.value )
									}
								/>

								{ windowLabel && (
									<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
										{ sprintf(
											/* translators: 1: how long the stage lasts, 2: its start and end. */
											__(
												'%1$s \u00b7 %2$s',
												'titlesparks'
											),
											formatSeconds(
												stageSeconds( stage )
											),
											windowLabel
										) }
									</p>
								) }
							</div>
						</Row>
					);
				} ) }

				<Row label={ __( 'Final Action (Stage 3)', 'titlesparks' ) }>
					<Select
						value={ timeline.stage_3_behaviour }
						options={ BEHAVIOURS }
						disabled={ ! draft.enabled }
						onChange={ ( behaviour ) =>
							setDraft( ( current ) => ( {
								...current,
								default_behaviour: behaviour,
							} ) )
						}
					/>
				</Row>
			</div>
		</Card>
	);
};

export default DefaultSettings;
