/**
 * Controls for a single stage of the timeline.
 *
 * Compact by design: the card carries the four things an author changes — the
 * icon, where it sits, what size it is, and when it stops — and nothing else.
 * The reasoning behind each control lives on the admin's Guide tab, so this
 * screen stays readable at a glance: help text is one short line at most, and
 * the offset's sign rules sit in the field's tooltip rather than on a line of
 * their own.
 *
 * Those four controls are grouped into two blocks by what they describe:
 * position above the end, because together they say where the icon is and how
 * long it stays there, then size above the offset, because those are the two
 * things that only change how the icon is drawn. The fields in a block stack
 * one per line — the sidebar is too narrow for a date picker or a pair of
 * number fields to share a row and stay readable. The card itself collapses,
 * and starts closed, so the sidebar reads as a list of three stages rather than
 * a column of a dozen fields; the header is the toggle and doubles as the
 * summary.
 */

import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

import AssetPickerModal from './AssetPickerModal';
import {
	BEHAVIOURS,
	DEFAULT_SIZING_RULES,
	MAX_SIZING_FONT,
	MAX_SIZING_ICON,
	MAX_SIZING_RULES,
	MIN_SIZING_RULE,
	OFFSET_MAX,
	POSITIONS,
	SIZE_UNITS,
	UNITS,
	assetKind,
	convertDuration,
	emptyOffset,
	emptyStage,
	formatStageWindow,
	iconSize,
	joinCssSize,
	maxForUnit,
	normalizeSizingRules,
	offsetHint,
	sanitizeDuration,
	sanitizeOffset,
	splitCssSize,
} from './constants';
import { IconChevron, IconImage } from './icons';
import { stageEndValue, stageStartValue, withStageEnd } from './stageDates';
import {
	Button,
	Checkbox,
	DateTimeInput,
	Field,
	NumberInput,
	Select,
} from './ui';

/**
 * Stage titles, matching the editor design.
 */
const STAGE_TITLES = {
	1: __( 'Initial Icon', 'titlesparks' ),
	2: __( 'Mid Icon', 'titlesparks' ),
	3: __( 'Final Icon', 'titlesparks' ),
};

/**
 * The size label, named for the kind of asset the stage is using.
 *
 * "Size" on its own does not say what is being sized; naming the kind makes
 * the field self-explanatory without a hint line under it. Keyed by the values
 * `assetKind()` returns.
 */
/**
 * The sizing choices, in the order the select lists them.
 *
 * `advanced` is the one that follows the title, from a table the stage owns —
 * which is why its fields only appear once it is chosen. `fixed` is first
 * because it is the default.
 */
const SIZING_MODES = [
	{ label: __( 'Fixed size', 'titlesparks' ), value: 'fixed' },
	{
		label: __( 'Advanced (custom sizes)', 'titlesparks' ),
		value: 'advanced',
	},
];

const SIZE_LABELS = {
	gif: __( 'GIF size', 'titlesparks' ),
	icon: __( 'Icon size', 'titlesparks' ),
	image: __( 'Image size', 'titlesparks' ),
};

/**
 * StageEditor component.
 *
 * @param {Object}   props
 * @param {number}   props.index                Stage index (1-3).
 * @param {Object}   props.stage                Current stage value.
 * @param {Object}   props.timeline             Whole timeline, used for the date preview.
 * @param {Array}    props.assets               Normalised library assets.
 * @param {string}   props.anchorDate           The moment the timeline starts
 *                                              (`Y-m-d H:i:s`, site time): the
 *                                              post date, or the date the site
 *                                              settings start timelines on. The
 *                                              end picker counts from it.
 * @param {Function} props.onChange             Receives the next stage value.
 * @param {Function} [props.onBehaviourChange]  Updates the timeline's stage 3
 *                                              behaviour (stage 3 only).
 * @param {Function} [props.onOffsetChange]     Receives `( position, offset )`.
 * @param {Object}   [props.offsets]            Offsets keyed by position.
 * @param {boolean}  [props.isLiveStage]        Whether this stage is shown on the title.
 * @param {Array}    [props.defaultSizingRules] The site's title-size bands, which a
 *                                              stage without its own table follows.
 * @param {boolean}  props.disabled             Whether the whole timeline is off.
 * @return {import('react').ReactElement} Stage controls.
 */
const StageEditor = ( {
	index,
	stage,
	timeline,
	assets,
	anchorDate,
	onChange,
	onBehaviourChange,
	onOffsetChange,
	offsets,
	isLiveStage = false,
	defaultSizingRules = DEFAULT_SIZING_RULES,
	disabled,
} ) => {
	const [ picking, setPicking ] = useState( false );
	// Closed to begin with: three stages of controls is a long column in a
	// sidebar this narrow, and most visits touch one stage only. Opening is a
	// click on the header, which still names the stage while it is shut.
	const [ open, setOpen ] = useState( false );
	const current = emptyStage( stage );
	// The nudge belongs to the position, not to this stage: read it back by the
	// keyword the stage is using, so switching position switches the numbers.
	const offset = emptyOffset( ( offsets || {} )[ current.position ] );
	const fieldId = ( axis ) => `titlesparks-offset-${ index }-${ axis }`;

	// What each number field is showing. `null` means "nothing in progress", so
	// the field prints the stored value. A field being typed into holds the
	// author's own text instead, because a browser reports a half-typed number
	// — a lone `-`, a trailing `.`, an emptied field — as an empty value for
	// `type="number"`. Writing that back as `sanitizeOffset()`'s `0` would
	// erase the minus before the digits arrive, which is why a negative offset
	// could not be entered at all: the field jumped to `0` on the first key.
	const [ offsetDrafts, setOffsetDrafts ] = useState( {
		x: null,
		y: null,
	} );

	// Anything that changes the stored nudge from elsewhere — Reset, a position
	// switch, an undo — ends any draft, so the fields always describe the value
	// that is really saved rather than a half-typed one.
	useEffect( () => {
		setOffsetDrafts( ( previous ) =>
			null === previous.x && null === previous.y
				? previous
				: { x: null, y: null }
		);
	}, [ current.position, offset.x, offset.y ] );

	const offsetText = ( axis ) =>
		null === offsetDrafts[ axis ] || undefined === offsetDrafts[ axis ]
			? String( offset[ axis ] )
			: offsetDrafts[ axis ];

	/**
	 * Record one offset field's text, and write the number when there is one.
	 *
	 * The draft is kept whatever is typed, so the field never rewrites itself
	 * mid-entry; the timeline is only written when the text contains a digit,
	 * which is what makes `-`, `-1`, `-16` a single, smooth entry rather than
	 * three writes that fight the caret.
	 *
	 * @param {string} axis `x` or `y`.
	 * @param {string} text Field value.
	 * @return {void}
	 */
	const setOffset = ( axis, text ) => {
		setOffsetDrafts( ( previous ) => ( { ...previous, [ axis ]: text } ) );

		if ( ! /\d/.test( text ) ) {
			return;
		}

		const next = sanitizeOffset( text );

		if ( next === offset[ axis ] || ! onOffsetChange ) {
			return;
		}

		onOffsetChange( current.position, { ...offset, [ axis ]: next } );
	};

	const nudge = ( axis ) => ( event ) =>
		setOffset( axis, event.target.value );

	// A field left empty or half-typed goes back to describing the stored
	// number once the author moves on.
	const endDraft = ( axis ) => () =>
		setOffsetDrafts( ( previous ) =>
			null === previous[ axis ]
				? previous
				: { ...previous, [ axis ]: null }
		);

	const selected = assets.find( ( asset ) => asset.id === current.asset_id );
	// Plain "Size" until something is picked; after that the label says what is
	// being sized, so a GIF stage reads "GIF size" and an SVG reads "Icon size".
	const sizeLabel = selected
		? SIZE_LABELS[ assetKind( selected ) ]
		: __( 'Size', 'titlesparks' );
	const windowLabel = formatStageWindow( timeline, index, anchorDate );

	// A stage is edited by its end, not by a number of days: the stages are
	// contiguous, so the end is the thing an author can point at, and the
	// length is what falls out of it. The picker needs a moment to count from,
	// though: without one — a post with no date yet — the length itself is all
	// there is to set.
	const startValue = stageStartValue( timeline, index, anchorDate );
	const endValue = stageEndValue( timeline, index, anchorDate );
	const endFieldId = `titlesparks-end-${ index }`;

	// Ties the header to the block it opens, for assistive tech.
	const bodyId = `titlesparks-stage-${ index }`;

	// The size in effect: this stage's own, or the asset's. An empty stage size
	// is what "inherit" looks like on screen — the fields fall back to showing
	// the asset's size, so what is displayed is always what will be drawn.
	const inherited = iconSize( { size: '' }, selected || {} );
	const size = splitCssSize( current.size, inherited );
	const sizeFieldId = `titlesparks-size-${ index }`;
	const modeFieldId = `titlesparks-size-mode-${ index }`;
	const patch = ( changes ) => onChange( { ...current, ...changes } );

	// The table this stage is sized from: its own bands, or the site's when it
	// has never set any. Editing starts from a copy of whichever is in effect,
	// so the numbers on screen are the numbers the icon will be drawn at.
	const siteRules = normalizeSizingRules( defaultSizingRules );
	const storedRules = current.sizing_rules.length
		? current.sizing_rules
		: siteRules;
	// A stage's own table is only offered in Advanced, which is the one mode
	// that follows the title; the fields cannot disagree with the mode in
	// front of the author.
	const advanced = 'advanced' === current.size_mode;

	// What the band fields are showing, with `null` for "nothing in progress",
	// the same draft the offset fields keep. A number being typed is not a
	// number yet — `1` on the way to `12` is below the smallest band — so the
	// draft holds exactly what was typed while the stored rows hold only the
	// values that are usable.
	const [ ruleDrafts, setRuleDrafts ] = useState( null );

	// A different stage is a different table.
	useEffect( () => {
		setRuleDrafts( null );
	}, [ index ] );

	const rows =
		ruleDrafts ||
		storedRules.map( ( rule ) => ( {
			font: String( rule.font ),
			icon: String( rule.icon ),
		} ) );

	/**
	 * Record the whole table, and write the usable rows it names.
	 *
	 * A row with a number still being typed is kept in the draft and left out
	 * of the timeline; the server drops an unusable row on save as well, so the
	 * two agree about what a table is.
	 *
	 * @param {Array} next `{ font, icon }` text rows.
	 * @return {void}
	 */
	const writeRules = ( next ) => {
		setRuleDrafts( next );
		patch( {
			sizing_rules: next
				.map( ( row ) => ( {
					font: Number.parseInt( row.font, 10 ),
					icon: Number.parseInt( row.icon, 10 ),
				} ) )
				// The server's own bounds, so the timeline never holds a row
				// the canvas or the saved post would drop anyway.
				.filter(
					( row ) =>
						Number.isFinite( row.font ) &&
						Number.isFinite( row.icon ) &&
						row.font >= MIN_SIZING_RULE &&
						row.icon >= MIN_SIZING_RULE &&
						row.font <= MAX_SIZING_FONT &&
						row.icon <= MAX_SIZING_ICON
				)
				.slice( 0, MAX_SIZING_RULES ),
		} );
	};

	const setRule = ( row, key ) => ( event ) => {
		// Read before the update runs: React restores a controlled input's value
		// on the re-render, so an updater that reads the event later sees the
		// old one.
		const { value } = event.target;

		writeRules(
			rows.map( ( draft, at ) =>
				at === row ? { ...draft, [ key ]: value } : draft
			)
		);
	};

	const addRule = () => {
		if ( rows.length >= MAX_SIZING_RULES ) {
			return;
		}

		writeRules( [ ...rows, { font: '', icon: '' } ] );
	};

	const removeRule = ( row ) =>
		writeRules( rows.filter( ( draft, at ) => at !== row ) );

	// Either field may move: the two together are the size, so they are sent as
	// one value rather than each writing half of it.
	const changeSize = ( changes ) => {
		const next = { ...size, ...changes };

		return patch( { size: joinCssSize( next.number, next.unit ) } );
	};

	const changeEnd = ( value ) => {
		const next = withStageEnd( timeline, index, anchorDate, value );

		if ( next ) {
			onChange( next );
		}
	};

	// Keep the number sensible when the unit flips: 1 day becomes 24 hours.
	const changeUnit = ( unit ) =>
		patch( {
			unit,
			duration: sanitizeDuration(
				convertDuration( current.duration, current.unit, unit ),
				unit
			),
		} );

	return (
		<div className="titlesparks:overflow-hidden titlesparks:rounded-lg titlesparks:border titlesparks:border-gray-200 titlesparks:bg-white">
			{ /* The whole header toggles the card, so there is one obvious target
			     and no separate chevron button to hunt for. */ }
			<button
				type="button"
				onClick={ () => setOpen( ( value ) => ! value ) }
				aria-expanded={ open }
				aria-controls={ bodyId }
				className={ `titlesparks:flex titlesparks:w-full titlesparks:cursor-pointer titlesparks:items-center titlesparks:gap-2 titlesparks:border-0 ${
					! open && isLiveStage
						? 'titlesparks:bg-amber-300'
						: 'titlesparks:bg-brand-50'
				} titlesparks:px-2.5 titlesparks:py-1.5 titlesparks:text-left titlesparks:focus:outline titlesparks:focus:outline-2 titlesparks:focus:outline-brand-500` }
			>
				<span className="titlesparks:flex titlesparks:h-5 titlesparks:w-5 titlesparks:items-center titlesparks:justify-center titlesparks:rounded-full titlesparks:bg-brand-900 titlesparks:text-xs titlesparks:font-semibold titlesparks:text-white">
					{ index }
				</span>
				<span className="titlesparks:text-xs titlesparks:font-semibold titlesparks:text-gray-800">
					{ STAGE_TITLES[ index ] || '' }
				</span>

				<span className="titlesparks:ml-auto titlesparks:flex titlesparks:min-w-0 titlesparks:items-center titlesparks:gap-1.5">
					{ selected && (
						<span className="titlesparks:truncate titlesparks:text-xs titlesparks:text-gray-500">
							{ selected.label }
						</span>
					) }
					{ /* Pointing down while shut, turned up once open. The
					     rotation is a plain inline transform: the Tailwind
					     rotate utilities need the `--tw-rotate` default that the
					     omitted preflight would otherwise supply. */ }
					<span
						className="titlesparks:flex titlesparks:shrink-0 titlesparks:text-gray-400"
						style={
							open ? { transform: 'rotate(180deg)' } : undefined
						}
					>
						<IconChevron className="titlesparks:h-3.5 titlesparks:w-3.5" />
					</span>
				</span>
			</button>

			{ open && (
				<div
					id={ bodyId }
					className="titlesparks:flex titlesparks:flex-col titlesparks:gap-2 titlesparks:border-t titlesparks:border-gray-100 titlesparks:p-2"
				>
					<div className="titlesparks:flex titlesparks:items-center titlesparks:justify-between titlesparks:gap-2">
						<Button
							size="sm"
							variant="secondary"
							disabled={ disabled }
							onClick={ () => setPicking( true ) }
						>
							{ selected
								? __( 'Change', 'titlesparks' )
								: __( 'Select icon', 'titlesparks' ) }
						</Button>

						<span className="titlesparks:flex titlesparks:h-12 titlesparks:w-16 titlesparks:shrink-0 titlesparks:items-center titlesparks:justify-center titlesparks:overflow-hidden titlesparks:rounded-md titlesparks:border titlesparks:border-gray-200 titlesparks:bg-white">
							{ selected ? (
								<img
									src={ selected.url }
									alt={ selected.label }
									style={
										current.flip
											? { transform: 'scaleX(-1)' }
											: undefined
									}
									className="titlesparks:max-h-10 titlesparks:max-w-14 titlesparks:w-auto"
								/>
							) : (
								<span className="titlesparks:text-gray-300">
									<IconImage />
								</span>
							) }
						</span>
					</div>

					{ /* Where the icon sits, and how long it stays: one block, with
					     each field on its own line so neither is squeezed. */ }
					<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-1.5">
						<Field label={ __( 'Position', 'titlesparks' ) }>
							<Select
								value={ current.position }
								options={ POSITIONS }
								disabled={ disabled }
								onChange={ ( position ) =>
									patch( { position } )
								}
							/>
						</Field>

						{ /* Some assets — arrows, hands, faces — point one way. The
						     mirror is the stage's own, so one post can turn the icon
						     around without changing the library or any other stage. */ }
						<Checkbox
							label={ __( 'Flip horizontally', 'titlesparks' ) }
							checked={ current.flip }
							disabled={ disabled }
							onChange={ ( flip ) => patch( { flip } ) }
						/>

						{ '' !== startValue ? (
							<Field
								htmlFor={ endFieldId }
								label={ __( 'Ends', 'titlesparks' ) }
							>
								<DateTimeInput
									id={ endFieldId }
									value={ endValue }
									min={ startValue }
									disabled={ disabled }
									onChange={ ( event ) =>
										changeEnd( event.target.value )
									}
								/>
							</Field>
						) : (
							<Field label={ __( 'Duration', 'titlesparks' ) }>
								<div className="titlesparks:flex titlesparks:gap-2">
									<NumberInput
										min={ 0 }
										max={ maxForUnit( current.unit ) }
										step={ 1 }
										value={ current.duration }
										disabled={ disabled }
										aria-label={ __(
											'Duration',
											'titlesparks'
										) }
										onChange={ ( event ) =>
											patch( {
												duration: sanitizeDuration(
													event.target.value,
													current.unit
												),
											} )
										}
									/>
									<Select
										className="titlesparks:w-24"
										value={ current.unit }
										options={ UNITS }
										disabled={ disabled }
										onChange={ changeUnit }
									/>
								</div>
							</Field>
						) }
					</div>

					{ /* How the icon is drawn: a fixed size, or the title's own size
					     from this stage's table of title sizes. */ }
					<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-1.5">
						<Field
							htmlFor={ modeFieldId }
							label={ __( 'Sizing mode', 'titlesparks' ) }
						>
							<Select
								id={ modeFieldId }
								value={ current.size_mode }
								options={ SIZING_MODES }
								disabled={ disabled }
								aria-label={ sprintf(
									/* translators: %d: stage number. */
									__(
										'Stage %d icon sizing mode',
										'titlesparks'
									),
									index
								) }
								onChange={ ( sizeMode ) => {
									setRuleDrafts( null );
									patch( { size_mode: sizeMode } );
								} }
							/>
						</Field>
						{ advanced ? (
							<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-1.5">
								<div className="titlesparks:grid titlesparks:grid-cols-[1fr_1fr_auto] titlesparks:gap-2 titlesparks:text-xs titlesparks:font-medium titlesparks:text-gray-600">
									<span>
										{ __(
											'Title size (px)',
											'titlesparks'
										) }
									</span>
									<span>
										{ __(
											'Icon size (px)',
											'titlesparks'
										) }
									</span>
									<span className="titlesparks:sr-only">
										{ __( 'Remove size', 'titlesparks' ) }
									</span>
								</div>

								{ rows.map( ( rule, row ) => (
									<div
										key={ row }
										className="titlesparks:grid titlesparks:grid-cols-[1fr_1fr_auto] titlesparks:items-center titlesparks:gap-2"
									>
										<NumberInput
											value={ rule.font }
											min={ MIN_SIZING_RULE }
											max={ MAX_SIZING_FONT }
											step={ 1 }
											disabled={ disabled }
											placeholder="16"
											aria-label={ sprintf(
												/* translators: 1: stage number, 2: row number in the size table. */
												__(
													'Stage %1$d size %2$d title font size in pixels',
													'titlesparks'
												),
												index,
												row + 1
											) }
											onChange={ setRule( row, 'font' ) }
										/>
										<NumberInput
											value={ rule.icon }
											min={ MIN_SIZING_RULE }
											max={ MAX_SIZING_ICON }
											step={ 1 }
											disabled={ disabled }
											placeholder="12"
											aria-label={ sprintf(
												/* translators: 1: stage number, 2: row number in the size table. */
												__(
													'Stage %1$d size %2$d icon size in pixels',
													'titlesparks'
												),
												index,
												row + 1
											) }
											onChange={ setRule( row, 'icon' ) }
										/>
										<Button
											variant="ghost"
											size="sm"
											disabled={
												disabled || rows.length <= 1
											}
											aria-label={ sprintf(
												/* translators: 1: stage number, 2: row number in the size table. */
												__(
													'Remove stage %1$d size %2$d',
													'titlesparks'
												),
												index,
												row + 1
											) }
											onClick={ () => removeRule( row ) }
										>
											{ __( 'Remove', 'titlesparks' ) }
										</Button>
									</div>
								) ) }

								<div className="titlesparks:flex titlesparks:flex-wrap titlesparks:gap-x-3 titlesparks:gap-y-1">
									<Button
										variant="secondary"
										size="sm"
										disabled={
											disabled ||
											rows.length >= MAX_SIZING_RULES
										}
										onClick={ addRule }
									>
										{ __( 'Add size', 'titlesparks' ) }
									</Button>
								</div>

								<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
									{ current.sizing_rules.length > 0
										? __(
												'This stage uses its own table. Each row sets the icon size for titles from that title size up to the next row; the first row holds below it and the last above it.',
												'titlesparks'
											)
										: __(
												'These are the site\u2019s sizes; editing one gives this stage a table of its own, which starts as a copy of them. Each row sets the icon size for titles from that title size up to the next row.',
												'titlesparks'
											) }
								</p>
							</div>
						) : (
							<Field htmlFor={ sizeFieldId } label={ sizeLabel }>
								<div className="titlesparks:flex titlesparks:gap-1">
									<NumberInput
										id={ sizeFieldId }
										min={ 1 }
										max={ 9999 }
										step={ 1 }
										value={
											current.size ? size.number : ''
										}
										placeholder={ size.number }
										disabled={ disabled }
										onChange={ ( event ) =>
											changeSize( {
												number: event.target.value,
											} )
										}
									/>
									<Select
										className="titlesparks:w-20"
										value={ size.unit }
										options={ SIZE_UNITS }
										disabled={ disabled }
										aria-label={ __(
											'Icon size unit',
											'titlesparks'
										) }
										onChange={ ( unit ) =>
											changeSize( { unit } )
										}
									/>
								</div>
							</Field>
						) }
						{ /* Offset owns a header (its name and Reset) above two equal
						     columns; each column puts its axis label directly over the
						     field it names. The tooltip carries the sign rules. */ }
						{ onOffsetChange && (
							<div
								className="titlesparks:flex titlesparks:flex-col titlesparks:gap-1"
								title={ offsetHint( current.position ) }
							>
								<div className="titlesparks:flex titlesparks:items-center titlesparks:justify-between titlesparks:gap-2">
									<span className="titlesparks:text-xs titlesparks:font-medium titlesparks:text-gray-600">
										{ __( 'Offset', 'titlesparks' ) }
									</span>
									<Button
										className="titlesparks:shrink-0 titlesparks:px-1.5"
										size="sm"
										variant="link"
										disabled={ disabled }
										onClick={ () => {
											setOffsetDrafts( {
												x: null,
												y: null,
											} );
											onOffsetChange(
												current.position,
												emptyOffset()
											);
										} }
									>
										{ __( 'Reset', 'titlesparks' ) }
									</Button>
								</div>
								<div className="titlesparks:grid titlesparks:grid-cols-2 titlesparks:gap-2">
									{ [ 'x', 'y' ].map( ( axis ) => (
										<div
											key={ axis }
											className="titlesparks:flex titlesparks:min-w-0 titlesparks:flex-col titlesparks:gap-1"
										>
											<label
												htmlFor={ fieldId( axis ) }
												className="titlesparks:text-xs titlesparks:text-gray-500"
											>
												{ axis }
											</label>
											<NumberInput
												id={ fieldId( axis ) }
												className="titlesparks:min-w-0 titlesparks:px-1.5"
												min={ -OFFSET_MAX }
												max={ OFFSET_MAX }
												step={ 1 }
												value={ offsetText( axis ) }
												disabled={ disabled }
												onChange={ nudge( axis ) }
												onBlur={ endDraft( axis ) }
											/>
										</div>
									) ) }
								</div>
							</div>
						) }
					</div>

					{ windowLabel && (
						<p className="titlesparks:m-0 titlesparks:text-center titlesparks:text-xs titlesparks:font-medium titlesparks:text-yellow-600">
							{ windowLabel }
						</p>
					) }

					{ 3 === index && onBehaviourChange && (
						<Field label={ __( 'After stage 3', 'titlesparks' ) }>
							<Select
								value={ timeline.stage_3_behaviour }
								options={ BEHAVIOURS }
								disabled={ disabled }
								onChange={ onBehaviourChange }
							/>
						</Field>
					) }
				</div>
			) }

			{ picking && (
				<AssetPickerModal
					assets={ assets }
					selectedId={ current.asset_id }
					onSelect={ ( assetId ) => {
						patch( { asset_id: assetId } );
						setPicking( false );
					} }
					onClose={ () => setPicking( false ) }
				/>
			) }
		</div>
	);
};

export default StageEditor;
