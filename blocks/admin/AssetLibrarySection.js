/**
 * The global asset library section.
 *
 * Every library row as a card: a live thumbnail, its file type, the tags that
 * file it into folders, and edit/delete actions. Adding uses the native
 * WordPress media modal; editing and deleting are confirmed in-place so a
 * mis-click cannot destroy a row that posts depend on.
 *
 * The grid is paged, four to a row and eight to a page. A library of a hundred
 * icons is not a page anyone reads to the end, and the folders beside the grid
 * only answer the question "what is in this folder?" if the grid can show one
 * folder at a time.
 *
 * The folder filter itself is owned by the dashboard rather than by this
 * component: the folder list sits in the column beside the grid, so the choice
 * is made outside it and arrives here as a prop.
 */

import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

import {
	Badge,
	Button,
	Card,
	Field,
	IconButton,
	Modal,
	NumberInput,
	Pagination,
	Select,
	Spinner,
	Tabs,
	TagField,
	TextInput,
	cx,
} from '@titlesparks/shared/ui';
import {
	IconPencil,
	IconPlus,
	IconSearch,
	IconTrash,
} from '@titlesparks/shared/icons';
import {
	DEFAULT_ICON_SIZE,
	KINDS,
	LIBRARY_PAGE_SIZE,
	SIZE_UNITS,
	assetTypeLabel,
	assetsInFolder,
	filterAssets,
	joinCssSize,
	paginate,
	splitCssSize,
	tagIndex,
} from '@titlesparks/shared/constants';
import { useDeferredPreview } from '@titlesparks/shared/useDeferredPreview';

/**
 * The add/edit form contents.
 *
 * @param {Object}   props
 * @param {Object}   props.asset       Asset being edited (or a fresh row).
 * @param {Function} props.onChange    Receives the next asset value.
 * @param {Array}    props.suggestions `{ tag, count }` entries already in use.
 * @return {JSX.Element} The form's fields.
 */
const AssetFields = ( { asset, onChange, suggestions } ) => {
	// Same two fields the editor's size control uses, so an asset and a stage
	// cannot describe the same length in two different ways.
	const size = splitCssSize( asset.size, DEFAULT_ICON_SIZE );
	const setSize = ( changes ) => {
		const next = { ...size, ...changes };

		onChange( {
			...asset,
			size: joinCssSize( next.number, next.unit ),
		} );
	};

	return (
		<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-3">
			<Field
				label={ __( 'Label', 'titlesparks' ) }
				hint={ __(
					'Used in the picker and as alt text.',
					'titlesparks'
				) }
			>
				<TextInput
					value={ asset.label || '' }
					onChange={ ( event ) =>
						onChange( { ...asset, label: event.target.value } )
					}
				/>
			</Field>

			<Field
				label={ __( 'Tags', 'titlesparks' ) }
				hint={ __(
					'Folders collect assets by tag, so a tag here is what puts this asset in a folder.',
					'titlesparks'
				) }
			>
				<TagField
					tags={ asset.tags || [] }
					suggestions={ suggestions }
					onChange={ ( tags ) => onChange( { ...asset, tags } ) }
				/>
			</Field>

			<Field
				label={ __( 'Display size', 'titlesparks' ) }
				hint={ __(
					'A stage can override this in the editor.',
					'titlesparks'
				) }
			>
				<div className="titlesparks:flex titlesparks:gap-2">
					<NumberInput
						min={ 1 }
						max={ 9999 }
						step={ 1 }
						value={ size.number }
						aria-label={ __( 'Display size', 'titlesparks' ) }
						onChange={ ( event ) =>
							setSize( { number: event.target.value } )
						}
					/>
					<Select
						className="titlesparks:w-24"
						value={ size.unit }
						options={ SIZE_UNITS }
						aria-label={ __( 'Display size unit', 'titlesparks' ) }
						onChange={ ( unit ) => setSize( { unit } ) }
					/>
				</div>
			</Field>
		</div>
	);
};

/**
 * A card's thumbnail.
 *
 * Draws WordPress' still copy of the image first and swaps in the original —
 * the animated GIF — once the browser is idle, so the grid is complete before
 * the multi-megabyte files are requested. A file with no smaller copy simply
 * draws as itself.
 *
 * @param {Object} props
 * @param {Object} props.asset Normalised asset.
 * @return {JSX.Element} The card's picture.
 */
const AssetThumb = ( { asset } ) => {
	const src = useDeferredPreview( asset.preview, asset.url );

	return (
		<img
			src={ src }
			alt={ asset.label }
			className="titlesparks:max-h-14 titlesparks:w-auto"
			loading="lazy"
			decoding="async"
		/>
	);
};

/**
 * AssetLibrarySection component.
 *
 * @param {Object}   props
 * @param {Array}    props.assets         Normalised assets.
 * @param {Array}    props.folders        Normalised folders.
 * @param {Object}   props.folder         Folder to show, or null for all.
 * @param {Function} props.onFolderChange Receives a folder id, or '' for all.
 * @param {Function} props.onTagFilter    Receives the selected tag.
 * @param {string}   [props.selectedTag]  Selected tag filter.
 * @param {boolean}  props.isSaving       Disable actions while a request is running.
 * @param {Function} props.onAdd          Opens the WordPress media modal.
 * @param {Function} props.onUpdate       Receives the updated asset.
 * @param {Function} props.onDelete       Receives the asset id.
 * @param {boolean}  [props.manage]       Show search and type filters (library tab).
 * @return {JSX.Element} The library section.
 */
const AssetLibrarySection = ( {
	assets,
	folders = [],
	folder = null,
	onFolderChange,
	onTagFilter,
	selectedTag: selectedTagProp,
	isSaving,
	onAdd,
	onUpdate,
	onDelete,
	manage = false,
} ) => {
	const [ kind, setKind ] = useState( 'all' );
	const [ query, setQuery ] = useState( '' );
	const [ page, setPage ] = useState( 1 );
	const [ editing, setEditing ] = useState( null );
	const [ removing, setRemoving ] = useState( null );
	const [ localSelectedTag, setLocalSelectedTag ] = useState(
		selectedTagProp || ''
	);
	const selectedTag = selectedTagProp ?? localSelectedTag;

	const changeSelectedTag = ( tag ) => {
		if ( selectedTagProp === undefined ) {
			setLocalSelectedTag( tag );
		}

		if ( typeof onTagFilter === 'function' ) {
			onTagFilter( tag );
		}
	};

	const suggestions = tagIndex( assets );
	// The folder's own total, not the filtered one: the banner describes the
	// folder, while the line under the grid describes what is on screen.
	const tagged = assetsInFolder( assets, folder ).length;
	const activeFolder = folder ? folder.id : '';
	const visible = manage
		? filterAssets( assets, kind, query, folder )
		: assetsInFolder( assets, folder );
	const filtered = selectedTag
		? visible.filter( ( asset ) =>
				( asset.tags || [] ).includes( selectedTag )
			)
		: visible;
	const paged = paginate( filtered, page, LIBRARY_PAGE_SIZE );

	// Any change to what is being shown puts the reader back on the first page:
	// staying on page 3 of a list that just became one page long would show an
	// empty grid over a full library.
	useEffect( () => {
		setPage( 1 );
	}, [ activeFolder, kind, query, selectedTag ] );

	const shuffled = kind !== 'all' || '' !== query.trim();

	return (
		<>
			<Card
				title={ __( 'Global Asset Library', 'titlesparks' ) }
				description={ __(
					'GIFs, icons and images every post can use.',
					'titlesparks'
				) }
				action={
					<Button
						variant="primary"
						onClick={ onAdd }
						disabled={ isSaving }
					>
						{ isSaving ? (
							<Spinner className="titlesparks:text-white" />
						) : (
							<IconPlus />
						) }
						{ __( 'Add New Asset', 'titlesparks' ) }
					</Button>
				}
			>
				{ folder && (
					<div className="titlesparks:flex titlesparks:flex-wrap titlesparks:items-center titlesparks:gap-2 titlesparks:rounded-lg titlesparks:border titlesparks:border-brand-200 titlesparks:bg-white titlesparks:px-3 titlesparks:py-2">
						<span className="titlesparks:text-xs titlesparks:font-medium titlesparks:text-brand-900">
							{ sprintf(
								/* translators: %s: folder name. */
								__( 'Folder: %s', 'titlesparks' ),
								folder.name
							) }
						</span>
						<span className="titlesparks:text-xs titlesparks:text-gray-500">
							{ sprintf(
								/* translators: %d: number of assets in the folder. */
								_n(
									'%d asset',
									'%d assets',
									tagged,
									'titlesparks'
								),
								tagged
							) }
							{ folder.tags.length > 0 &&
								' · ' +
									sprintf(
										/* translators: %s: comma separated tag list. */
										__( 'tagged %s', 'titlesparks' ),
										folder.tags.join( ', ' )
									) }
						</span>
						<button
							type="button"
							onClick={ () => onFolderChange( '' ) }
							className="titlesparks:ml-auto titlesparks:text-xs titlesparks:font-medium titlesparks:text-brand-900 titlesparks:hover:underline"
						>
							{ __( 'Show all', 'titlesparks' ) }
						</button>
					</div>
				) }

				{ selectedTag && (
					<div className="titlesparks:mb-3 titlesparks:flex titlesparks:flex-wrap titlesparks:items-center titlesparks:gap-2">
						<span className="titlesparks:text-xs titlesparks:text-gray-600">
							{ __( 'Filtered by tag:', 'titlesparks' ) }
						</span>
						<Badge
							tone="brand"
							className="titlesparks:bg-brand-900 titlesparks:text-white"
						>
							{ selectedTag }
							<button
								type="button"
								aria-label={ __(
									'Clear tag filter',
									'titlesparks'
								) }
								onClick={ () => changeSelectedTag( '' ) }
								className="titlesparks:ml-1.5 titlesparks:rounded-full titlesparks:text-xs titlesparks:font-medium titlesparks:text-brand-900 titlesparks:hover:bg-brand-100 titlesparks:hover:text-brand-900"
							>
								×
							</button>
						</Badge>
					</div>
				) }

				{ manage && (
					<>
						<Tabs
							tabs={ KINDS }
							active={ kind }
							onChange={ setKind }
						/>
						<div className="titlesparks:mt-4">
							<div className="titlesparks:relative titlesparks:h-10">
								<span className="titlesparks:pointer-events-none titlesparks:absolute titlesparks:inset-y-0 titlesparks:left-3 titlesparks:flex titlesparks:items-center titlesparks:text-gray-400">
									<IconSearch />
								</span>
								<TextInput
									className="titlesparks:pl-9"
									value={ query }
									placeholder={ __(
										'Search assets by name or tag…',
										'titlesparks'
									) }
									aria-label={ __(
										'Search assets',
										'titlesparks'
									) }
									onChange={ ( event ) =>
										setQuery( event.target.value )
									}
								/>
							</div>
							{ folders.length > 0 && (
								<div className="titlesparks:mt-4 titlesparks:flex titlesparks:flex-wrap titlesparks:items-center titlesparks:gap-1.5">
									<button
										type="button"
										onClick={ () => onFolderChange( '' ) }
										className={ cx(
											'titlesparks:rounded-full titlesparks:border titlesparks:px-2.5 titlesparks:py-0.5 titlesparks:text-xs titlesparks:transition-colors',
											folder
												? 'titlesparks:border-gray-200 titlesparks:bg-white titlesparks:text-gray-600 titlesparks:hover:border-gray-300'
												: 'titlesparks:border-brand-200 titlesparks:bg-brand-50 titlesparks:font-semibold titlesparks:text-brand-900'
										) }
									>
										{ __( 'All', 'titlesparks' ) }
									</button>
									{ folders.map( ( item ) => (
										<button
											key={ item.id }
											type="button"
											onClick={ () =>
												onFolderChange( item.id )
											}
											className={ cx(
												'titlesparks:rounded-full titlesparks:border titlesparks:px-2.5 titlesparks:py-0.5 titlesparks:text-xs titlesparks:transition-colors',
												folder && folder.id === item.id
													? 'titlesparks:border-amber-400 titlesparks:bg-amber-300 titlesparks:font-semibold titlesparks:text-red-900'
													: 'titlesparks:border-amber-300 titlesparks:bg-white titlesparks:text-red-800 titlesparks:hover:border-amber-400 titlesparks:hover:bg-amber-50'
											) }
										>
											{ item.name }
										</button>
									) ) }
								</div>
							) }
						</div>
					</>
				) }

				{ paged.total === 0 ? (
					<p className="titlesparks:m-0 titlesparks:mt-4 titlesparks:rounded-lg titlesparks:border titlesparks:border-dashed titlesparks:border-gray-300 titlesparks:p-6 titlesparks:text-center titlesparks:text-sm titlesparks:text-gray-500">
						{ folder
							? __(
									'Nothing in this folder yet — give an asset one of its tags.',
									'titlesparks'
								)
							: __(
									'No assets yet — add a GIF, icon or image.',
									'titlesparks'
								) }
					</p>
				) : (
					<>
						<ul className="titlesparks:m-0 titlesparks:mt-4 titlesparks:grid titlesparks:list-none titlesparks:grid-cols-2 titlesparks:gap-3 titlesparks:p-0 titlesparks:sm:grid-cols-3 titlesparks:lg:grid-cols-4">
							{ paged.items.map( ( asset ) => (
								<li
									key={ asset.id }
									className="titlesparks:flex titlesparks:flex-col titlesparks:overflow-hidden titlesparks:rounded-lg titlesparks:border titlesparks:border-gray-200 titlesparks:bg-white titlesparks:transition-colors titlesparks:hover:border-gray-300"
								>
									<div className="titlesparks:flex titlesparks:h-20 titlesparks:items-center titlesparks:justify-center titlesparks:overflow-hidden titlesparks:bg-white">
										<AssetThumb asset={ asset } />
									</div>

									<div className="titlesparks:flex titlesparks:flex-1 titlesparks:flex-col titlesparks:gap-2 titlesparks:p-2.5">
										<span className="titlesparks:truncate titlesparks:text-xs titlesparks:font-medium titlesparks:text-gray-800">
											{ asset.label || asset.id }
										</span>

										<div className="titlesparks:flex titlesparks:flex-wrap titlesparks:items-center titlesparks:gap-1">
											<Badge>
												{ assetTypeLabel( asset ) }
											</Badge>
											{ ( asset.tags || [] )
												.slice( 0, 2 )
												.map( ( tag ) => (
													<button
														type="button"
														key={ tag }
														aria-pressed={
															selectedTag === tag
														}
														onClick={ () =>
															changeSelectedTag(
																tag
															)
														}
														className="titlesparks:rounded-full titlesparks:border-0 titlesparks:bg-transparent titlesparks:p-0 titlesparks:focus:outline titlesparks:focus:outline-2 titlesparks:focus:outline-brand-700"
													>
														<Badge
															tone="brand"
															className={
																selectedTag ===
																tag
																	? 'titlesparks:bg-brand-900 titlesparks:text-white'
																	: ''
															}
														>
															{ tag }
														</Badge>
													</button>
												) ) }
											{ ( asset.tags || [] ).length >
												2 && (
												<Badge tone="gray">
													{ `+${
														asset.tags.length - 2
													}` }
												</Badge>
											) }
										</div>

										<div className="titlesparks:mt-auto titlesparks:flex titlesparks:justify-end titlesparks:gap-0.5">
											<IconButton
												label={ sprintf(
													/* translators: %s: asset name. */
													__(
														'Edit %s',
														'titlesparks'
													),
													asset.label || asset.id
												) }
												disabled={ isSaving }
												onClick={ () =>
													setEditing( {
														...asset,
														tags: [
															...( asset.tags ||
																[] ),
														],
													} )
												}
											>
												<IconPencil />
											</IconButton>
											<IconButton
												variant="danger"
												label={ sprintf(
													/* translators: %s: asset name. */
													__(
														'Delete %s',
														'titlesparks'
													),
													asset.label || asset.id
												) }
												disabled={ isSaving }
												onClick={ () =>
													setRemoving( asset )
												}
											>
												<IconTrash />
											</IconButton>
										</div>
									</div>
								</li>
							) ) }
						</ul>

						<div className="titlesparks:mt-4 titlesparks:flex titlesparks:flex-wrap titlesparks:items-center titlesparks:gap-3">
							<span className="titlesparks:text-xs titlesparks:text-gray-500">
								{ sprintf(
									/* translators: 1: first asset shown, 2: last asset shown, 3: total assets. */
									__(
										'Showing %1$d–%2$d of %3$d',
										'titlesparks'
									),
									paged.from,
									paged.to,
									paged.total
								) }
								{ shuffled &&
									' · ' + __( 'filtered', 'titlesparks' ) }
							</span>
							<Pagination
								className="titlesparks:ml-auto"
								page={ paged.page }
								pageCount={ paged.pageCount }
								onChange={ setPage }
							/>
						</div>
					</>
				) }
			</Card>

			{ editing && (
				<Modal
					size="md"
					title={ __( 'Edit asset', 'titlesparks' ) }
					description={ __(
						'The image itself is managed in the WordPress media library.',
						'titlesparks'
					) }
					onClose={ () => setEditing( null ) }
					footer={
						<>
							<Button
								variant="secondary"
								onClick={ () => setEditing( null ) }
							>
								{ __( 'Cancel', 'titlesparks' ) }
							</Button>
							<Button
								variant="primary"
								onClick={ () => {
									onUpdate( editing );
									setEditing( null );
								} }
							>
								{ __( 'Save asset', 'titlesparks' ) }
							</Button>
						</>
					}
				>
					<AssetFields
						asset={ editing }
						suggestions={ suggestions }
						onChange={ setEditing }
					/>
				</Modal>
			) }

			{ removing && (
				<Modal
					size="md"
					title={ __( 'Remove asset', 'titlesparks' ) }
					onClose={ () => setRemoving( null ) }
					footer={
						<>
							<Button
								variant="secondary"
								onClick={ () => setRemoving( null ) }
							>
								{ __( 'Cancel', 'titlesparks' ) }
							</Button>
							<Button
								variant="dangerSolid"
								onClick={ () => {
									onDelete( removing.id );
									setRemoving( null );
								} }
							>
								{ __( 'Remove', 'titlesparks' ) }
							</Button>
						</>
					}
				>
					<p className="titlesparks:m-0 titlesparks:text-sm titlesparks:text-gray-700">
						{ sprintf(
							/* translators: %s: asset name. */
							__(
								'Remove “%s” from the library? Posts using it will stop showing an icon for that stage.',
								'titlesparks'
							),
							removing.label || removing.id
						) }
					</p>
				</Modal>
			) }
		</>
	);
};

export default AssetLibrarySection;
