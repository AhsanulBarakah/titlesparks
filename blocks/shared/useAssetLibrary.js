/**
 * Asset library hook.
 *
 * The library is populated on the global TitleSparks admin page and surfaced to
 * the editor two ways:
 *
 *   1. `window.titleSparksEditorData.assets` — inlined by the server, so the
 *      panel renders the correct list on first paint and works for authors who
 *      cannot read the settings REST route.
 *   2. `GET /titlesparks/v1/settings` — fetched on mount so an asset added in
 *      another tab appears without a full editor reload.
 *
 * The fetch is best-effort: a failure (for example a 403 for a non-admin
 * author) keeps the server-inlined list rather than emptying the dropdown.
 */

import { useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

import { normalizeAssets } from './constants';

/**
 * Read the server-inlined editor bootstrap object.
 *
 * @return {Object} Bootstrap data, or an empty object.
 */
export const getEditorData = () =>
	( typeof window !== 'undefined' && window.titleSparksEditorData ) || {};

/**
 * Load the asset library for the editor.
 *
 * @return {{assets: Array, isLoading: boolean}} Asset list and loading flag.
 */
export const useAssetLibrary = () => {
	const boot = getEditorData();
	const namespace = boot.namespace || 'titlesparks/v1';

	const [ assets, setAssets ] = useState( () =>
		normalizeAssets( boot.assets )
	);
	const [ isLoading, setLoading ] = useState( false );

	useEffect( () => {
		let cancelled = false;

		setLoading( true );

		apiFetch( { path: `/${ namespace }/settings` } )
			.then( ( response ) => {
				if ( cancelled ) {
					return;
				}

				const fetched = normalizeAssets( response && response.assets );

				// Only overwrite the bootstrapped list when the fetch actually
				// returned something, so a transient empty response cannot
				// blank out a working dropdown.
				if ( fetched.length ) {
					setAssets( fetched );
				}
			} )
			.catch( () => {
				// Intentionally ignored; see the file header.
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setLoading( false );
				}
			} );

		return () => {
			cancelled = true;
		};
	}, [ namespace ] );

	return { assets, isLoading };
};
