/**
 * Admin dashboard entry point.
 *
 * Mounts the React dashboard into the mount node rendered by
 * `Title_Sparks\Admin\Settings_Page` and registers the REST nonce, which cookie
 * authenticated `apiFetch` requests need on a non-block-editor admin screen.
 */

import apiFetch from '@wordpress/api-fetch';
import { createRoot } from '@wordpress/element';

// Scoped Tailwind (prefixed `titlesparks-`, no preflight). See tailwind.config.js.
import '@titlesparks/shared/tailwind.css';

import Dashboard from './Dashboard';
import { getAdminData } from './useLibrary';

// The block editor adds this middleware for us; on our own admin page we have
// to add it ourselves so the REST writes are authenticated.
const boot = getAdminData();

if ( boot && boot.nonce ) {
	apiFetch.use( apiFetch.createNonceMiddleware( boot.nonce ) );
}

const node = document.getElementById( 'titlesparks-admin-root' );

if ( node ) {
	createRoot( node ).render( <Dashboard /> );
}
