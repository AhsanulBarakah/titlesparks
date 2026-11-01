/**
 * Asset picker modal.
 *
 * The reusable "choose from the global library" dialog: filter tabs, a search
 * box and a thumbnail grid, with an explicit Select action. Selection is
 * two-step (highlight, then confirm) so a stray click cannot change a stage.
 */

import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

import { KINDS, assetTypeLabel, filterAssets } from './constants';
import { IconSearch } from './icons';
import { Button, Modal, Tabs, TextInput, cx } from './ui';
import { useDeferredPreview } from './useDeferredPreview';

/**
 * File type label shown under an asset name.
 *
 * @param {Object} asset Normalised asset.
 * @return {string} The label to draw, defaulting to Image.
 */
const typeLabel = ( asset ) =>
	assetTypeLabel( asset ) || __( 'Image', 'titlesparks' );

/**
 * One tile in the picker grid.
 *
 * Same reasoning as the library grid: a still frame first, the animated file
 * once the browser is idle.
 *
 * @param {Object} props
 * @param {Object} props.asset Normalised asset.
 * @return {JSX.Element} The tile's picture.
 */
const PickerThumb = ( { asset } ) => {
	const src = useDeferredPreview( asset.preview, asset.url );

	return (
		<img
			src={ src }
			alt=""
			className="titlesparks:max-h-12 titlesparks:w-auto"
			decoding="async"
		/>
	);
};

/**
 * AssetPickerModal component.
 *
 * @param {Object}   props
 * @param {Array}    props.assets       Normalised assets.
 * @param {string}   [props.selectedId] Currently selected asset id.
 * @param {Function} props.onSelect     Receives the chosen asset id.
 * @param {Function} props.onClose      Close handler.
 * @return {JSX.Element} The dialog.
 */
const AssetPickerModal = ( { assets, selectedId = '', onSelect, onClose } ) => {
	const [ kind, setKind ] = useState( 'all' );
	const [ query, setQuery ] = useState( '' );
	const [ pending, setPending ] = useState( selectedId );

	const visible = filterAssets( assets, kind, query );

	return (
		<Modal
			title={ __( 'Asset Library', 'titlesparks' ) }
			description={ __(
				'Select an asset from your global library.',
				'titlesparks'
			) }
			onClose={ onClose }
			footer={
				<>
					<Button variant="secondary" onClick={ onClose }>
						{ __( 'Cancel', 'titlesparks' ) }
					</Button>
					<Button
						variant="primary"
						disabled={ ! pending }
						onClick={ () => onSelect( pending ) }
					>
						{ __( 'Select', 'titlesparks' ) }
					</Button>
				</>
			}
		>
			<Tabs tabs={ KINDS } active={ kind } onChange={ setKind } />

			<div className="titlesparks:relative titlesparks:mt-3">
				<span className="titlesparks:pointer-events-none titlesparks:absolute titlesparks:inset-y-0 titlesparks:left-3 titlesparks:flex titlesparks:items-center titlesparks:text-gray-400">
					<IconSearch />
				</span>
				<TextInput
					className="titlesparks:pl-9"
					value={ query }
					placeholder={ __( 'Search assets…', 'titlesparks' ) }
					aria-label={ __( 'Search assets', 'titlesparks' ) }
					onChange={ ( event ) => setQuery( event.target.value ) }
				/>
			</div>

			{ visible.length === 0 ? (
				<p className="titlesparks:m-0 titlesparks:mt-3 titlesparks:rounded-lg titlesparks:border titlesparks:border-dashed titlesparks:border-gray-300 titlesparks:p-5 titlesparks:text-center titlesparks:text-sm titlesparks:text-gray-500">
					{ __( 'No assets match this filter yet.', 'titlesparks' ) }
				</p>
			) : (
				<ul className="titlesparks:m-0 titlesparks:mt-4 titlesparks:grid titlesparks:list-none titlesparks:grid-cols-2 titlesparks:gap-3 titlesparks:p-0 titlesparks:sm:grid-cols-4">
					{ visible.map( ( asset ) => {
						const isPending = pending === asset.id;

						return (
							<li key={ asset.id }>
								<button
									type="button"
									onClick={ () => setPending( asset.id ) }
									onDoubleClick={ () => onSelect( asset.id ) }
									aria-pressed={ isPending }
									className={ cx(
										'titlesparks:flex titlesparks:w-full titlesparks:flex-col titlesparks:items-stretch titlesparks:overflow-hidden titlesparks:rounded-lg titlesparks:border titlesparks:bg-white titlesparks:p-0 titlesparks:text-left titlesparks:transition titlesparks:focus:outline titlesparks:focus:outline-2 titlesparks:focus:outline-brand-500',
										isPending
											? 'titlesparks:border-brand-600 titlesparks:outline titlesparks:outline-2 titlesparks:outline-brand-500'
											: 'titlesparks:border-gray-200 titlesparks:hover:border-gray-400'
									) }
								>
									<span className="titlesparks:flex titlesparks:h-16 titlesparks:items-center titlesparks:justify-center titlesparks:overflow-hidden titlesparks:bg-gray-50">
										<PickerThumb asset={ asset } />
									</span>
									<span className="titlesparks:flex titlesparks:flex-col titlesparks:gap-1 titlesparks:p-2">
										<span className="titlesparks:truncate titlesparks:text-xs titlesparks:font-medium titlesparks:text-gray-800">
											{ asset.label || asset.id }
										</span>
										<span className="titlesparks:text-xs titlesparks:text-gray-400">
											{ typeLabel( asset ) }
										</span>
									</span>
								</button>
							</li>
						);
					} ) }
				</ul>
			) }

			<p className="titlesparks:m-0 titlesparks:mt-3 titlesparks:text-xs titlesparks:text-gray-500">
				{ sprintf(
					/* translators: %d: number of assets shown. */
					__( 'Showing %d assets', 'titlesparks' ),
					visible.length
				) }
			</p>
		</Modal>
	);
};

export default AssetPickerModal;
