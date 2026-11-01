/**
 * Keep the names Tailwind v4 writes for the whole document inside the plugin
 * namespace.
 *
 * Three kinds of name belong to the page rather than to a rule, and v4 writes
 * all three unprefixed:
 *
 * 1. `@property` registrations. Every utility is composed from custom
 *    properties (`--tw-shadow`, `--tw-ring-shadow`, `--tw-border-style`, …) and
 *    a registration is global: two plugins that both ship Tailwind would
 *    register the same names, and whichever sheet loaded last would decide the
 *    initial value for both of them. They are rewritten to `--titlesparks-tw-*`.
 * 2. The `*` rule v4 adds to seed those properties for browsers without
 *    `@property`. Our utilities only ever match inside `.titlesparks-app`, so
 *    the seeding is moved under that root instead of the whole page.
 * 3. `@keyframes`. A keyframe name is document-global too — `@keyframes spin`
 *    from this sheet and `@keyframes spin` from another Tailwind sheet are the
 *    same animation. They are rewritten to `titlesparks-spin`, and so is the
 *    `animation` that names them.
 *
 * The stylesheet's whole defence is that it writes nothing outside
 * `--titlesparks-*` and `titlesparks-*`, and this step is what makes that true
 * once Tailwind v4 is the one generating the CSS.
 *
 * The renames are safe by construction: the only readers of these names are the
 * rules in this same sheet, and every one of them is rewritten together.
 */

/** The prefix every name this build writes has to carry. */
const PREFIX = 'titlesparks-';

/**
 * The root the utilities are scoped to, and the one selector they answer to.
 *
 * It mirrors `important` in `tailwind.config.js`: every generated utility is
 * written as `.titlesparks-app .titlesparks\:…`, so the properties those
 * utilities read only have to exist inside the same root.
 */
const SCOPE = '.titlesparks-app';

/**
 * Move a `--tw-*` reference into the plugin namespace.
 *
 * @param {string} value CSS value or at-rule parameters.
 * @return {string} The same text with Tailwind's properties in our namespace.
 */
const scopeValue = ( value ) => value.replace( /--tw-/g, `--${ PREFIX }tw-` );

/**
 * Prefix an animation name, so it cannot be shared with another sheet.
 *
 * @param {string} name Keyframe name as Tailwind wrote it.
 * @return {string} The same name in the plugin namespace.
 */
const scopeKeyframes = ( name ) =>
	name.startsWith( PREFIX ) ? name : `${ PREFIX }${ name }`;

/**
 * Rewrite the animation names in an `animation` or `animation-name` value.
 *
 * @param {string}   value A declaration value.
 * @param {string[]} names Keyframe names this sheet declares.
 * @return {string} The value with every reference to those names prefixed.
 */
const scopeAnimation = ( value, names ) =>
	names.reduce(
		( text, name ) =>
			text.replace(
				new RegExp( `(^|[\\s,])${ name }(?=($|[\\s,]))`, 'g' ),
				( match, before ) => `${ before }${ scopeKeyframes( name ) }`
			),
		value
	);

/**
 * PostCSS plugin: namespace the document-level names Tailwind v4 writes.
 *
 * @return {Object} PostCSS plugin.
 */
const scopeTailwindGlobals = () => {
	const keyframes = new Set();

	return {
		postcssPlugin: 'titlesparks-scope-tailwind-globals',
		Once( root ) {
			// The keyframe names are collected first, so a declaration that
			// names one is rewritten even when it is written above it.
			root.walkAtRules( 'keyframes', ( atRule ) => {
				keyframes.add( atRule.params.trim() );
			} );
		},
		Rule: ( rule ) => {
			let inProperties = false;
			for ( let node = rule.parent; node; node = node.parent ) {
				if (
					'atrule' === node.type &&
					'layer' === node.name &&
					'properties' === node.params
				) {
					inProperties = true;
					break;
				}
			}

			if ( ! inProperties ) {
				return;
			}

			rule.selectors = rule.selectors.map( ( selector ) =>
				selector.startsWith( SCOPE ) ? selector : `${ SCOPE } ${ selector }`
			);
		},
		Declaration: ( declaration ) => {
			if ( declaration.prop.startsWith( '--tw-' ) ) {
				declaration.prop = scopeValue( declaration.prop );
			}

			if ( declaration.value.includes( '--tw-' ) ) {
				declaration.value = scopeValue( declaration.value );
			}

			// v4 keeps the shorthand in a theme variable
			// (`--titlesparks-animate-spin: spin 1s linear infinite`), so the
			// name has to be rewritten there as well as in `animation`.
			if (
				keyframes.size &&
				( 'animation' === declaration.prop ||
					'animation-name' === declaration.prop ||
					declaration.prop.startsWith( '--' ) )
			) {
				declaration.value = scopeAnimation( declaration.value, [
					...keyframes,
				] );
			}
		},
		AtRule: ( atRule ) => {
			if ( 'keyframes' === atRule.name ) {
				atRule.params = scopeKeyframes( atRule.params.trim() );
			}

			if ( atRule.params.includes( '--tw-' ) ) {
				atRule.params = scopeValue( atRule.params );
			}
		},
	};
};

scopeTailwindGlobals.scopeValue = scopeValue;
scopeTailwindGlobals.scopeKeyframes = scopeKeyframes;
scopeTailwindGlobals.scopeAnimation = scopeAnimation;

module.exports = scopeTailwindGlobals;
