/**
 * The WordPress media modal, loaded when it is first needed.
 *
 * The settings screen no longer calls `wp_enqueue_media()`, because that adds a
 * megabyte of scripts, its footer templates and several media-library queries to
 * every visit — including the great majority that never open the uploader. The
 * markup itself is still built by WordPress (`Admin\Media_Modal` runs the same
 * function and captures what wp-admin would have printed); this module fetches
 * it on the first click, puts it in the page and waits for the scripts to run,
 * so `wp.media` exists by the time the frame is opened.
 *
 * Two details make that safe rather than merely small:
 *
 *   1. A handle the page already loaded is left alone. wp-admin prints
 *      `id="{handle}-js"`, and re-inserting jQuery, Underscore or Backbone
 *      would replace globals that every other script on the page — wp-admin's
 *      own included — is still holding a reference to.
 *   2. Scripts are inserted one at a time, in the order WordPress printed them,
 *      with `async = false`, so a dependency cannot run before what it needs.
 *      Inline data (`_wpMediaViewsL10n` and the plupload settings `media-views`
 *      reads) therefore lands before the file that reads it, exactly as it does
 *      when the page prints them itself.
 */

import apiFetch from '@wordpress/api-fetch';

/**
 * Read the core media factory.
 *
 * @return {Function|null} `wp.media`, or null when it is not loaded yet.
 */
export const getMedia = () =>
	( typeof window !== 'undefined' &&
		window.wp &&
		typeof window.wp.media === 'function' &&
		window.wp.media ) ||
	null;

/**
 * The REST namespace, taken from whichever bootstrap object this screen has.
 *
 * The dashboard and the editor sidebar both use this hook, and each is handed
 * its own global by PHP.
 *
 * @return {string} Namespace, falling back to this plugin's own.
 */
const restNamespace = () => {
	if ( typeof window === 'undefined' ) {
		return 'titlesparks/v1';
	}

	const boot = window.titleSparksAdminData || window.titleSparksEditorData;

	return ( boot && boot.namespace ) || 'titlesparks/v1';
};

/**
 * The `type` attribute of a node, lowercased.
 *
 * @param {Element} node Node to inspect.
 * @return {string} The attribute, or an empty string.
 */
const nodeType = ( node ) =>
	String( ( node.getAttribute && node.getAttribute( 'type' ) ) || '' );

/**
 * Decide what to do with each node of the captured markup.
 *
 * Returns one entry per element, in document order, so the insert step is a
 * straight walk and the decision itself can be tested without a DOM to load
 * anything into.
 *
 * @param {string} html Captured markup.
 * @return {Array<{node: Element, action: string}>} Entries, `action` being one
 *         of `skip`, `inert`, `style`, `inline` or `src`.
 */
export const planMarkup = ( html ) => {
	const holder = document.createElement( 'div' );
	holder.innerHTML = String( html || '' );

	return Array.from( holder.children ).map( ( node ) => {
		const id = node.getAttribute( 'id' );

		// Already on this page: loading a second copy would re-run it.
		if ( id && document.getElementById( id ) ) {
			return { node, action: 'skip' };
		}

		// Stylesheets (`<link>`); appended as they are, since nothing executes.
		if ( 'script' !== node.tagName.toLowerCase() ) {
			return { node, action: 'style' };
		}

		const type = nodeType( node );

		// The modal's underscore templates. Inert by type, but the views look
		// them up by id, so they have to join the document.
		if ( type && ! /(java|ecma)script|module/i.test( type ) ) {
			return { node, action: 'inert' };
		}

		return { node, action: node.getAttribute( 'src' ) ? 'src' : 'inline' };
	} );
};

/**
 * Insert one planned node.
 *
 * @param {{node: Element, action: string}} entry Planned node.
 * @return {Promise<void>} Resolves once the node's code has run.
 */
const insert = ( { node, action } ) => {
	if ( 'skip' === action ) {
		return Promise.resolve();
	}

	if ( 'inert' === action ) {
		document.body.appendChild( node.cloneNode( true ) );

		return Promise.resolve();
	}

	if ( 'style' === action ) {
		const style = node.cloneNode( true );
		const waitsForLoad =
			'LINK' === style.tagName &&
			'stylesheet' === String( style.rel ).toLowerCase() &&
			style.href;
		const loaded = waitsForLoad
			? new Promise( ( resolve, reject ) => {
					style.onload = resolve;
					style.onerror = () =>
						reject( new Error( `Could not load ${ style.href }` ) );
				} )
			: Promise.resolve();

		document.head.appendChild( style );

		return loaded;
	}

	// A script re-created rather than cloned: a clone of a parsed script is
	// inert, and running it is the entire point.
	const script = document.createElement( 'script' );

	Array.from( node.attributes ).forEach( ( attribute ) =>
		script.setAttribute( attribute.name, attribute.value )
	);

	script.text = node.textContent;

	if ( 'inline' === action ) {
		document.head.appendChild( script );

		return Promise.resolve();
	}

	// `async = false` keeps injected files in the order they were printed.
	script.async = false;

	const loaded = new Promise( ( resolve, reject ) => {
		script.onload = () => resolve();
		script.onerror = () =>
			reject( new Error( `Could not load ${ script.src }` ) );
	} );

	document.head.appendChild( script );

	return loaded;
};

/**
 * Put captured markup into the page and wait for it to run.
 *
 * @param {string} html Captured markup.
 * @return {Promise<void>}
 */
export const injectMarkup = ( html ) =>
	planMarkup( html ).reduce(
		( chain, entry ) => chain.then( () => insert( entry ) ),
		Promise.resolve()
	);

/**
 * The in-flight load, so a second click while the first is still waiting joins
 * it instead of fetching the markup twice.
 *
 * @type {Promise<boolean>|null}
 */
let loading = null;

/**
 * Make `wp.media` available, fetching the modal once per page.
 *
 * @return {Promise<boolean>} Whether the modal can be opened.
 */
export const loadMediaModal = () => {
	if ( getMedia() ) {
		return Promise.resolve( true );
	}

	if ( loading ) {
		return loading;
	}

	loading = apiFetch( { path: `/${ restNamespace() }/media-modal` } )
		.then( ( response ) =>
			injectMarkup( ( response && response.html ) || '' )
		)
		.then( () => Boolean( getMedia() ) )
		.catch( () => {
			// Let the next click try again rather than caching the failure.
			loading = null;

			return false;
		} );

	return loading;
};
