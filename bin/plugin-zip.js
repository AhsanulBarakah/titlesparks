#!/usr/bin/env node
/**
 * Distribution archive builder.
 *
 * A thin wrapper around `wp-scripts plugin-zip`. That command derives its file
 * list from the `files` field in `package.json` through `npm-packlist`, which
 * always re-adds the root `package.json` and `README.md` however that field is
 * written: the first describes how the plugin is built and the second is this
 * repository's landing page, so neither belongs in what a site runs, and both
 * are removed from the finished archive here.
 *
 * It then normalises the metadata each entry carries, because `wp-scripts` takes
 * it from the machine doing the packing: the source file's modification time,
 * which system packed the entry, and the file's attributes. The same commit
 * built twice — locally on Windows and by the release workflow on Linux — would
 * otherwise produce two different archives and two checksums for one release.
 *
 * Usage: `npm run plugin-zip`, optionally with the same `--root-folder=<name>`
 * or `--no-root-folder` flags `wp-scripts` accepts.
 */

const { execFileSync } = require( 'node:child_process' );
const { join } = require( 'node:path' );

const AdmZip = require( 'adm-zip' );

const root = join( __dirname, '..' );
const pkg = require( join( root, 'package.json' ) );
const args = process.argv.slice( 2 );

try {
	execFileSync(
		process.execPath,
		[
			require.resolve( '@wordpress/scripts/bin/wp-scripts.js' ),
			'plugin-zip',
			...args,
		],
		{ cwd: root, stdio: 'inherit' }
	);
} catch ( error ) {
	// `wp-scripts` has already explained itself on stderr; keep its status.
	process.exit( typeof error.status === 'number' ? error.status : 1 );
}

// Mirror the root folder `wp-scripts` chose, so the entry path matches.
let folder = `${ pkg.name }/`;
const rootFolderArg = args.find( ( arg ) => arg.startsWith( '--root-folder' ) );

if ( args.includes( '--no-root-folder' ) ) {
	folder = '';
} else if ( rootFolderArg ) {
	folder = `${ ( rootFolderArg.split( '=' )[ 1 ] || '' ).trim() }/`;
}

const zipPath = join( root, `${ pkg.name }.zip` );
const zip = new AdmZip( zipPath );
const removed = [ 'package.json', 'README.md' ].filter( ( name ) => {
	const entry = `${ folder }${ name }`;

	if ( ! zip.getEntry( entry ) ) {
		return false;
	}

	zip.deleteFile( entry );

	return true;
} );

// A local date, not a UTC instant: the format stores a date and a time of day
// with no timezone, and the components written are read from the date's local
// getters, so a build in another timezone would otherwise come out different.
const STAMPED_TIME = new Date( 1980, 0, 1, 0, 0, 0 );

// Version 2.0, packed by Unix: what a Linux runner writes, where a Windows
// checkout writes NTFS attributes instead.
const MADE_BY_UNIX = 0x0314;

// The external attributes field, which the format gives a Unix permission mode
// in its high half-word: 0644 for a file, 0755 for a directory.
const UNIX_FILE_ATTR = 0x81a40000;
const UNIX_DIRECTORY_ATTR = 0x41ed0000;

for ( const entry of zip.getEntries() ) {
	entry.header.time = STAMPED_TIME;
	entry.header.made = MADE_BY_UNIX;
	entry.header.attr = entry.isDirectory
		? UNIX_DIRECTORY_ATTR
		: UNIX_FILE_ATTR;
}

zip.writeZip( zipPath );

if ( removed.length ) {
	process.stdout.write(
		`\nExcluded ${ removed
			.map( ( name ) => `\`${ folder }${ name }\`` )
			.join( ', ' ) } from the archive.\n`
	);
}
