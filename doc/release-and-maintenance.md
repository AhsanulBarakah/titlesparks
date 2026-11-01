# Release and maintenance

Use this guide when preparing an installable TitleSparks plugin ZIP or updating a deployed copy. The source tree and the bundles built from it must describe the same feature; the build output is not tracked, so a release is only as current as the last build, and CI builds all three bundles before it runs anything or packages the ZIP.

## Before building

- Use Node.js 20+ and npm 10+.
- Install dependencies using the project lockfile (`npm ci` when the lockfile is available, otherwise the repository’s documented install workflow).
- Confirm PHP source targets PHP 7.4 and WordPress 6.6 minimum unless the plugin header and readme are deliberately updated together.
- Keep the WordPress header in `titlesparks.php` and the WordPress `readme.txt` metadata consistent: minimum versions, stable tag/version, license, plugin name, and description.
- Review storage changes carefully. New defaults belong in `Settings::defaults()` and `Security::settings()`; migrations are reserved for actual incompatible storage renames or transformations.

## Build and tests

```bash
npm run build
npm run test:unit
npm run lint:js
php tests/php/run.php .test-site
```

All three independent bundles must build: `build-admin`, `build-block`, and `build-frontend`. The PHP enqueue code reads the `.asset.php` manifest next to each entry, so do not omit the manifest or rename an output directory without updating the corresponding PHP loader and webpack config.

The last command runs the PHP assertion scripts against the WordPress that `tests/integration/setup-test-site.sh` installs; the test workflow runs the same command on every push, so a suite that has not been touched in months cannot rot unnoticed.

`npm run lint:js` has a documented existing baseline. Review for new findings rather than masking errors or weakening checks; see [testing and tooling](testing-and-tooling.md).

## Translation catalog

The plugin text domain is `titlesparks` and the catalog belongs in `languages/titlesparks.pot`. Regenerate it from the plugin root with:

```bash
wp i18n make-pot . languages/titlesparks.pot --slug=titlesparks --domain=titlesparks --exclude=node_modules,build-admin,build-block,blocks,vendor
```

Review warnings rather than assuming generation is clean. Any translated string containing placeholders needs a directly associated `translators:` comment explaining the placeholder values. The plugin header declares `/languages`; keep the directory present in the package.

## Create and inspect a plugin ZIP

```bash
npm run plugin-zip
```

Inspect the ZIP before distributing it. It should contain the plugin entry point, PHP includes, required assets, all three built bundles and manifests, `languages/`, `readme.txt`, `changelog.txt`, and `LICENSE`. It should not contain `node_modules/`, `.git/`, local cache files, `doc/` (developer documentation), `package.json`, `README.md` (the repository's landing page), the `screenshot-*.png` captures (see below), or unrelated credentials/configuration.

`readme.txt` carries a `== Screenshots ==` section, so the images it numbers must exist somewhere WordPress.org can pair with it. It looks for `screenshot-1.png`, `screenshot-2.png` and so on, one per caption and in that order: a caption with no file renders as a numbered heading over an empty space, and the two lists drift apart silently unless they are checked together. The captures live at the plugin root in this repository — they are what `README.md` displays, and what is uploaded to the plugin's `assets/` directory on WordPress.org, beside `trunk` rather than inside it. They are deliberately not part of the plugin archive: a site installing TitleSparks has no use for the 3MB of screenshots, the directory does not read them from there, and `.distignore` as well as the `files` allow-list in `package.json` keep them out. Keep each capture at least as wide as the directory listing renders it, at twice the pixel density, so it stays sharp on a high-DPI screen; development-only captures (`artifacts-*.png`) are excluded for their own reason and are not what this section means. The same captions, in the same order, appear in `README.md`, where the images render inline on the repository page: a new capture or a reworded caption has to land in both files, and a capture that is already on WordPress.org has to be replaced there too.

`blueprint.json` at the repository root is the Playground recipe behind the plugin page's preview button: it logs the reader in, installs `titlesparks` from the directory and activates it, then lands on the plugin screen. WordPress.org reads it from the plugin's SVN `assets/` directory — `assets/blueprints/blueprint.json`, beside `trunk` rather than inside it — and never from the archive a site installs, so it is kept out of the ZIP by both `.distignore` and the `files` allow-list in `package.json`. Shipping it in `trunk` would put a file in someone's plugin folder that nothing there reads; the copy to publish is this one, unchanged, committed to SVN assets. The preview button stays committer-only until someone with commit access sets the plugin's preview to public in the plugin page's Advanced view, so committing the file is not what makes it visible.

The `files` allow-list in `package.json` decides the contents, but `npm-packlist` always re-adds the root `package.json` and `README.md` to a packed archive however that list is written, so `npm run plugin-zip` runs `bin/plugin-zip.js`: it calls `wp-scripts plugin-zip` and then removes both entries from the finished ZIP. Verify actual output rather than assuming an allow-list was honored.

The directory's readme validator reports a missing `== Upgrade Notice ==` section as a note rather than an error, so the section is present for 1.0.0 and says there is nothing to do before installing. WordPress prints an upgrade notice only to sites that already have the plugin, which makes it inert on a first release and the reason a section that repeats the changelog costs nothing: leaving it out is a note in the validator, and keeping it is a report with no findings at all. From the first release that has to warn an existing install about a change, that section carries the warning. A donate link is likewise optional, and `readme.txt` carries one in its `Donate link` header — the account that receives the donations — which WordPress.org turns into its own link on the plugin's page.

For WordPress.org preparation, additionally run the installed Plugin Check version against the distributable plugin directory/ZIP and review all errors and warnings. Check the unpacked ZIP rather than the development tree — that tree holds `node_modules`, the sources behind the bundles and the test fixtures, none of which a site runs — and unpack it under the plugin's WordPress.org slug (`titlesparks`): Plugin Check reads the expected text domain from the plugin directory's name, so a copy named `titlesparks-dist` reports every translated string as a mismatch and buries the findings that are real. Run it from a WordPress environment configured for that check. A timeout is not a pass; reduce the scan to relevant categories only for diagnosis, but do not represent a skipped full scan as complete.

## Release from GitHub

Publishing is a manual workflow. `.github/workflows/release.yml` runs only when
it is dispatched by hand — Actions → **Release** → **Run workflow** — so a push
to `main` never publishes anything. Give it the version to ship, without the
leading `v`; it then:

1. checks that `titlesparks.php`'s **Version** header and `readme.txt`'s
   **Stable tag** already carry that version, and stops if either does not, so a
   release cannot be tagged with a version the plugin does not report;
2. checks that no release for that tag exists yet;
3. runs the unit tests and builds all three bundles;
4. builds the installable plugin ZIP and prints its contents to the log;
5. writes `titlesparks.zip.sha1`, `titlesparks.zip.sha256` and
   `titlesparks.zip.md5` in WordPress.org's own format — one file per digest,
   named after the archive and holding nothing but the hex digest — so an
   installed ZIP can be checked against the release without cloning anything;
6. creates the `v<version>` release at the dispatched commit, attaching
   `titlesparks.zip` and those three checksum files. GitHub adds its "Source
   code" archives to every release, so both the ZIP and the source tree are on
   the release page;
7. sets the notes to the version's description from
   `doc/release-notes/v<version>.md`, followed by its **Try it in your browser**
   line holding a WordPress Playground link. The description lives in the
   repository rather than in the workflow, so it is reviewed like anything else
   and a version with no notes file gets a line saying so instead of a page with
   no description at all. Both parts are deliberately short — what the plugin
   does, and how to try this release — and nothing generated is appended to
   them, because a release page that argues at length is read as noise. Playground runs WordPress in the browser, and
   its Query API's `plugin` parameter takes a URL, so the link points at that
   release's own ZIP asset: opening it boots a complete WordPress with the
   release installed and activated, landing on the plugin's settings screen.
   The notes are written with `gh release edit` once the release exists. The
   root `README.md` carries the same link, pointing at the newest release rather
   than a named version, so anyone reading the repository can try the plugin
   without installing it. Both links fetch the ZIP in a browser with no
   credentials, so they only work while the repository and its release assets
   are publicly readable. This repository is public, so both work: each opens a
   complete WordPress with the newest release installed and activated. Once the
   plugin is approved in the WordPress.org directory, `?plugin=titlesparks` is
   the link that always works and needs no repository at all, and `README.md` is
   switched to it then.
8. picks that try-it line from the payload's visibility, because the
   link in step 7 is fetched by the reader's browser with no credentials: on a
   public repository it is the Playground link above, and on a private one it is
   a **Trying this release** line saying why no link is offered (GitHub
   answers 404 for a private repository's assets, which Playground reports as a
   download failure blaming the reader's connection) with the route that does
   work — install `titlesparks.zip` from **Plugins → Add New → Upload
   Plugin**. An absent visibility value counts as private, so a payload that
   does not say never publishes a link that cannot download.

The **pre-release** input marks the release as one; **draft** leaves it
unpublished so it can be reviewed on the releases page first. Nothing else in
this repository publishes a release, and the workflow does not bump the version
for you: update the header, `readme.txt`, and `changelog.txt` first, then
release the version that is already committed.

A tag pushed by hand runs the second job, `attach`, which rebuilds the archive
and refreshes the release's assets. Both jobs install the archive before they
upload it: `tests/integration/playground-fresh-install.sh` mounts the ZIP into
WordPress Playground, adds it to a clean WordPress the way **Plugins → Add New →
Upload Plugin** would, activates it, and asserts the result — the plugin's files
and folders are all in the archive, one version is in the header, the constant
and the stable tag, the menu is registered, and the settings screen renders its
mount node without printing asset markup of its own. A packaging mistake
therefore fails the tag instead of the site that installed it, and the same
command runs locally whenever you want the same answer.

## Upgrade and compatibility safety

- Deactivation is intentionally non-destructive; it leaves saved assets, folders, and timelines.
- This plugin was renamed before its first release, so no legacy data migration is shipped.
- Do not rename option/meta/text-domain/REST identifiers casually. These are persistent or public interfaces; once released, a storage rename needs a planned, tested upgrade path before changing the keys.
- Keep `TITLE_SPARKS_DIR`, `TITLE_SPARKS_URL`, and `TITLE_SPARKS_BASENAME` derived from `__FILE__` so plugin directory renames remain supported.

## Release checklist

- [ ] Source change and tests reviewed.
- [ ] All three production bundles rebuilt.
- [ ] Unit tests pass.
- [ ] JavaScript lint has no new findings versus the baseline.
- [ ] The PHPCS ruleset in `phpcs.xml.dist` passes (the security workflow runs
  it on every push).
- [ ] PHP syntax checks pass.
- [ ] POT is regenerated and translator warnings reviewed.
- [ ] Header and `readme.txt` version/requirements/license agree.
- [ ] Plugin Check errors and warnings reviewed on the distributable files.
- [ ] ZIP contents inspected, including `doc/` and `languages/`.
- [ ] `== Screenshots ==` captions and `screenshot-N.png` files present and in the same order, repeated in `README.md`, and uploaded to the plugin's `assets/` directory on WordPress.org.
- [ ] Activation and the settings screen verified on a clean WordPress: `bash tests/integration/playground-fresh-install.sh titlesparks.zip` passes, and the release workflow runs it on the archive before attaching it.
- [ ] Editor sidebar and frontend behavior verified on a WordPress install.
- [ ] Any upgrade path for changed storage is tested against a disposable database before release.
- [ ] Notes for this version written to `doc/release-notes/v<version>.md`, describing what the release changes for someone deciding whether to install it, and kept short enough to be read.
- [ ] Released on GitHub, by dispatching the **Release** workflow with that version (see above).
- [ ] `README.md`'s Playground link switched to `?plugin=titlesparks` once the plugin is live in the directory. The repository is public, so the ZIP link it carries works until then.
- [ ] The release page's try-it section matches the repository's visibility: a public repository's Playground link opens a site with the release installed, a private one names the install route and carries no link that would fail (see above).
