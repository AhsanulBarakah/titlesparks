/**
 * Webpack configuration.
 *
 * Extends the `@wordpress/scripts` defaults so both bundles keep the WordPress
 * dependency-extraction behaviour: every `@wordpress/*` import is rewritten to
 * a `wp.*` global instead of being bundled, which keeps each build small and
 * stops a second copy of React from landing on the page.
 *
 * All front end source lives in ONE directory tree, `blocks/`, but it ships as
 * two independent bundles:
 *
 *   blocks/admin/index.js     -> build-admin/     (the admin dashboard)
 *   blocks/sidebar/index.js   -> build-block/     (the block editor sidebar)
 *   blocks/frontend/index.js  -> build-frontend/  (front end corner icons)
 *
 * The target bundle is selected with the `WP_BUILD_TARGET` environment
 * variable, which is set by the npm scripts:
 *
 *   npm run build-admin    -> WP_BUILD_TARGET=admin    -> build-admin/
 *   npm run build-block    -> WP_BUILD_TARGET=block    -> build-block/
 *   npm run build-frontend -> WP_BUILD_TARGET=frontend -> build-frontend/
 *
 * A bare `wp-scripts build` (no target) builds every bundle at once, which is
 * handy for CI. Each config keeps its own `output.path`, so webpack's `clean`
 * only ever wipes the directory it is writing to.
 */

const path = require( 'path' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config.js' );

/**
 * The bundles produced by this config, keyed by the value accepted in
 * `WP_BUILD_TARGET`.
 *
 * @type {Record<string, {name: string, entry: string, output: string}>}
 */
const BUNDLES = {
	admin: {
		name: 'admin',
		entry: 'blocks/admin/index.js',
		output: 'build-admin',
	},
	block: {
		name: 'block',
		entry: 'blocks/sidebar/index.js',
		output: 'build-block',
	},
	frontend: {
		name: 'frontend',
		entry: 'blocks/frontend/index.js',
		output: 'build-frontend',
	},
};

/**
 * The requested build target; `all` builds every bundle.
 *
 * @type {string}
 */
const TARGET = process.env.WP_BUILD_TARGET || 'all';

/**
 * Resolve the target name to the list of bundles that should be built.
 *
 * @return {Array<{name: string, entry: string, output: string}>} Bundles to build.
 */
function getBundles() {
	if ( 'all' === TARGET ) {
		return Object.values( BUNDLES );
	}

	if ( BUNDLES[ TARGET ] ) {
		return [ BUNDLES[ TARGET ] ];
	}

	throw new Error(
		`Unknown WP_BUILD_TARGET "${ TARGET }". Expected one of: ${ Object.keys(
			BUNDLES
		).join( ', ' ) }, or all.`
	);
}

/**
 * Turn a bundle definition into a full webpack configuration.
 *
 * @param {{name: string, entry: string, output: string}} bundle Bundle definition.
 * @return {Object} Webpack configuration.
 */
function buildConfig( bundle ) {
	return {
		...defaultConfig,
		// A unique name is required when several configs are exported together.
		name: bundle.name,
		// Override the default `blocks/*` glob with this bundle's single entry.
		entry: {
			index: path.resolve( __dirname, bundle.entry ),
		},
		output: {
			...defaultConfig.output,
			path: path.resolve( __dirname, bundle.output ),
			filename: '[name].js',
			clean: true,
		},
		resolve: {
			...defaultConfig.resolve,
			alias: {
				...defaultConfig.resolve?.alias,
				'@titlesparks/shared': path.resolve(
					__dirname,
					'blocks/shared'
				),
			},
			extensions: [ '.js', '.jsx', '.json' ],
		},
		optimization: {
			...defaultConfig.optimization,
			// Each bundle is a single entry point; chunk splitting would only
			// complicate the PHP enqueue logic without saving any bytes.
			splitChunks: false,
			runtimeChunk: false,
		},
	};
}

module.exports = getBundles().map( buildConfig );
