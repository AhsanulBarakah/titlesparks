/**
 * The folder panel, beside the library.
 *
 * A folder is a name plus the tags it collects, not a box an asset is moved
 * into: an asset appears in every folder that watches one of its tags, so
 * tagging a new icon once files it everywhere it belongs. The panel says that in
 * as many words, because a folder that fills itself is surprising the first
 * time and obvious every time after.
 *
 * It sits in the right column of the library rather than above it: choosing a
 * folder is a look at a different slice of the same grid, so the two are read
 * together — and on a settings page the column is already the place for things
 * that are *about* the library rather than part of it.
 *
 * Creation and edits go through a modal, like an asset's, so a folder is never
 * half saved while an author is still deciding what it watches.
 */

import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

import {
	Badge,
	Button,
	Card,
	Field,
	IconButton,
	Modal,
	Spinner,
	TagField,
	TextInput,
	cx,
} from '@titlesparks/shared/ui';
import {
	IconFolder,
	IconPencil,
	IconPlus,
	IconTrash,
} from '@titlesparks/shared/icons';
import { assetsInFolder, tagIndex } from '@titlesparks/shared/constants';

/**
 * How many assets a folder holds.
 *
 * @param {Array}  assets Normalised assets.
 * @param {Object} folder Normalised folder.
 * @return {number} How many of the assets the folder collects.
 */
const countIn = ( assets, folder ) => assetsInFolder( assets, folder ).length;

/**
 * The new/edit form for one folder.
 *
 * @param {Object}   props
 * @param {Object}   props.folder      Folder draft.
 * @param {Function} props.onChange    Receives the next draft.
 * @param {Array}    props.suggestions `{ tag, count }` entries already in use.
 * @return {JSX.Element} The form's fields.
 */
const FolderFields = ( { folder, onChange, suggestions } ) => (
	<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-3">
		<Field
			label={ __( 'Folder name', 'titlesparks' ) }
			hint={ __(
				'Two folders with the same name are the same folder.',
				'titlesparks'
			) }
		>
			<TextInput
				value={ folder.name }
				onChange={ ( event ) =>
					onChange( { ...folder, name: event.target.value } )
				}
			/>
		</Field>

		<Field
			label={ __( 'Tags this folder collects', 'titlesparks' ) }
			hint={ __(
				'An asset joins this folder as soon as it carries one of these tags. A folder with no tags is empty.',
				'titlesparks'
			) }
		>
			<TagField
				tags={ folder.tags }
				suggestions={ suggestions }
				onChange={ ( tags ) => onChange( { ...folder, tags } ) }
			/>
		</Field>
	</div>
);

/**
 * AssetFolders component.
 *
 * @param {Object}   props
 * @param {Array}    props.folders     Normalised folders.
 * @param {Array}    props.assets      Normalised assets.
 * @param {string}   props.active      Selected folder id, or '' for all assets.
 * @param {Function} props.onSelect    Receives a folder id, or '' to clear.
 * @param {Function} props.onSave      Receives a folder to store.
 * @param {Function} props.onDelete    Receives a folder id to remove.
 * @param {boolean}  props.isSaving    Disable actions while a request is running.
 * @param {Function} props.onTagClick  Receives a tag to filter the library by.
 * @param {string}   props.selectedTag Tag the library is narrowed to.
 * @return {JSX.Element} The folder column.
 */
const AssetFolders = ( {
	folders,
	assets,
	active,
	onSelect,
	onSave,
	onDelete,
	onTagClick,
	selectedTag,
	isSaving,
} ) => {
	const [ editing, setEditing ] = useState( null );
	const [ removing, setRemoving ] = useState( null );
	const suggestions = tagIndex( assets );

	/**
	 * Start a new folder, or edit an existing one.
	 *
	 * @param {Object|null} folder Folder to edit, or null for a new one.
	 */
	const openFolder = ( folder ) =>
		setEditing( folder ? { ...folder } : { id: '', name: '', tags: [] } );

	const save = () => {
		if ( ! editing || ! editing.name.trim() ) {
			return;
		}

		onSave( editing );
		setEditing( null );
	};

	return (
		<>
			<Card
				title={ __( 'Folders', 'titlesparks' ) }
				description={ __(
					'Group the library by tag. An icon joins every folder that watches one of its tags.',
					'titlesparks'
				) }
				bodyClassName="titlesparks:p-3"
				action={
					<Button
						variant="primary"
						size="sm"
						disabled={ isSaving }
						className="titlesparks:shadow-xs"
						onClick={ () => openFolder( null ) }
					>
						<IconPlus className="titlesparks:h-4 titlesparks:w-4" />
						<span className="titlesparks:font-medium">
							{ __( 'New', 'titlesparks' ) }
						</span>
					</Button>
				}
			>
				<ul className="titlesparks:m-0 titlesparks:flex titlesparks:list-none titlesparks:flex-col titlesparks:gap-1 titlesparks:p-0">
					<li>
						<button
							type="button"
							onClick={ () => onSelect( '' ) }
							aria-current={ active ? undefined : 'true' }
							className={ cx(
								'titlesparks:flex titlesparks:w-full titlesparks:items-center titlesparks:gap-2.5 titlesparks:rounded-lg titlesparks:border titlesparks:px-3 titlesparks:py-2.5 titlesparks:text-left titlesparks:text-sm titlesparks:transition-colors titlesparks:focus:outline titlesparks:focus:outline-2 titlesparks:focus:outline-brand-500',
								active
									? 'titlesparks:border-gray-200 titlesparks:bg-white titlesparks:text-gray-600 titlesparks:hover:border-brand-200 titlesparks:hover:bg-brand-50'
									: 'titlesparks:border-brand-300 titlesparks:bg-brand-50 titlesparks:font-semibold titlesparks:text-brand-900'
							) }
						>
							<span className="titlesparks:flex titlesparks:h-8 titlesparks:w-8 titlesparks:shrink-0 titlesparks:items-center titlesparks:justify-center titlesparks:rounded-lg titlesparks:bg-white titlesparks:text-gray-500 titlesparks:ring-1 titlesparks:ring-gray-200">
								<IconFolder className="titlesparks:h-4 titlesparks:w-4" />
							</span>
							<span className="titlesparks:flex-1 titlesparks:truncate titlesparks:font-medium">
								{ __( 'All assets', 'titlesparks' ) }
							</span>
							<span className="titlesparks:min-w-7 titlesparks:rounded-full titlesparks:bg-brand-50 titlesparks:px-2 titlesparks:py-0.5 titlesparks:text-center titlesparks:text-xs titlesparks:font-semibold titlesparks:text-brand-800">
								{ assets.length }
							</span>
						</button>
					</li>

					{ folders.map( ( folder ) => {
						const selected = active === folder.id;
						const count = assetsInFolder( assets, folder ).length;

						return (
							<li
								key={ folder.id }
								className={ cx(
									'titlesparks:group titlesparks:flex titlesparks:flex-col titlesparks:gap-1 titlesparks:rounded-xl titlesparks:border titlesparks:p-1',
									selected
										? 'titlesparks:border-amber-400 titlesparks:bg-amber-300'
										: 'titlesparks:border-amber-300 titlesparks:bg-white titlesparks:hover:bg-amber-50'
								) }
							>
								<button
									type="button"
									onClick={ () => onSelect( folder.id ) }
									aria-current={
										selected ? 'true' : undefined
									}
									className="titlesparks:flex titlesparks:w-full titlesparks:min-w-0 titlesparks:flex-1 titlesparks:flex-col titlesparks:gap-2 titlesparks:rounded-lg titlesparks:px-2 titlesparks:py-1.5 titlesparks:text-left titlesparks:transition-colors titlesparks:focus:outline titlesparks:focus:outline-2 titlesparks:focus:outline-brand-500"
								>
									<span className="titlesparks:flex titlesparks:w-full titlesparks:items-center titlesparks:gap-2.5">
										<span
											className={ cx(
												'titlesparks:flex titlesparks:h-8 titlesparks:w-8 titlesparks:shrink-0 titlesparks:items-center titlesparks:justify-center titlesparks:rounded-lg',
												selected
													? 'titlesparks:bg-amber-500 titlesparks:text-red-950'
													: 'titlesparks:bg-amber-100 titlesparks:text-red-900 titlesparks:group-hover:bg-amber-200'
											) }
										>
											<IconFolder className="titlesparks:h-4 titlesparks:w-4" />
										</span>
										<span
											className={ cx(
												'titlesparks:flex-1 titlesparks:truncate titlesparks:text-sm',
												selected
													? 'titlesparks:font-semibold titlesparks:text-red-950'
													: 'titlesparks:text-red-900'
											) }
										>
											{ folder.name }
										</span>
										<span
											className={ cx(
												'titlesparks:min-w-7 titlesparks:rounded-full titlesparks:px-2 titlesparks:py-0.5 titlesparks:text-center titlesparks:text-xs titlesparks:font-semibold',
												selected
													? 'titlesparks:bg-amber-100 titlesparks:text-red-950'
													: 'titlesparks:bg-amber-200 titlesparks:text-red-900'
											) }
										>
											{ count }
										</span>
									</span>
								</button>

								{ folder.tags.length > 0 ? (
									<span className="titlesparks:flex titlesparks:min-h-6 titlesparks:items-center titlesparks:gap-1.5 titlesparks:pl-10">
										<span className="titlesparks:flex titlesparks:min-w-0 titlesparks:flex-1 titlesparks:flex-wrap titlesparks:gap-1.5">
											{ folder.tags.map( ( tag ) => (
												<button
													key={ tag }
													aria-pressed={
														selectedTag === tag
													}
													onClick={ () => {
														if (
															typeof onTagClick ===
															'function'
														) {
															onTagClick(
																tag,
																folder.id
															);
														}
													} }
													className="titlesparks:inline-flex titlesparks:cursor-pointer titlesparks:rounded-full titlesparks:border-0 titlesparks:bg-transparent titlesparks:p-0 titlesparks:focus:outline titlesparks:focus:outline-2 titlesparks:focus:outline-brand-700"
												>
													<Badge
														tone={
															selectedTag === tag
																? 'primary'
																: 'gray'
														}
														className="titlesparks:hover:ring-1 titlesparks:hover:ring-brand-300"
													>
														{ tag }
													</Badge>
												</button>
											) ) }
										</span>
									</span>
								) : (
									<span className="titlesparks:text-xs titlesparks:text-gray-400">
										{ ' ' }
										{ __(
											'No tags yet — this folder is empty.',
											'titlesparks'
										) }
									</span>
								) }

								<div className="titlesparks:flex titlesparks:items-center titlesparks:justify-end titlesparks:gap-1">
									<IconButton
										label={ sprintf(
											/* translators: %s: folder name. */
											__( 'Edit %s', 'titlesparks' ),
											folder.name
										) }
										disabled={ isSaving }
										onClick={ () => openFolder( folder ) }
									>
										<IconPencil />
									</IconButton>
									<IconButton
										variant="danger"
										label={ sprintf(
											/* translators: %s: folder name. */
											__( 'Delete %s', 'titlesparks' ),
											folder.name
										) }
										disabled={ isSaving }
										onClick={ () => setRemoving( folder ) }
									>
										<IconTrash />
									</IconButton>
								</div>
							</li>
						);
					} ) }
				</ul>

				{ folders.length === 0 && (
					<p className="titlesparks:m-0 titlesparks:mt-3 titlesparks:rounded-lg titlesparks:border titlesparks:border-dashed titlesparks:border-gray-300 titlesparks:p-4 titlesparks:text-center titlesparks:text-xs titlesparks:text-gray-500">
						{ __(
							'No folders yet. Create one and name the tags it collects.',
							'titlesparks'
						) }
					</p>
				) }
			</Card>

			{ editing && (
				<Modal
					size="md"
					title={
						editing.id
							? __( 'Edit folder', 'titlesparks' )
							: __( 'New folder', 'titlesparks' )
					}
					description={ __(
						'Assets are matched to a folder by tag, so nothing has to be filed by hand.',
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
								disabled={ ! editing.name.trim() || isSaving }
								onClick={ save }
							>
								{ isSaving && (
									<Spinner className="titlesparks:text-white" />
								) }
								{ editing.id
									? __( 'Save folder', 'titlesparks' )
									: __( 'Create folder', 'titlesparks' ) }
							</Button>
						</>
					}
				>
					<FolderFields
						folder={ editing }
						suggestions={ suggestions }
						onChange={ setEditing }
					/>
				</Modal>
			) }

			{ removing && (
				<Modal
					size="md"
					title={ __( 'Delete folder', 'titlesparks' ) }
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
								{ __( 'Delete', 'titlesparks' ) }
							</Button>
						</>
					}
				>
					<p className="titlesparks:m-0 titlesparks:text-sm titlesparks:text-gray-700">
						{ sprintf(
							/* translators: %s: folder name. */
							__(
								'Delete the “%s” folder? Its assets and their tags stay in the library — only the folder goes.',
								'titlesparks'
							),
							removing.name
						) }
					</p>
					<p className="titlesparks:m-0 titlesparks:mt-2 titlesparks:text-xs titlesparks:text-gray-500">
						{ sprintf(
							/* translators: %d: number of assets in the folder. */
							_n(
								'%d asset is in it right now.',
								'%d assets are in it right now.',
								countIn( assets, removing ),
								'titlesparks'
							),
							countIn( assets, removing )
						) }
					</p>
				</Modal>
			) }
		</>
	);
};

export default AssetFolders;
