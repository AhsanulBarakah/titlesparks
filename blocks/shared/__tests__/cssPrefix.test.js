/**
 * The prefix every stylesheet the plugin writes is namespaced with.
 *
 * This plugin shares wp-admin with every other plugin and shares the front end
 * with the theme, so a class of its own is the whole defence: `.titlesparks-…`
 * cannot restyle someone else's markup, and someone else's `.card` cannot
 * restyle ours. The rule is easy to state and easy to lose — one hand-written
 * `.spinner`, one utility added while the config prefix is off, one stylesheet
 * written for a screen whose markup is shared, and the plugin is styling the
 * whole page again.
 *
 * In Tailwind v4 the prefix is a variant, written at the front of the class
 * (`titlesparks:flex`) rather than glued to it (`titlesparks-flex`), so both
 * shapes count as namespaced here: utilities carry `titlesparks:` and the
 * plugin's own hand-written classes keep `titlesparks-`.
 *
 * So this file does not test a feature. It audits every surface that carries
 * plugin CSS — the Tailwind entry, the front end's icon stylesheet, the
 * settings screen's placeholder, and the canvas stylesheet the editor
 * injects — and fails on any selector that is not under a plugin root, any
 * class name without the prefix, any unprefixed `@keyframes`, and any custom
 * property outside the plugin's own `--titlesparks-*` namespace.
 *
 * The bundles in `build-admin` / `build-block` are generated (and ignored by
 * git), so they are audited when present and skipped on a fresh clone. Running
 * the suite after `npm run build` is what checks the CSS that actually ships.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import postcss from 'postcss';

import config from '../../../tailwind.config';
import { ensureEditorStyles, STYLE_ID } from '../editorTitleDom';

/** The one prefix for everything this plugin owns. */
const PREFIX = 'titlesparks-';

/** The same prefix as a v4 variant, which is how every utility is written. */
const UTILITY_PREFIX = 'titlesparks:';

/** The class the Tailwind utilities are scoped to. */
const SCOPE = `.${ PREFIX }app`;

/** The app root class, as written without its leading dot. */
const ROOT_MARKER = `${ PREFIX }app`;

/**
 * Class names in a selector, with their escapes removed.
 *
 * `.titlesparks-app .titlesparks\:flex` is two classes, and the second one is
 * authored `titlesparks:flex` — the colon is part of the name, not a variant
 * separator to strip, which is why it is escaped in the selector at all.
 *
 * @param {string} selector One selector from a rule.
 * @return {string[]} Class names as authored, e.g. `titlesparks-app`,
 *                    `titlesparks:flex`.
 */
const classNames = ( selector ) =>
	Array.from( selector.matchAll( /\.((?:\\.|[^\s.:>+~,[\]#])+)/g ) )
		.map( ( match ) => match[ 1 ].replace( /\\/g, '' ) )
		.filter( Boolean );

/**
 * Whether a class name is in the plugin's namespace.
 *
 * @param {string} name Class name as authored.
 * @return {boolean} True for a utility and for a hand-written class alike.
 */
const namespaced = ( name ) =>
	name.startsWith( PREFIX ) || name.startsWith( UTILITY_PREFIX );

/**
 * Audit one stylesheet.
 *
 * @param {string}   css            Stylesheet text.
 * @param {string[]} roots          Selectors every rule must start with.
 * @param {Function} allowRule      Selector predicate for a rule pinned to ours.
 * @param {string[]} allowedClasses Class names this sheet may name without the
 *                                  prefix, because they belong to wp-admin.
 * @return {Object} Violations keyed by selectors, classes, keyframes and properties.
 */
const audit = ( css, roots, allowRule = () => false, allowedClasses = [] ) => {
	const violations = {
		selectors: [],
		classes: [],
		keyframes: [],
		properties: [],
	};
	const root = postcss.parse( css );

	root.walkRules( ( rule ) => {
		if (
			rule.parent &&
			'atrule' === rule.parent.type &&
			/keyframes/.test( rule.parent.name )
		) {
			return;
		}

		for ( const selector of rule.selectors ) {
			const trimmed = selector.trim();

			if ( allowRule( trimmed ) ) {
				continue;
			}

			if ( ! roots.some( ( scope ) => trimmed.startsWith( scope ) ) ) {
				violations.selectors.push( trimmed );
			}

			classNames( trimmed )
				.filter(
					( name ) =>
						! namespaced( name ) &&
						! allowedClasses.includes( name )
				)
				.forEach( ( name ) => violations.classes.push( name ) );
		}
	} );

	root.walkAtRules( ( at ) => {
		if ( /keyframes/.test( at.name ) && ! at.params.startsWith( PREFIX ) ) {
			violations.keyframes.push( at.params );
		}
	} );

	root.walkDecls( ( declaration ) => {
		if (
			declaration.prop.startsWith( '--' ) &&
			! declaration.prop.startsWith( `--${ PREFIX }` )
		) {
			violations.properties.push( declaration.prop );
		}
	} );

	return violations;
};

describe( 'the prefix the entry generates', () => {
	const entry = readFileSync( join( __dirname, '../tailwind.css' ), 'utf8' );

	it( 'namespaces every utility with `titlesparks:`', () => {
		// The prefix moved from the config to the import in v4, so the entry is
		// where it is now declared — and where it can go missing.
		expect( entry ).toMatch(
			new RegExp( `prefix\\(${ PREFIX.replace( /-$/, '' ) }\\)` )
		);
	} );

	it( 'scopes every utility to the root class of the same name', () => {
		// The root class is derived from the prefix rather than written twice:
		// a rename of one without the other is how the utilities silently stop
		// applying.
		expect( config.important ).toBe( SCOPE );
	} );

	it( 'leaves preflight out, so nothing is restyled globally', () => {
		// v4 has no `corePlugins` switch: preflight is the `base` layer, and the
		// entry imports the theme and the utilities only.
		expect( entry ).not.toMatch( /tailwindcss\/preflight/ );
	} );

	it( 'imports the utilities unlayered, so wp-admin’s own rules lose', () => {
		// Unlayered CSS beats layered CSS whatever the specificity, and every
		// wp-admin rule is unlayered. `layer(utilities)` — what the v4 docs
		// suggest — put every utility in a layer and WordPress' 2px corners, grey
		// borders and 13px type came back over the controls.
		// Comments are prose; the docblock names the argument it warns against.
		expect( entry.replace( /\/\*[\s\S]*?\*\//g, '' ) ).not.toMatch(
			/layer\(\s*(?:utilities|theme)/
		);
	} );
} );

describe( 'the stylesheet Tailwind builds from', () => {
	const violations = audit(
		readFileSync( join( __dirname, '../tailwind.css' ), 'utf8' ),
		[ SCOPE ]
	);

	it( 'writes every selector under the app root', () => {
		expect( violations.selectors ).toEqual( [] );
	} );

	it( 'writes every class with the plugin prefix', () => {
		expect( violations.classes ).toEqual( [] );
	} );

	it( 'writes no custom property outside `--titlesparks-`', () => {
		expect( violations.properties ).toEqual( [] );
	} );
} );

describe( 'the front end icon stylesheet', () => {
	const css = readFileSync(
		join( __dirname, '../../../assets/css/title-icons.css' ),
		'utf8'
	);
	const violations = audit( css, [ '.titlesparks-icon' ] );

	it( 'writes every selector under an icon class', () => {
		expect( violations.selectors ).toEqual( [] );
	} );

	it( 'writes every class with the plugin prefix', () => {
		expect( violations.classes ).toEqual( [] );
	} );

	it( 'writes its custom properties in the plugin namespace', () => {
		expect( violations.properties ).toEqual( [] );
	} );

	it( 'forces nothing on the theme with !important', () => {
		expect( css.replace( /\/\*[\s\S]*?\*\//g, '' ) ).not.toMatch(
			/!\s*important/i
		);
	} );
} );

// The settings screen used to print this rule set in a `<style>` block of its
// own. It is an enqueued stylesheet now, so it is audited like the front end's:
// the plugin no longer emits styles the page cannot see in the enqueue API.
describe( 'the settings screen placeholder stylesheet', () => {
	const css = readFileSync(
		join( __dirname, '../../../assets/css/admin-skeleton.css' ),
		'utf8'
	);
	const violations = audit( css, [ '.titlesparks-skeleton' ] );

	it( 'writes every selector under a skeleton class', () => {
		expect( violations.selectors ).toEqual( [] );
	} );

	it( 'writes every class with the plugin prefix', () => {
		expect( violations.classes ).toEqual( [] );
	} );

	it( 'names its keyframes and custom properties with the prefix', () => {
		expect( violations.keyframes ).toEqual( [] );
		expect( violations.properties ).toEqual( [] );
	} );
} );

describe( 'the stylesheet the editor injects into the canvas', () => {
	const doc = document.implementation.createHTMLDocument( '' );
	ensureEditorStyles( doc );
	const css = doc.getElementById( STYLE_ID ).textContent;
	const violations = audit( css, [ '.titlesparks-title-icon' ] );

	it( 'scopes every rule to the canvas icon', () => {
		expect( violations.selectors ).toEqual( [] );
	} );

	it( 'writes every class with the plugin prefix', () => {
		expect( violations.classes ).toEqual( [] );
	} );

	it( 'names its keyframes and custom properties with the prefix', () => {
		expect( violations.keyframes ).toEqual( [] );
		expect( violations.properties ).toEqual( [] );
	} );
} );

describe( 'the built stylesheets WordPress enqueues', () => {
	const bundles = [
		'build-admin/index.css',
		'build-admin/index-rtl.css',
		'build-block/index.css',
		'build-block/index-rtl.css',
	]
		.map( ( file ) => join( __dirname, '../../..', file ) )
		.filter( ( file ) => existsSync( file ) );

	it( 'are audited when the bundles have been built', () => {
		// `build-*` is generated and git-ignored. Without a build there is
		// nothing to audit here, but with one this is the CSS the plugin
		// actually loads — not the source it was generated from. Tailwind's own
		// `--tw-*` internals arrive as `--titlesparks-tw-*` because the build
		// renames them, and the theme variables are declared on `:root`, so
		// every property is in the namespace even though the selector is not
		// under the app root.
		bundles.forEach( ( file ) => {
			const violations = audit(
				readFileSync( file, 'utf8' ),
				[ SCOPE ],
				( selector ) => /^:(root|host)\b/.test( selector )
			);

			expect( { file, ...violations } ).toEqual( {
				file,
				selectors: [],
				classes: [],
				keyframes: [],
				properties: [],
			} );
		} );
	} );
} );

describe( 'the source files', () => {
	it( 'carry no leftover `ts-` classes', () => {
		const files = [];

		const walk = ( dir ) => {
			readdirSync( dir, { withFileTypes: true } ).forEach( ( entry ) => {
				const path = join( dir, entry.name );

				if ( entry.isDirectory() ) {
					if ( 'node_modules' !== entry.name ) {
						walk( path );
					}
				} else if (
					/\.(js|jsx)$/.test( entry.name ) &&
					! /__tests__/.test( path )
				) {
					files.push( path );
				}
			} );
		};

		walk( join( __dirname, '../..' ) );

		const leftovers = files.flatMap( ( file ) =>
			readFileSync( file, 'utf8' )
				.split( '\n' )
				.map( ( line, index ) => ( {
					file,
					line: index + 1,
					text: line,
				} ) )
				.filter( ( { text } ) => /(?:^|[^\w-])ts-/.test( text ) )
		);

		expect( leftovers ).toEqual( [] );
	} );

	it( 'serve the app root on every surface that emits utilities', () => {
		const admin = readFileSync(
			join(
				__dirname,
				'../../../includes/admin/class-ts-settings-page.php'
			),
			'utf8'
		);
		const sidebar = readFileSync(
			join( __dirname, '../../sidebar/index.js' ),
			'utf8'
		);

		expect( admin ).toMatch(
			new RegExp(
				`id="titlesparks-admin-root"[^>]*class="[^"]*\\b${ ROOT_MARKER }\\b`
			)
		);
		expect( sidebar ).toMatch(
			new RegExp(
				`className="${ ROOT_MARKER }"[\\s\\S]{0,240}?NewsTitleSidebar`
			)
		);
	} );
} );
