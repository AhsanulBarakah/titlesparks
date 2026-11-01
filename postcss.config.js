/**
 * PostCSS pipeline.
 *
 * `@wordpress/scripts` only supplies its own fallback PostCSS config when the
 * project does not define one (`hasPostCSSConfig()`), so this file replaces it.
 * The WordPress preset is kept in the chain so nothing that used to work —
 * vendor prefixing, `postcss-preset-env` transforms — stops working, and
 * `cssnano` still minifies production builds.
 *
 * Tailwind runs first, so its `@import "tailwindcss/…"` layers are expanded
 * before the preset's transforms and before minification.
 *
 * Units — every `rem` becomes a pixel value
 * -----------------------------------------
 * Tailwind writes its scale in `rem`, which is relative to the document's root
 * font size. That is 16px on the settings page, where the design was drawn, and
 * **10px inside the block editor**: WordPress sets `html { font-size: 10px }`
 * on the editor screen. The same utilities therefore came out at 62.5% of their
 * intended size in the sidebar — an `text-sm` heading at 8.75px, `text-xs`
 * labels at 7.5px, 5px corners and 7.5px of padding — while the 280px panel
 * stayed 280px. Nothing was being overwritten; everything was simply too small
 * for its own container, which read as a wide, stretched layout.
 *
 * The conversion itself is in `bin/rem-to-px.js`, where it is covered by
 * `blocks/shared/__tests__/remToPx.test.js`. It runs after the WordPress preset
 * and before minification.
 *
 * Namespace — the names Tailwind writes for the document
 * -----------------------------------------------------
 * Tailwind v4 builds every utility out of document-level custom properties
 * (`--tw-shadow`, `--tw-ring-shadow`, ...) and registers them with `@property`,
 * and it writes `@keyframes` names that are just as global.
 * `bin/scope-tailwind-globals.js` rewrites those to `--titlesparks-tw-*` and
 * `titlesparks-*` so the stylesheet still writes nothing outside its own
 * namespace.
 */

const wordpressPlugins = require( '@wordpress/postcss-plugins-preset' );
const remToPx = require( './bin/rem-to-px' );
const scopeTailwindGlobals = require( './bin/scope-tailwind-globals' );

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
	plugins: [
		require( '@tailwindcss/postcss' )(),
		...wordpressPlugins,
		remToPx(),
		scopeTailwindGlobals(),
		...( isProduction
			? [ require( 'cssnano' )( { preset: 'default' } ) ]
			: [] ),
	],
};
