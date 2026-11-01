/**
 * ESLint configuration.
 *
 * Starts from the `@wordpress/scripts` config and adds the two things that
 * config cannot know about this project:
 *
 * - the sources import each other through the `@titlesparks/shared` alias that
 *   `webpack.config.js` declares. Node cannot resolve it, so it is mapped for
 *   the import plugin through `jsconfig.json` — the same mapping an editor uses
 *   to jump to those files.
 * - components are documented as returning `JSX.Element`, a type the JSDoc
 *   plugin does not know unless the namespace is declared.
 *
 * It also names the test runner's globals. The suite is Jest, which runs
 * `describe`, `it`, `expect` and the rest as globals; without them every line
 * of every test file is an `no-undef` error.
 */
const base = require( '@wordpress/scripts/config/eslint.config.cjs' );

// The WordPress config knows the DOM's own types. A rule's options replace that
// list rather than adding to it, so the declared names are read back out and
// kept, with the JSX namespace appended.
const knownTypes = base
	.map( ( config ) => config.rules?.[ 'jsdoc/no-undefined-types' ] )
	.find( Array.isArray );

module.exports = [
	...base,
	{
		settings: {
			'import/resolver': {
				typescript: { project: './jsconfig.json' },
				node: true,
			},
			// Stylesheets are resolved by webpack, not by Node.
			'import/ignore': [ '\\.css$' ],
		},
		rules: {
			// How the WordPress config documents a component: `@return
			// {JSX.Element}`. The rule keeps its own list of known types, so the
			// JSX namespace has to be named in its options.
			'jsdoc/no-undefined-types': [
				'error',
				{
					definedTypes: [
						...( knownTypes?.[ 1 ]?.definedTypes || [] ),
						'JSX',
					],
				},
			],
		},
	},
	{
		files: [ 'blocks/**/__tests__/**/*.js' ],
		languageOptions: {
			globals: {
				describe: 'readonly',
				it: 'readonly',
				test: 'readonly',
				expect: 'readonly',
				jest: 'readonly',
				beforeAll: 'readonly',
				beforeEach: 'readonly',
				afterAll: 'readonly',
				afterEach: 'readonly',
			},
		},
	},
];
