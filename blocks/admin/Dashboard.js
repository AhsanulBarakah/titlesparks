/**
 * The TitleSparks admin dashboard.
 *
 * Three tabs: "Global Settings" holds the asset library plus the defaults new
 * posts inherit, "Asset Library" is a focused manager with search and type
 * filters, and "Guide" carries the explanations the editor sidebar keeps out of
 * the way. The active tab is taken from the URL hash, so the editor can link
 * straight to a tab.
 *
 * Settings are edited as a local draft and saved explicitly, so toggling the
 * master switch cannot half-apply while the admin is still choosing post types.
 * Library rows, folders and tags, by contrast, save immediately because each
 * edit is atomic.
 *
 * The folder being shown belongs to the dashboard rather than to either tab,
 * because the folder list sits beside the grid on both of them: the two have to
 * agree on which folder is open when a reader switches tab.
 */

import { useEffect, useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import {
	Alert,
	Badge,
	Button,
	Spinner,
	Tabs,
	cx,
} from '@titlesparks/shared/ui';
import { IconHelp, IconImage, IconSliders } from '@titlesparks/shared/icons';
import {
	emptyTimeline,
	iconAnchorMode,
	iconSpacingMode,
	iconZIndex,
	normalizeSizingRules,
	tightFitMode,
} from '@titlesparks/shared/constants';
import { useMediaFrame } from '@titlesparks/shared/useMediaFrame';
import AssetFolders from './AssetFolders';
import AssetLibrarySection from './AssetLibrarySection';
import DefaultSettings from './DefaultSettings';
import Guide from './Guide';
import InfoCards from './InfoCards';
import useLibrary, { getAdminData } from './useLibrary';

const boot = getAdminData();

/**
 * Build the editable settings draft from the stored settings.
 *
 * @param {Object} settings Stored settings.
 * @return {Object} Draft.
 */
const makeDraft = ( settings = {} ) => ( {
	enabled: Boolean( settings.enabled ),
	post_types: Array.isArray( settings.post_types ) ? settings.post_types : [],
	display_locations: {
		singular: settings.display_locations?.singular !== false,
		home: settings.display_locations?.home !== false,
		archive: settings.display_locations?.archive !== false,
		search: settings.display_locations?.search !== false,
	},
	widget_display: settings.widget_display || {},
	section_display: settings.section_display || {},
	default_stage_1: settings.default_stage_1,
	default_stage_2: settings.default_stage_2,
	default_stage_3: settings.default_stage_3,
	default_behaviour: settings.default_behaviour || 'keep',
	// One switch: `wrap` makes room for the icon inside a narrow card, `keep`
	// leaves the author's icon exactly as it was placed. A retired answer from
	// an older version normalises to `keep`.
	tight_fit: tightFitMode( settings.tight_fit ),
	// Whether a reader whose system asks for less motion is drawn a still copy
	// of an animated icon. On unless the site turned it off, matching what the
	// plugin stores for a site that has never saved this row.
	reduced_motion: settings.reduced_motion !== false,
	// What the icon's X and Y offsets count from: the first line of the title,
	// or the middle of all of its lines.
	icon_anchor: iconAnchorMode( settings.icon_anchor ),
	// The space beside the icon, which a post may overrule for its own icon.
	icon_spacing: iconSpacingMode( settings.icon_spacing ),
	// The page's stacking order for the icon. 0 is the normal order, so an
	// untouched site keeps drawing the icon exactly where it did.
	icon_z_index: iconZIndex( settings.icon_z_index ),
	// The bands an icon that follows the title is sized from, site-wide. Held
	// as text because a number that is still being typed is not one yet: the
	// server normalises, sorts and drops empty rows when the settings are
	// saved.
	sizing_rules: normalizeSizingRules( settings.sizing_rules ).map(
		( rule ) => ( { font: String( rule.font ), icon: String( rule.icon ) } )
	),
	// Where a timeline starts is a site-wide choice; a post can still store an
	// anchor of its own, which this never touches.
	anchor_source: settings.anchor_source === 'fixed' ? 'fixed' : 'post',
	anchor_datetime: settings.anchor_datetime || '',
} );

const TABS = [
	{
		label: __( 'Settings', 'titlesparks' ),
		value: 'settings',
		icon: IconSliders,
	},
	{
		label: __( 'Library', 'titlesparks' ),
		value: 'library',
		icon: IconImage,
	},
	{ label: __( 'Guide', 'titlesparks' ), value: 'guide', icon: IconHelp },
];

/**
 * The tab named by the URL hash, if any.
 *
 * `#guide` and `#library` are linked from the post editor, where an author is
 * more likely to want the explanation than the settings form.
 *
 * @return {string} Tab value.
 */
const tabFromHash = () => {
	const hash =
		typeof window === 'undefined'
			? ''
			: String( window.location.hash || '' ).replace( '#', '' );

	return TABS.some( ( tab ) => tab.value === hash ) ? hash : 'settings';
};

/**
 * Dashboard component.
 *
 * @return {JSX.Element} The dashboard.
 */
const Dashboard = () => {
	const {
		settings,
		assets,
		folders,
		isSaving,
		notice,
		clearNotice,
		saveSettings,
		scanHomepageSections,
		addAttachments,
		updateAsset,
		deleteAsset,
		saveFolder,
		deleteFolder,
	} = useLibrary();

	const [ tab, setTab ] = useState( tabFromHash );
	const [ draft, setDraft ] = useState( () => makeDraft( settings ) );
	const [ mediaError, setMediaError ] = useState( false );
	const [ activeFolder, setActiveFolder ] = useState( '' );
	const [ selectedTag, setSelectedTag ] = useState( '' );
	// The homepage scan lives above the settings card so the Deep scan button
	// can refresh both lists without reloading the dashboard or touching the
	// unsaved settings draft.
	const [ sections, setSections ] = useState( () => boot.sections || [] );
	const [ widgets, setWidgets ] = useState( () => boot.widgets || [] );
	const [ isScanning, setScanning ] = useState( false );

	// The tab and the URL hash describe the same choice, so they have to move
	// together. The links that cross between tabs — "Back to settings" on the
	// Guide, "Open the Guide" beside the settings — are plain anchors to
	// `#settings` and `#guide`, and a hash nobody listens for changes the address
	// bar and nothing else. Writing the hash when a tab is clicked is the other
	// half: a link to the tab already open then still changes the URL, so the
	// anchor is never a no-op.
	const changeTab = ( next ) => {
		setTab( next );

		if ( typeof window !== 'undefined' && window.history.replaceState ) {
			window.history.replaceState( null, '', `#${ next }` );
		}
	};

	useEffect( () => {
		const followHash = () => setTab( tabFromHash() );

		window.addEventListener( 'hashchange', followHash );

		return () => window.removeEventListener( 'hashchange', followHash );
	}, [] );

	const rescanHomepage = async () => {
		setScanning( true );

		const response = await scanHomepageSections();

		if ( response && Array.isArray( response.sections ) ) {
			setSections( response.sections );
		}

		if ( response && Array.isArray( response.widgets ) ) {
			setWidgets( response.widgets );
		}

		setScanning( false );
	};

	// A folder that has just been deleted resolves to nothing, which is the same
	// as showing everything: the grid cannot be left asking for a folder that is
	// gone, and the reader is not sent to a second empty screen to recover.
	const folder = folders.find( ( item ) => item.id === activeFolder ) || null;

	// Re-sync whenever the stored settings change (first fetch, or a save).
	useEffect( () => {
		setDraft( makeDraft( settings ) );
	}, [ settings ] );

	const defaultsTimeline = useMemo(
		() =>
			emptyTimeline( {
				stage_1: draft.default_stage_1,
				stage_2: draft.default_stage_2,
				stage_3: draft.default_stage_3,
				stage_3_behaviour: draft.default_behaviour,
			} ),
		[ draft ]
	);

	const dirty =
		JSON.stringify( draft ) !== JSON.stringify( makeDraft( settings ) );

	const openMedia = useMediaFrame( {
		onSelect: ( attachments ) => addAttachments( attachments ),
		onError: () => setMediaError( true ),
	} );

	// The moment the default stages are counted from, so their end dates read as
	// real calendar dates rather than as a number of days. A fixed start is that
	// moment; a post-date start has no post yet, so the site's clock stands in
	// and a new post counts from its own publish date.
	const anchor =
		'fixed' === draft.anchor_source && draft.anchor_datetime
			? draft.anchor_datetime
			: boot.anchor || '';

	return (
		<div className="titlesparks:mx-auto titlesparks:w-full titlesparks:max-w-6xl">
			{ /* One bar holds the whole screen's chrome: identity, the three
			     sections, and the one action that writes. It sticks under the admin
			     bar on wide screens, so the section you are in and the button that
			     saves it stay in reach down a long settings form.

			     The name stays at the left, where a product's name belongs. The
			     version moved to the far right, past a hairline: it answers "which
			     build am I on?" without competing with the name for the first thing
			     an eye lands on. */ }
			<header className="titlesparks:mb-5 titlesparks:flex titlesparks:flex-wrap titlesparks:items-center titlesparks:gap-x-4 titlesparks:gap-y-3 titlesparks:rounded-xl titlesparks:border titlesparks:border-gray-200 titlesparks:bg-white titlesparks:px-4 titlesparks:py-3 titlesparks:lg:sticky titlesparks:lg:top-8 titlesparks:lg:z-20">
				<div className="titlesparks:flex titlesparks:items-center titlesparks:gap-2.5">
					<span className="titlesparks:flex titlesparks:h-9 titlesparks:w-9 titlesparks:items-center titlesparks:justify-center titlesparks:rounded-lg titlesparks:bg-brand-900 titlesparks:text-white">
						<img
							className="titlesparks:h-8 titlesparks:w-8"
							src={ boot.dashboardLogoUrl || '' }
							alt=""
							aria-hidden="true"
						/>
					</span>
					<h1 className="titlesparks:m-0 titlesparks:text-base titlesparks:font-semibold titlesparks:tracking-tight titlesparks:text-gray-900">
						{ __( 'TitleSparks', 'titlesparks' ) }
					</h1>
				</div>

				<Tabs tabs={ TABS } active={ tab } onChange={ changeTab } />

				<div className="titlesparks:ml-auto titlesparks:flex titlesparks:items-center titlesparks:gap-3">
					<span
						className={ cx(
							'titlesparks:text-xs',
							dirty
								? 'titlesparks:text-gray-500'
								: 'titlesparks:text-gray-400'
						) }
					>
						{ dirty
							? __( 'Unsaved changes', 'titlesparks' )
							: __( 'All changes saved', 'titlesparks' ) }
					</span>
					<Button
						variant="primary"
						size="sm"
						disabled={ ! dirty || isSaving }
						onClick={ () => saveSettings( draft ) }
					>
						{ isSaving && (
							<Spinner className="titlesparks:text-white" />
						) }
						{ __( 'Save', 'titlesparks' ) }
					</Button>
					{ boot.version && (
						<>
							<span
								aria-hidden="true"
								className="titlesparks:hidden titlesparks:h-6 titlesparks:w-px titlesparks:shrink-0 titlesparks:bg-gray-200 titlesparks:sm:block"
							/>
							<Badge
								tone="gray"
								className="titlesparks:font-mono titlesparks:tracking-tight"
							>{ `v${ boot.version }` }</Badge>
						</>
					) }
				</div>
			</header>

			{ notice && (
				<Alert status={ notice.status } onDismiss={ clearNotice }>
					{ notice.message }
				</Alert>
			) }

			{ mediaError && (
				<Alert
					status="error"
					onDismiss={ () => setMediaError( false ) }
				>
					{ __(
						'The WordPress media uploader is unavailable on this screen.',
						'titlesparks'
					) }
				</Alert>
			) }

			<div>
				{ 'guide' === tab && (
					<Guide
						settingsUrl={ `${ boot.settingsUrl || '' }#settings` }
					/>
				) }

				{ 'settings' === tab && (
					<div className="titlesparks:grid titlesparks:grid-cols-1 titlesparks:gap-5 titlesparks:lg:grid-cols-3">
						<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-5 titlesparks:lg:col-span-2">
							<AssetLibrarySection
								assets={ assets }
								folders={ folders }
								folder={ folder }
								selectedTag={ selectedTag }
								onFolderChange={ ( fid ) => {
									setActiveFolder( fid );
									setSelectedTag( '' );
								} }
								onTagFilter={ setSelectedTag }
								isSaving={ isSaving }
								onAdd={ openMedia }
								onUpdate={ updateAsset }
								onDelete={ deleteAsset }
							/>
							<DefaultSettings
								draft={ draft }
								setDraft={ setDraft }
								timeline={ defaultsTimeline }
								postTypes={ boot.postTypes || [] }
								widgets={ widgets }
								sections={ sections }
								theme={ boot.theme || {} }
								anchorDate={ anchor }
								onRescan={ rescanHomepage }
								scanning={ isScanning }
							/>
						</div>

						<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-5">
							<AssetFolders
								folders={ folders }
								assets={ assets }
								active={ folder ? folder.id : '' }
								selectedTag={ selectedTag }
								onSelect={ ( fid ) => {
									setActiveFolder( fid );
									setSelectedTag( '' );
								} }
								onTagClick={ ( tag, folderId ) => {
									setActiveFolder( folderId );
									setSelectedTag( tag );
								} }
								onSave={ saveFolder }
								onDelete={ deleteFolder }
								isSaving={ isSaving }
							/>
							<InfoCards
								guideUrl={ `${ boot.settingsUrl || '' }#guide` }
							/>
						</div>
					</div>
				) }

				{ 'library' === tab && (
					<div className="titlesparks:grid titlesparks:grid-cols-1 titlesparks:gap-5 titlesparks:lg:grid-cols-3">
						<div className="titlesparks:lg:col-span-2">
							<AssetLibrarySection
								manage
								assets={ assets }
								folders={ folders }
								folder={ folder }
								selectedTag={ selectedTag }
								onFolderChange={ ( fid ) => {
									setActiveFolder( fid );
									setSelectedTag( '' );
								} }
								onTagFilter={ setSelectedTag }
								isSaving={ isSaving }
								onAdd={ openMedia }
								onUpdate={ updateAsset }
								onDelete={ deleteAsset }
							/>
						</div>

						<AssetFolders
							folders={ folders }
							assets={ assets }
							active={ folder ? folder.id : '' }
							selectedTag={ selectedTag }
							onSelect={ ( fid ) => {
								setActiveFolder( fid );
								setSelectedTag( '' );
							} }
							onTagClick={ ( tag ) => {
								setActiveFolder( '' );
								setSelectedTag( tag );
							} }
							onSave={ saveFolder }
							onDelete={ deleteFolder }
							isSaving={ isSaving }
						/>
					</div>
				) }
			</div>
		</div>
	);
};

export default Dashboard;
