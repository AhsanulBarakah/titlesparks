/**
 * Admin dashboard state.
 *
 * Owns the asset library and the global settings, talking to the plugin's REST
 * routes only. Every write goes through `Title_Sparks\Rest_Controller`, so the
 * `manage_options` check and the `Security` validation happen on the server
 * regardless of what the UI sends.
 *
 * The bootstrap object `window.titleSparksAdminData` is inlined by
 * `Title_Sparks\Admin\Settings_Page`, so the page paints a correct first view and
 * the fetch below only refreshes it.
 */

import { useCallback, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, _n, sprintf } from '@wordpress/i18n';

import {
	normalizeAssets,
	normalizeFolders,
} from '@titlesparks/shared/constants';

/**
 * Read the server-inlined admin bootstrap object.
 *
 * @return {Object} Bootstrap data, or an empty object.
 */
export const getAdminData = () =>
	( typeof window !== 'undefined' && window.titleSparksAdminData ) || {};

/**
 * Build a namespaced REST path.
 *
 * @param {string} namespace REST namespace.
 * @param {string} route     Route suffix.
 * @return {string} The route's path.
 */
const restPath = ( namespace, route ) => `/${ namespace }${ route }`;

/**
 * Library and settings state for the admin dashboard.
 *
 * @return {Object} State plus the actions the dashboard needs.
 */
export const useLibrary = () => {
	const boot = getAdminData();
	const namespace = boot.namespace || 'titlesparks/v1';

	const [ settings, setSettings ] = useState( () => boot.settings || {} );
	const [ assets, setAssets ] = useState( () =>
		normalizeAssets( boot.assets )
	);
	const [ folders, setFolders ] = useState( () =>
		normalizeFolders( boot.folders || ( boot.settings || {} ).folders )
	);
	const [ isSaving, setSaving ] = useState( false );
	const [ notice, setNotice ] = useState( null );

	const applyResponse = useCallback( ( response ) => {
		if ( ! response ) {
			return;
		}

		if ( response.settings ) {
			setSettings( response.settings );

			// Folders travel inside the settings row, so a settings save that
			// carries them is also the newest copy of the folder list.
			if ( response.settings.folders ) {
				setFolders( normalizeFolders( response.settings.folders ) );
			}
		}

		if ( response.assets ) {
			setAssets( normalizeAssets( response.assets ) );
		}

		if ( response.folders ) {
			setFolders( normalizeFolders( response.folders ) );
		}
	}, [] );

	const succeed = useCallback( ( message ) => {
		setNotice( { status: 'success', message } );
	}, [] );

	const fail = useCallback( ( error, fallback ) => {
		setNotice( {
			status: 'error',
			message: ( error && error.message ) || fallback,
		} );
	}, [] );

	const refresh = useCallback( async () => {
		try {
			const response = await apiFetch( {
				path: restPath( namespace, '/settings' ),
			} );

			applyResponse( response );

			return true;
		} catch ( error ) {
			fail( error, __( 'Could not load the library.', 'titlesparks' ) );

			return false;
		}
	}, [ namespace, applyResponse, fail ] );

	/**
	 * Re-run the homepage deep scan.
	 *
	 * The front page's blocks and the active widgets are read again on the
	 * server, so a widget added in another tab — or a block added to the front
	 * page — appears without reloading the dashboard.
	 *
	 * @return {Promise<Object|null>} Fresh lists, or null on failure.
	 */
	const scanHomepageSections = useCallback( async () => {
		setSaving( true );

		try {
			const response = await apiFetch( {
				path: restPath( namespace, '/homepage-sections' ),
			} );

			succeed(
				( response && response.message ) ||
					__( 'Homepage sections rescanned.', 'titlesparks' )
			);

			return response || {};
		} catch ( error ) {
			fail(
				error,
				__( 'Could not scan the homepage sections.', 'titlesparks' )
			);

			return null;
		} finally {
			setSaving( false );
		}
	}, [ namespace, succeed, fail ] );

	const saveSettings = useCallback(
		async ( patch ) => {
			setSaving( true );

			try {
				const response = await apiFetch( {
					path: restPath( namespace, '/settings' ),
					method: 'POST',
					data: { settings: patch },
				} );

				applyResponse( response );
				succeed(
					( response && response.message ) ||
						__( 'Settings saved.', 'titlesparks' )
				);

				return true;
			} catch ( error ) {
				fail(
					error,
					__( 'Could not save the settings.', 'titlesparks' )
				);

				return false;
			} finally {
				setSaving( false );
			}
		},
		[ namespace, applyResponse, succeed, fail ]
	);

	const addAttachments = useCallback(
		async ( attachments ) => {
			setSaving( true );

			try {
				let latest = null;

				// Sequential so each save is validated against the previous
				// state; the library is small and this keeps IDs deterministic.
				for ( const attachment of attachments ) {
					const response = await apiFetch( {
						path: restPath( namespace, '/assets' ),
						method: 'POST',
						data: {
							asset: {
								label: attachment.label,
								// The server resolves the URL and ID from the
								// attachment, so no image data is trusted here.
								attachment_id: attachment.id,
							},
						},
					} );

					if ( response && response.assets ) {
						latest = response.assets;
					}
				}

				if ( latest ) {
					setAssets( normalizeAssets( latest ) );
				}

				succeed(
					sprintf(
						/* translators: %d: number of assets added. */
						_n(
							'%d asset added.',
							'%d assets added.',
							attachments.length,
							'titlesparks'
						),
						attachments.length
					)
				);

				return true;
			} catch ( error ) {
				fail( error, __( 'Could not add the asset.', 'titlesparks' ) );

				return false;
			} finally {
				setSaving( false );
			}
		},
		[ namespace, succeed, fail ]
	);

	const updateAsset = useCallback(
		async ( asset ) => {
			setSaving( true );

			try {
				const response = await apiFetch( {
					path: restPath( namespace, '/assets' ),
					method: 'POST',
					data: { asset },
				} );

				applyResponse( response );
				succeed( __( 'Asset updated.', 'titlesparks' ) );

				return true;
			} catch ( error ) {
				fail(
					error,
					__( 'Could not update the asset.', 'titlesparks' )
				);

				return false;
			} finally {
				setSaving( false );
			}
		},
		[ namespace, applyResponse, succeed, fail ]
	);

	const deleteAsset = useCallback(
		async ( id ) => {
			setSaving( true );

			try {
				const response = await apiFetch( {
					// Encoded so an identifier can never introduce a path
					// segment; the route accepts `[a-zA-Z0-9_-]{1,64}`.
					path: restPath(
						namespace,
						`/assets/${ encodeURIComponent( id ) }`
					),
					method: 'DELETE',
				} );

				applyResponse( response );
				succeed( __( 'Asset removed.', 'titlesparks' ) );

				return true;
			} catch ( error ) {
				fail(
					error,
					__( 'Could not remove the asset.', 'titlesparks' )
				);

				return false;
			} finally {
				setSaving( false );
			}
		},
		[ namespace, applyResponse, succeed, fail ]
	);

	const saveFolder = useCallback(
		async ( folder ) => {
			setSaving( true );

			try {
				const response = await apiFetch( {
					path: restPath( namespace, '/folders' ),
					method: 'POST',
					data: { folder },
				} );

				applyResponse( response );
				succeed( __( 'Folder saved.', 'titlesparks' ) );

				return true;
			} catch ( error ) {
				fail(
					error,
					__( 'Could not save the folder.', 'titlesparks' )
				);

				return false;
			} finally {
				setSaving( false );
			}
		},
		[ namespace, applyResponse, succeed, fail ]
	);

	const deleteFolder = useCallback(
		async ( id ) => {
			setSaving( true );

			try {
				const response = await apiFetch( {
					path: restPath(
						namespace,
						`/folders/${ encodeURIComponent( id ) }`
					),
					method: 'DELETE',
				} );

				applyResponse( response );
				succeed( __( 'Folder removed.', 'titlesparks' ) );

				return true;
			} catch ( error ) {
				fail(
					error,
					__( 'Could not remove the folder.', 'titlesparks' )
				);

				return false;
			} finally {
				setSaving( false );
			}
		},
		[ namespace, applyResponse, succeed, fail ]
	);

	return {
		namespace,
		settings,
		assets,
		folders,
		isSaving,
		notice,
		clearNotice: () => setNotice( null ),
		refresh,
		scanHomepageSections,
		saveSettings,
		addAttachments,
		updateAsset,
		deleteAsset,
		saveFolder,
		deleteFolder,
	};
};

export default useLibrary;
