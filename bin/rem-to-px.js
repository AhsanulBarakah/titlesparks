/**
 * Resolve `rem` lengths to pixels in the plugin's own stylesheet.
 *
 * Tailwind writes its scale in `rem`, relative to the document's root font
 * size. That is 16px on the settings page, where the design was drawn, and 10px
 * inside the block editor, where WordPress sets `html { font-size: 10px }`. The
 * same utilities therefore came out at 62.5% of their intended size in the
 * editor sidebar — a `text-sm` heading at 8.75px, labels at 7.5px, 5px corners
 * — while the sidebar stayed 280px wide, which read as a stretched layout.
 *
 * The conversion runs at build time, at the 16px base the design assumes, so
 * the compiled CSS means the same thing on every screen that enqueues it.
 * Everything else (percentages, `em`, `px`, unitless values) is untouched;
 * `em` in the front end icon CSS is deliberately relative to the title it sits
 * in, not to this base.
 *
 * @param {string} value CSS value or at-rule parameters.
 * @return {string} The same text with every `rem` length in pixels.
 */
const remToPxValue = ( value ) =>
	value.replace(
		/(-?(?:\d+\.?\d*|\.\d+))rem\b/g,
		( match, number ) =>
			`${ Number( ( Number( number ) * 16 ).toFixed( 4 ) ) }px`
	);

/**
 * PostCSS plugin: resolve `rem` to pixels in declarations and at-rules.
 *
 * A hand-written transform rather than another dependency: the conversion is a
 * single substitution, and this module owns the one place it has to run.
 *
 * @return {Object} PostCSS plugin.
 */
const remToPx = () => ( {
	postcssPlugin: 'titlesparks-rem-to-px',
	Declaration: ( declaration ) => {
		if ( declaration.value.includes( 'rem' ) ) {
			declaration.value = remToPxValue( declaration.value );
		}
	},
	AtRule: ( atRule ) => {
		if ( atRule.params.includes( 'rem' ) ) {
			atRule.params = remToPxValue( atRule.params );
		}
	},
} );

remToPx.remToPxValue = remToPxValue;

module.exports = remToPx;
