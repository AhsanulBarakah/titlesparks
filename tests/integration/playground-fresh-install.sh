#!/usr/bin/env bash
#
# Install a built plugin ZIP on a clean WordPress and check it still works.
#
# The release workflow builds `titlesparks.zip` and attaches it to the tag, so
# the archive a site downloads is a build artifact nobody has ever installed.
# This mounts that exact archive into WordPress Playground — a WordPress that
# runs in WASM with SQLite, so it needs no database, no server and no cleanup —
# installs it, activates it, and runs the assertions in
# `tests/integration/playground/check.php` against the result. A packaging
# mistake (a file left out of the allow-list, a bundle that never shipped)
# fails the step before the asset is attached, rather than failing on the site
# that installed it.
#
# Usage:
#   tests/integration/playground-fresh-install.sh [path/to/titlesparks.zip]
#
# Environment:
#   WP_PLAYGROUND_CLI  command that runs the Playground CLI, default
#                      `npx --yes @wp-playground/cli@latest`
#
# Exit status is the CLI's: 0 when every assertion passed, non-zero when one
# failed or when Playground itself could not start.
set -euo pipefail

ZIP="${1:-titlesparks.zip}"
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# The runner may be a command rather than a single executable — the default is
# `npx` plus the package it should fetch — so it is kept as a word list rather
# than a string that a quoted expansion would look for as one long file name.
if [ -n "${WP_PLAYGROUND_CLI:-}" ]; then
	# A word list on purpose; see above.
	# shellcheck disable=SC2206
	PLAYGROUND=( ${WP_PLAYGROUND_CLI} )
else
	PLAYGROUND=( npx --yes @wp-playground/cli@latest )
fi

if [ ! -f "${ZIP}" ]; then
	echo "No ZIP at ${ZIP}. Build one with \`npm run plugin-zip\` first." >&2
	exit 2
fi

WORK="$( mktemp -d )"
trap 'rm -rf "${WORK}"' EXIT

# Playground reads the archive and the assertions from a folder mounted at
# `/files`, which is the path the blueprint names.
cp "${HERE}/playground/check.php" "${WORK}/check.php"
cp "${HERE}/playground/blueprint.json" "${WORK}/blueprint.json"
cp "${ZIP}" "${WORK}/titlesparks.zip"

# Git Bash hands node a `/tmp/...` path that Windows resolves to `C:\tmp`, and
# it rewrites the bare `/files` mount point into a Windows path.
MOUNT="${WORK}"
if command -v cygpath >/dev/null 2>&1; then
	MOUNT="$( cygpath -m "${WORK}" )"
fi

export MSYS_NO_PATHCONV=1

echo "Installing $( basename "${ZIP}" ) on a clean WordPress…"

set +e
"${PLAYGROUND[@]}" run-blueprint \
	--blueprint="${MOUNT}/blueprint.json" \
	--mount-dir "${MOUNT}" "/files" \
	--verbosity normal
STATUS=$?
set -e

if [ -f "${WORK}/result.json" ]; then
	echo
	echo "What the clean install reported:"
	cat "${WORK}/result.json"
fi

exit "${STATUS}"
