/**
 * Babel configuration for the unit tests.
 *
 * The bundles are built by webpack with the same preset, so this file only
 * exists for `npm run test:unit`: from `@wordpress/scripts` 37 the Jest command
 * no longer supplies its own configuration, and without a transform the suite
 * fails on the first `import` in a test file.
 *
 * It is the WordPress preset on purpose — tests render the real components, and
 * those are compiled with the same JSX runtime and the same `@wordpress/*`
 * interop the bundle gets.
 *
 * @type {Object}
 */
module.exports = {
	presets: [ require.resolve( '@wordpress/babel-preset-default' ) ],
};
