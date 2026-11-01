/**
 * The post editor sidebar.
 *
 * Reads and writes the three stage timeline through the editor's own `meta`
 * object, so the normal post save flow persists it — there is no second "save"
 * button, and an autosave can never lose the author's configuration because the
 * value travels with the post itself.
 *
 * The timeline is stored in the registered string meta field
 * `_titlesparks_timeline_schema` as JSON (`titlesparks_timeline_schema` in REST);
 * the key is read from the server bootstrap so a rename on the PHP side needs no
 * JS change.
 */

import { useEffect, useMemo, useState } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { __, sprintf } from '@wordpress/i18n';

import StageEditor from '@titlesparks/shared/StageEditor';
import {
	timelineEndLabel,
	timelineRemainingSeconds,
} from '@titlesparks/shared/stageDates';
import { Alert, Field, Select, Spinner, Switch } from '@titlesparks/shared/ui';
import { IconHelp, IconTitlesparks } from '@titlesparks/shared/icons';
import {
	ICON_ANCHORS,
	ICON_SPACINGS,
	META_KEY_FALLBACK,
	POST_DISPLAY_CHOICES,
	POST_DISPLAY_LOCATIONS,
	STAGE_INDEXES,
	editorAnchor,
	emptyOffsets,
	formatSeconds,
	positionLabel,
	readTimelineFromJson,
	siteNowSeconds,
	serializeTimeline,
} from '@titlesparks/shared/constants';
import { usePreviewState } from '@titlesparks/shared/editorPreview';
import {
	getEditorData,
	useAssetLibrary,
} from '@titlesparks/shared/useAssetLibrary';

const boot = getEditorData();
const META_KEY = boot.metaKey || META_KEY_FALLBACK;
const BOOT_LOADED_AT = Date.now();
const COUNTDOWN_TICK_MS = 30000;

/**
 * Describe how much time remains before the timeline's scheduled end.
 *
 * @param {number|null} remaining Seconds left, or null without an anchor.
 * @param {string}      behaviour Stage 3 behaviour.
 * @return {string} Countdown text.
 */
const formatCountdown = ( remaining, behaviour ) => {
	if ( null === remaining ) {
		return __(
			'Countdown starts from the post publish date',
			'titlesparks'
		);
	}

	let timeLeft;

	if ( remaining > 0 ) {
		timeLeft = formatSeconds( remaining );
	} else if ( behaviour === 'keep' ) {
		timeLeft = __( 'Stages complete', 'titlesparks' );
	} else {
		timeLeft = __( 'Expired', 'titlesparks' );
	}

	if ( behaviour === 'keep' ) {
		return sprintf(
			/* translators: %s: time remaining before the last stage ends. */
			__( 'Stages finish in %s · icon stays', 'titlesparks' ),
			timeLeft
		);
	}

	return sprintf(
		/* translators: %s: time remaining before the icon disappears. */
		__( 'Icon disappears in %s', 'titlesparks' ),
		timeLeft
	);
};

/**
 * NewsTitleSidebar component.
 *
 * @return {JSX.Element} The panel contents.
 */
const NewsTitleSidebar = () => {
	const { postId, meta, isSaving } = useSelect( ( select ) => {
		const editor = select( editorStore );

		return {
			postId: editor.getCurrentPostId(),
			meta: editor.getEditedPostAttribute( 'meta' ),
			isSaving: editor.isSavingPost(),
		};
	}, [] );
	// The meta object above is needed verbatim to write back. The timeline is
	// read from a primitive selector instead — see the note in
	// `EditorTitleIcon.js` about object selectors and the store's equality
	// check. The canvas reads it the same way, so both stay in step.
	const metaJson = useSelect( ( select ) => {
		const editor = select( editorStore );
		const current = editor.getEditedPostAttribute( 'meta' );

		return ( current && current[ META_KEY ] ) || '';
	}, [] );

	const { editPost } = useDispatch( editorStore );
	const { assets, isLoading } = useAssetLibrary();
	const displayOptions = boot.displayOptions || {};
	const sections = displayOptions.sections || [];
	const widgets = displayOptions.widgets || [];

	const timeline = useMemo(
		() => readTimelineFromJson( metaJson, boot ),
		[ metaJson ]
	);

	// Use the same site-clock snapshot as the canvas, then let the countdown
	// advance while this editor stays open.
	const [ now, setNow ] = useState( () => siteNowSeconds( boot, 0 ) );

	useEffect( () => {
		const timer = window.setInterval(
			() => setNow( siteNowSeconds( boot, Date.now() - BOOT_LOADED_AT ) ),
			COUNTDOWN_TICK_MS
		);

		return () => window.clearInterval( timer );
	}, [] );

	// The end moment is derived from this post's timeline anchor (post publish
	// date or the configured fixed anchor), not from the current editor visit.
	const anchor = editorAnchor( boot );
	const timelineEnd = timelineEndLabel( timeline, anchor );
	const remaining = timelineRemainingSeconds( timeline, anchor, now );
	const countdownLabel = formatCountdown(
		remaining,
		timeline.stage_3_behaviour
	);

	// Reported by the canvas component itself, so this says what is really on
	// the title rather than a second guess at it.
	const canvasState = usePreviewState();

	// Turn the canvas state into a concise live-stage readout, naming the
	// position the way the stage editor does so the two read as the same thing.
	const positionName = positionLabel( canvasState.position );

	const onTitle = canvasState.show
		? sprintf(
				/* translators: 1: stage number, 2: position, 3: asset name. */
				__(
					'On live: stage %1$d \u00b7 %2$s \u00b7 %3$s',
					'titlesparks'
				),
				canvasState.stage,
				positionName,
				canvasState.label
			)
		: __( 'Nothing live on the title.', 'titlesparks' );

	// The Guide tab of the plugin page carries the reasoning this screen used to
	// spell out. Deep linked by hash, which the dashboard reads on load.
	const guideUrl = boot.settingsUrl ? `${ boot.settingsUrl }#guide` : '';

	// Writing straight back to the post meta object is what ties the controls to
	// the database: `editPost` marks the post dirty and the standard update or
	// publish request carries the new value. The value is serialised to the JSON
	// string the registered meta field expects.
	const update = ( next ) => {
		editPost( {
			meta: {
				...( meta || {} ),
				[ META_KEY ]: serializeTimeline( next ),
			},
		} );
	};

	// Stage edits only update their saved settings. The canvas and live
	// highlight remain tied to whichever stage the timeline resolves right now.
	const setStage = ( key ) => ( stage ) =>
		update( { ...timeline, [ key ]: stage } );

	const setDisplayLocation = ( key, value ) =>
		update( {
			...timeline,
			display: {
				...timeline.display,
				locations: { ...timeline.display.locations, [ key ]: value },
			},
		} );

	const setDisplayChoice = ( group, key, value ) =>
		update( {
			...timeline,
			display: {
				...timeline.display,
				[ group ]: { ...timeline.display[ group ], [ key ]: value },
			},
		} );

	// Only ever wait for the post ID, which the editor sets from local state, so
	// this screen can under no circumstances spin forever.
	//
	// In particular, do NOT gate on `editor.hasFinishedResolution(
	// 'getCurrentPost' )`: the `core/editor` store registers no resolvers at all,
	// so it never holds a resolution record for that selector and the call
	// returns false for the whole life of the page. That is a permanent spinner.
	//
	// Nor should this wait on the post request itself:
	// `boot.timeline` is inlined by the server for this very post, and
	// `readTimeline()` prefers the post meta as soon as the editor has it, so
	// the panel paints correct values immediately — and an autosave refetch can
	// no longer blank the open panel.
	if ( ! postId ) {
		return (
			<div className="titlesparks:flex titlesparks:justify-center titlesparks:p-6">
				<Spinner className="titlesparks:text-brand-500" />
			</div>
		);
	}

	return (
		<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-3 titlesparks:p-2.5">
			<header className="titlesparks:flex titlesparks:items-center titlesparks:gap-2">
				<span className="titlesparks:flex titlesparks:h-7 titlesparks:w-7 titlesparks:items-center titlesparks:justify-center titlesparks:rounded-lg titlesparks:bg-brand-900 titlesparks:text-white">
					<IconTitlesparks className="titlesparks:h-4 titlesparks:w-4" />
				</span>
				<h2 className="titlesparks:m-0 titlesparks:text-sm titlesparks:font-semibold titlesparks:text-gray-900">
					{ __( 'TitleSparks', 'titlesparks' ) }
				</h2>
				{ guideUrl && (
					<a
						href={ guideUrl }
						className="titlesparks:ml-auto titlesparks:inline-flex titlesparks:items-center titlesparks:gap-1 titlesparks:text-xs titlesparks:font-medium titlesparks:text-brand-900 titlesparks:hover:underline"
					>
						<IconHelp className="titlesparks:h-3.5 titlesparks:w-3.5" />
						{ __( 'Guide', 'titlesparks' ) }
					</a>
				) }
			</header>

			<p className="titlesparks:m-0 titlesparks:rounded-lg titlesparks:border titlesparks:border-brand-900 titlesparks:bg-brand-900 titlesparks:px-2.5 titlesparks:py-1.5 titlesparks:text-center titlesparks:text-xs titlesparks:font-medium titlesparks:text-white">
				{ onTitle }
			</p>

			{ ! boot.isEnabled && (
				<Alert status="warning">
					{ __( 'Switched off site-wide.', 'titlesparks' ) }{ ' ' }
					{ guideUrl && (
						<a
							href={ boot.settingsUrl }
							className="titlesparks:font-medium titlesparks:text-brand-900 titlesparks:hover:underline"
						>
							{ __( 'Settings', 'titlesparks' ) }
						</a>
					) }
				</Alert>
			) }

			{ isLoading && <Spinner className="titlesparks:text-brand-500" /> }

			{ ! isLoading && assets.length === 0 && (
				<Alert status="warning">
					{ __( 'No assets yet.', 'titlesparks' ) }{ ' ' }
					{ guideUrl && (
						<a
							href={ `${ boot.settingsUrl }#library` }
							className="titlesparks:font-medium titlesparks:text-brand-900 titlesparks:hover:underline"
						>
							{ __( 'Add one', 'titlesparks' ) }
						</a>
					) }
				</Alert>
			) }

			<div className="titlesparks:flex titlesparks:items-center titlesparks:justify-between titlesparks:gap-3 titlesparks:rounded-lg titlesparks:border titlesparks:border-gray-200 titlesparks:bg-white titlesparks:px-2.5 titlesparks:py-1.5">
				<span className="titlesparks:text-xs titlesparks:font-medium titlesparks:text-gray-800">
					{ __( 'Decaying icon', 'titlesparks' ) }
				</span>
				<Switch
					id="titlesparks-post-enabled"
					checked={ !! timeline.enabled }
					onChange={ ( enabled ) =>
						update( { ...timeline, enabled } )
					}
				/>
			</div>

			{ timeline.enabled && (
				<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-3">
					<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-2">
						{ STAGE_INDEXES.map( ( index ) => (
							<StageEditor
								key={ index }
								index={ index }
								stage={ timeline[ `stage_${ index }` ] }
								isLiveStage={
									canvasState.show &&
									canvasState.stage === index
								}
								timeline={ timeline }
								assets={ assets }
								anchorDate={ editorAnchor( boot ) }
								defaultSizingRules={ boot.sizingRules || [] }
								onChange={ setStage( `stage_${ index }` ) }
								offsets={ timeline.position_offsets }
								onOffsetChange={ ( position, offset ) =>
									update( {
										...timeline,
										position_offsets: {
											...emptyOffsets(
												timeline.position_offsets
											),
											[ position ]: offset,
										},
									} )
								}
								onBehaviourChange={
									3 === index
										? ( stage3Behaviour ) =>
												update( {
													...timeline,
													stage_3_behaviour:
														stage3Behaviour,
												} )
										: undefined
								}
							/>
						) ) }
					</div>
					<details className="titlesparks:overflow-hidden titlesparks:rounded-lg titlesparks:border titlesparks:border-gray-200 titlesparks:bg-white">
						<summary className="titlesparks:cursor-pointer titlesparks:bg-brand-900 titlesparks:px-2.5 titlesparks:py-1.5 titlesparks:text-center titlesparks:text-xs titlesparks:font-semibold titlesparks:text-yellow-300 titlesparks:focus:outline titlesparks:focus:outline-2 titlesparks:focus:outline-yellow-400">
							{ __(
								'How the icon sits on this title',
								'titlesparks'
							) }
						</summary>
						<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-1.5 titlesparks:p-2">
							<Field
								label={ __(
									'Icon lines up with',
									'titlesparks'
								) }
							>
								<Select
									value={ timeline.icon_anchor || '' }
									options={ [
										{
											label: __(
												'Use site setting',
												'titlesparks'
											),
											value: '',
										},
										...ICON_ANCHORS,
									] }
									onChange={ ( iconAnchor ) =>
										update( {
											...timeline,
											icon_anchor: iconAnchor,
										} )
									}
								/>
							</Field>
							<Field
								label={ __(
									'Space beside the icon',
									'titlesparks'
								) }
							>
								<Select
									value={ timeline.icon_spacing || '' }
									options={ [
										{
											label: __(
												'Use site setting',
												'titlesparks'
											),
											value: '',
										},
										...ICON_SPACINGS,
									] }
									onChange={ ( iconSpacing ) =>
										update( {
											...timeline,
											icon_spacing: iconSpacing,
										} )
									}
								/>
							</Field>
							<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
								{ __(
									'Only this post\u2019s icon changes; every other post keeps the site setting.',
									'titlesparks'
								) }
							</p>
						</div>
					</details>

					<details className="titlesparks:overflow-hidden titlesparks:rounded-lg titlesparks:border titlesparks:border-gray-200 titlesparks:bg-white">
						<summary className="titlesparks:cursor-pointer titlesparks:bg-brand-900 titlesparks:px-2.5 titlesparks:py-1.5 titlesparks:text-center titlesparks:text-xs titlesparks:font-semibold titlesparks:text-yellow-300 titlesparks:focus:outline titlesparks:focus:outline-2 titlesparks:focus:outline-yellow-400">
							{ __(
								'Where to show this post icon',
								'titlesparks'
							) }
						</summary>
						<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-1.5 titlesparks:p-2">
							{ POST_DISPLAY_LOCATIONS.map( ( location ) => (
								<Field
									key={ location.key }
									label={ location.label }
								>
									<Select
										value={
											timeline.display.locations[
												location.key
											] || 'inherit'
										}
										options={ POST_DISPLAY_CHOICES }
										onChange={ ( value ) =>
											setDisplayLocation(
												location.key,
												value
											)
										}
									/>
								</Field>
							) ) }
							{ sections.map( ( section ) => (
								<Field
									key={ section.id }
									label={ sprintf(
										/* translators: %s: homepage section name. */
										__( 'Homepage: %s', 'titlesparks' ),
										section.name
									) }
								>
									<Select
										value={
											timeline.display.sections[
												section.id
											] || 'inherit'
										}
										options={ POST_DISPLAY_CHOICES }
										onChange={ ( value ) =>
											setDisplayChoice(
												'sections',
												section.id,
												value
											)
										}
									/>
								</Field>
							) ) }
							{ widgets.map( ( widget ) => (
								<Field
									key={ widget.id }
									label={ sprintf(
										/* translators: %s: widget name. */
										__( 'Widget: %s', 'titlesparks' ),
										widget.name
									) }
								>
									<Select
										value={
											timeline.display.widgets[
												widget.id
											] || 'inherit'
										}
										options={ POST_DISPLAY_CHOICES }
										onChange={ ( value ) =>
											setDisplayChoice(
												'widgets',
												widget.id,
												value
											)
										}
									/>
								</Field>
							) ) }
							<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
								{ __(
									'Use site setting follows the default; Show or Hide overrides it for this post.',
									'titlesparks'
								) }
							</p>
						</div>
					</details>

					<span className="titlesparks:relative titlesparks:flex titlesparks:w-full titlesparks:flex-wrap titlesparks:items-center titlesparks:justify-center titlesparks:gap-1 titlesparks:rounded-md titlesparks:bg-red-700 titlesparks:px-2 titlesparks:py-1 titlesparks:text-center titlesparks:text-xs titlesparks:font-medium titlesparks:text-white">
						<strong className="titlesparks:font-semibold">
							{ countdownLabel }
						</strong>
						{ timelineEnd && (
							<span>
								{ sprintf(
									/* translators: %s: date and time the last stage ends. */
									__( '· ends %s', 'titlesparks' ),
									timelineEnd
								) }
							</span>
						) }
						{ isSaving && (
							<Spinner className="titlesparks:absolute titlesparks:right-2 titlesparks:text-white" />
						) }
					</span>
				</div>
			) }
		</div>
	);
};

export default NewsTitleSidebar;
