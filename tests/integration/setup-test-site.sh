#!/usr/bin/env bash
#
# Build a disposable WordPress for the browser checks.
#
# The Playwright checks need a real site: one post whose icon is live, and an
# admin login for the editor. Pointing CI at somebody's test site made the
# checks opt-in — they were skipped unless a repository variable and two secrets
# existed — so every push reported a green run that had measured nothing. This
# script installs WordPress, the plugin and one seeded post on the runner
# instead, so the checks run on every push and need no secrets.
#
# The database is the job's service container; everything else (wp-cli,
# WordPress, the fixture) is downloaded or written here. Both values the checks
# read are appended to `$GITHUB_ENV` when it is set, so a later step just runs
# the check.
#
# Environment:
#   DB_HOST      database host, default 127.0.0.1:3306
#   DB_NAME      database name, default titlesparks
#   DB_USER      database user, default titlesparks
#   DB_PASSWORD  database password, default titlesparks
#   TITLESPARKS_TEST_PORT        port the site is served on, default 8080
#   TITLESPARKS_TEST_SITE_DIR    where to install it, default ./.test-site
#   TITLESPARKS_TEST_USER        admin login for the checks, default titlesparks
#   TITLESPARKS_TEST_PASSWORD    its password, default titlesparks-ci
#
set -euo pipefail

PORT="${TITLESPARKS_TEST_PORT:-8080}"
SITE_URL="http://127.0.0.1:${PORT}"
SITE_DIR="${TITLESPARKS_TEST_SITE_DIR:-$( pwd )/.test-site}"
ADMIN_USER="${TITLESPARKS_TEST_USER:-titlesparks}"
ADMIN_PASSWORD="${TITLESPARKS_TEST_PASSWORD:-titlesparks-ci}"
DB_HOST="${DB_HOST:-127.0.0.1:3306}"
DB_NAME="${DB_NAME:-titlesparks}"
DB_USER="${DB_USER:-titlesparks}"
DB_PASSWORD="${DB_PASSWORD:-titlesparks}"

REPO_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." && pwd )"

# wp-cli is not on a runner, and installing it under the home directory keeps
# this script free of sudo.
WP_CLI_DIR="${HOME}/.local/bin"
WP_CLI="${WP_CLI_DIR}/wp"

if [ ! -x "${WP_CLI}" ]; then
	mkdir -p "${WP_CLI_DIR}"
	curl -sSfL \
		https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar \
		-o "${WP_CLI}"
	chmod +x "${WP_CLI}"
fi

wp() {
	"${WP_CLI}" "$@" --path="${SITE_DIR}" --allow-root
}

if [ ! -f "${SITE_DIR}/wp-load.php" ]; then
	mkdir -p "${SITE_DIR}"
	wp core download --quiet
	wp config create \
		--dbname="${DB_NAME}" \
		--dbuser="${DB_USER}" \
		--dbpass="${DB_PASSWORD}" \
		--dbhost="${DB_HOST}" \
		--quiet
	wp core install \
		--url="${SITE_URL}" \
		--title="TitleSparks test site" \
		--admin_user="${ADMIN_USER}" \
		--admin_password="${ADMIN_PASSWORD}" \
		--admin_email="ci@example.com" \
		--skip-email \
		--quiet
fi

# Copy the plugin rather than symlink it: WordPress derives its URL from the
# plugin's real path, and a symlink would point at the checkout outside
# `wp-content`. Only what the plugin ships is copied, so node_modules and the
# tests never reach the site.
PLUGIN_DIR="${SITE_DIR}/wp-content/plugins/titlesparks"
rm -rf "${PLUGIN_DIR}"
mkdir -p "${PLUGIN_DIR}"

for entry in titlesparks.php includes assets languages build-admin build-block build-frontend \
	readme.txt changelog.txt LICENSE; do
	if [ -e "${REPO_DIR}/${entry}" ]; then
		cp -R "${REPO_DIR}/${entry}" "${PLUGIN_DIR}/"
	fi
done

wp plugin activate titlesparks --quiet

# The seed prints the two URLs the checks need; read them back out of its
# output rather than rebuilding the permalink in two places.
SEED_OUTPUT="$( wp eval-file "${REPO_DIR}/tests/integration/fixtures/seed-test-site.php" )"

POST_URL="$( printf '%s\n' "${SEED_OUTPUT}" | sed -n 's/^TITLESPARKS_TEST_POST_URL=//p' )"
EDITOR_URL="$( printf '%s\n' "${SEED_OUTPUT}" | sed -n 's/^TITLESPARKS_TEST_EDITOR_URL=//p' )"
EXPIRED_URL="$( printf '%s\n' "${SEED_OUTPUT}" | sed -n 's/^TITLESPARKS_TEST_EXPIRED_POST_URL=//p' )"

if [ -z "${POST_URL}" ] || [ -z "${EDITOR_URL}" ] || [ -z "${EXPIRED_URL}" ]; then
	echo "The fixture post was not seeded. wp eval-file said:" >&2
	printf '%s\n' "${SEED_OUTPUT}" >&2
	exit 1
fi

if [ -n "${GITHUB_ENV:-}" ]; then
	{
		echo "TITLESPARKS_TEST_POST_URL=${POST_URL}"
		echo "TITLESPARKS_TEST_EDITOR_URL=${EDITOR_URL}"
		echo "TITLESPARKS_TEST_EXPIRED_POST_URL=${EXPIRED_URL}"
		echo "TITLESPARKS_TEST_USER=${ADMIN_USER}"
		echo "TITLESPARKS_TEST_PASSWORD=${ADMIN_PASSWORD}"
	} >> "${GITHUB_ENV}"
fi

printf 'post      %s\n' "${POST_URL}"
printf 'editor    %s\n' "${EDITOR_URL}"
printf 'expired   %s\n' "${EXPIRED_URL}"
printf 'login     %s\n' "${ADMIN_USER}"
