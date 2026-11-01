/**
 * Tailwind configuration.
 *
 * Scoped on purpose: this plugin shares wp-admin with every other plugin, so
 * the generated CSS must never be able to restyle anything that is not ours.
 * These settings do that work together:
 *
 *   1. `content` is limited to this plugin's own source, so Tailwind only ever
 *      generates the utilities we actually reference.
 *   2. The `titlesparks` prefix namespaces every class (`.titlesparks:flex`,
 *      `.titlesparks:bg-brand-500`), so a utility cannot collide with another
 *      plugin's stylesheet. Tailwind v4 keeps the prefix as a variant, so it is
 *      declared on the imports in `blocks/shared/tailwind.css` rather than
 *      here — this file only supplies the theme and the scope below.
 *   3. Preflight is not part of the bundle: WordPress owns base styles, and
 *      shipping a reset would restyle wp-admin and every other plugin on the
 *      page. v4 has no switch for it, so the entry imports the `theme` and
 *      `utilities` layers and never the `base` one.
 *   4. `important: '.titlesparks-app'` prefixes every utility with our own root class, so
 *      a utility outranks wp-admin's element rules. Those are stronger than a
 *      single class — `input[type="text"]` and `select:focus` are (0,1,1) — and
 *      they are what made a control render with WordPress' 2px radius, its own
 *      grey and its zeroed vertical padding while the class list said otherwise.
 *
 * The result is additive: our classes only affect elements we put them on, and
 * under this one root element. Every surface of the plugin renders its UI inside
 * a `.titlesparks-app`: the admin page's mount node carries the class, and the editor
 * sidebar wraps its panel in one. UI painted outside it is deliberately not
 * styled by this stylesheet — the icon beside the title is the case that has to
 * match the theme, and it carries its own inline CSS instead.
 *
 * @type {import('tailwindcss').Config}
 */

module.exports = {
	content: [ './blocks/**/*.{js,jsx}' ],
	important: '.titlesparks-app',
	theme: {
		extend: {
			colors: {
				// Mint is the shared accent; the deep end stays dark enough for
				// primary actions, selected states, and readable text.
				brand: {
					50: '#ecfdf5',
					100: '#d1fae5',
					200: '#a7f3d0',
					300: '#6ee7b7',
					400: '#34d399',
					500: '#10b981',
					600: '#059669',
					700: '#047857',
					800: '#065f46',
					900: '#064e3b',
				},
			},
		},
	},
	plugins: [],
};
