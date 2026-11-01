# Testing and tooling

## Scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Builds all three bundles (`build-admin`, `build-block`, `build-frontend`). |
| `npm run build-admin` | One bundle only; much faster while working on one surface. The target is chosen by `WP_BUILD_TARGET` (see `webpack.config.js`). |
| `npm start` | The three targets in watch mode, in parallel. |
| `npm run test:unit` | Jest (jsdom) over every `__tests__` folder. `@wordpress/scripts` 37 stopped supplying the runner's defaults, so `jest.config.js` and `babel.config.js` carry them: jsdom, `babel-jest` with the WordPress preset, and the default `__tests__/*.test.js` match. |
| `npm run lint:js` | ESLint over `blocks`. |
| `npm run format` | Prettier over `blocks`. |
| `npm run make-pot` | Regenerates `languages/titlesparks.pot`. |
| `php tests/php/run.php .test-site` | Runs the PHP assertion scripts against an installed WordPress (see below). |

`build-*` directories are build output rather than tracked content: `.gitignore`
excludes them, and CI builds all three before it runs a check or packages the
ZIP. **Rebuild before you finish**, or the bundle you hand out will not contain
the change you just made — and a green build says nothing about a stale one.
When the emitted content is byte-identical, webpack leaves the file's timestamp
alone, so compare content or hashes rather than dates if you want to know
whether an artifact is current.

## What each test file is for

Unit tests are jsdom. PHP behaviour is pinned from three sides: the JavaScript
tests cover what the UI shares, the browser checks measure a real WordPress
(below), and the assertion scripts in `tests/php` load one and exercise the
stored option, the REST routes and the deep scan directly.

`tests/php/run.php` is the runner for those scripts — `php tests/php/run.php
<wordpress-root>`, or `.test-site` for the site
`tests/integration/setup-test-site.sh` installs. Each script is a function that
asserts and then restores everything it changed, so a run leaves the site as it
found it, and the runner reports every suite before it exits. The test workflow
has a job of its own for it, which is what keeps a suite that has not been
touched in months from rotting unnoticed.

### `blocks/shared/__tests__/`

| File | Guards |
| --- | --- |
| `assetFolders.test.js` | Tags, folder ids, folder membership (the union rule), filtering, the tag index and the page maths. |
| `appScope.test.js` | The `.titlesparks-app` scope: the config, the admin mount node, the sidebar wrapper, and the border reset's layer and selector. |
| `cssPrefix.test.js` | That every stylesheet the plugin writes — Tailwind, the front end icon CSS, the settings screen's placeholder sheet, the editor canvas CSS, and the built bundles when present — is under a plugin prefix (`titlesparks:` for utilities, `titlesparks-` for hand-written classes) and a plugin root, with no unprefixed `@keyframes` or custom property. |
| `remToPx.test.js` | The build step that resolves Tailwind's `rem` scale to pixels, so the editor's 10px root font size cannot shrink the sidebar; also fails if a built bundle still contains `rem`. |
| `iconBox.test.js` | That `assets/css/title-icons.css` and the inline lock in `editorTitleDom.js` declare the same box, and that an icon is handed width only when its stage follows the title. |
| `frontendTitleDom.test.js` | Placing the icon against a real heading: positions, gaps, offsets, the lock, and that a theme's own title alignment is left alone. |
| `canvasTitleSpace.test.js` | That the editor canvas reserves no left space on the post title: no inline style on the heading or its wrapper for any side, an icon that is the heading's sibling and `absolute`, and an injected stylesheet with no padding, margin, float, indent or alignment rule. The layout half of the same rule is the browser check below. |
| `iconOffset.test.js`, `offsetScale.test.js`, `iconGap.test.js` | Offset maths, the scale it is measured at, and the gap between icon and text. |
| `iconZIndex.test.js` | The icon's stacking order: accepted values, the CSS range, and that every placement pass writes it (including a negative number and a missing one). |
| `iconSize.test.js`, `stageDates.test.js` | Which size wins (stage → asset → default), title-size bands (cleaning, a row holding up to the next row, per-stage tables), and turning an end date into a stored length. |
| `EditorTitleIcon.test.js`, `mediaModal.test.js`, `stageCard.test.js`, `deferredPreview.test.js` | The editor's canvas icon, the on-demand media modal, the sidebar stage card (including its own size table, typed one key at a time), and the still-then-animated preview. |
| `modal.test.js` | How the dialog closes: a click on the scrim, a click inside it, its own Close button, and Escape. |

### `blocks/admin/__tests__/`

| File | Guards |
| --- | --- |
| `AssetLibrarySection.test.js` | Eight cards to a page, page two, the folder filter (including a folder with nothing in it), tags surviving the edit form, and the delete confirmation. |
| `AssetFolders.test.js` | Folder counts, the empty-folder hint, create/edit payloads, and that deleting says the assets stay. |
| `DefaultSettings.test.js` | The default stages on the settings screen: dates counted from the anchor, lengths saved instead of dates, plus the separated homepage lists and the Deep scan control. |
| `Guide.test.js` | The guide tab renders its sections. |

Two conventions to copy when you add one:

- The admin components import through the webpack alias
  (`@titlesparks/shared/*`), which jest is not configured with, so tests map those
  specifiers with `jest.mock( …, () => require( … ), { virtual: true } )`.
- `@wordpress/i18n` is mocked down to `__`, `_n` and a `sprintf` that fills in
  placeholders, because the assertions are about the sentences an author reads.

## Linting

`npm run lint:js` exits 0, with a **pre-existing baseline of warnings** that are
not regressions:

- `jsdoc/reject-function-type` and `jsdoc/reject-any-type` on the UI kit's prop
  tags, which are typed loosely on purpose;
- an `jsdoc/escape-inline-tags` warning in one docblock.

No errors are tolerated. If one appears, it is new: the ones that come up most
are `prettier/prettier` on hand-wrapped JSX (run
`npx wp-scripts lint-js --fix <files>`), a missing `@param` on a new docblock, and
`no-undef` in a test file — the runner's globals (`describe`, `it`, `expect`,
`jest`) are declared for `blocks/**/__tests__/**` in `eslint.config.cjs`.

## Style linting

`npm run lint:style` runs stylelint through `.stylelintrc.json`, which extends
`@wordpress/stylelint-config/scss-stylistic` — the preset `wp-scripts` supplies
— plus one allowance: `scss/at-rule-no-unknown` ignores Tailwind 4's CSS-first
directives (`@config`, `@source`, `@theme`, `@utility`, `@variant`,
`@custom-variant`, `@apply`, `@reference`), which are not SCSS at-rules and are
all `blocks/shared/tailwind.css` legitimately contains. Nothing else is relaxed,
so the 80-character limit applies to that file's docblock prose as well, which
is why the comments there are wrapped like the code around them. `@config` sits
after the two `@import`s: v4 accepts it there, and that is the order
`no-invalid-position-at-import-rule` asks for, so the rule needs no exception.

## PHP coding standards

`phpcs.xml.dist` is the ruleset both an editor and
`.github/workflows/security.yml` use. It is deliberately not the whole
WordPress standard: the style half of that standard — statement alignment,
snake_case variables, file names matching class names — disagrees with how this
plugin is written throughout, and a gate that opens with a hundred formatting
notes stops being read. What it does enforce is what a machine can decide about
safety: output escaped and input sanitized (`WordPress.Security`), nonces and
capabilities on anything that acts, prepared SQL (`WordPress.DB`), no silenced
errors or deprecated WordPress functions (`WordPress.PHP`, `WordPress.WP`),
globals and stored names carrying the plugin's prefix
(`WordPress.NamingConventions.PrefixAllGlobals`), and nothing newer than PHP 7.4
while that is the declared minimum (`PHPCompatibilityWP`).

The plugin ships no `composer.json`, so install the tools the same way CI does —
create one for them and let the installer plugin register the standards:

```bash
composer init --no-interaction --name=titlesparks/titlesparks \
  --type=wordpress-plugin --require-dev=squizlabs/php_codesniffer:^3.13 \
  --require-dev=wp-coding-standards/wpcs:^3.4 \
  --require-dev=phpcompatibility/phpcompatibility-wp:^2.1 \
  --require-dev=dealerdirect/phpcodesniffer-composer-installer:^1.0
composer config allow-plugins.dealerdirect/phpcodesniffer-composer-installer true
composer update --no-interaction
vendor/bin/phpcs
```

`composer.json`, `composer.lock` and `vendor/` are all ignored, so that leaves
nothing in `git status`.

A finding is fixed rather than suppressed. Where a sniff cannot see that a call
is safe — reading a theme template file with `file_get_contents()` rather than
fetching a URL — the line carries `phpcs:ignore` with the reason beside it.

## Dependency overrides

`npm audit` reports **0 vulnerabilities**, and `package.json` keeps it that way
with a short `overrides` block. Every advisory that was left came from a package
`@wordpress/scripts` pins inside its own tree, where bumping the parent is the
only alternative — and the suggested fix was to downgrade `@wordpress/scripts`
to 35, which would undo the majors this project is built on. The overrides move
the vulnerable leaves instead:

| Package | Why |
| --- | --- |
| `serialize-javascript` | 7.1.4, the version `copy-webpack-plugin` 14 already asks for; 6.0.2 had an RCE and a DoS. |
| `postcss-selector-parser` | 7.1.7, which cssnano's plugins use for selector rewriting; 6.1.5 allowed quadratic parsing. |
| `markdownlint-cli` → `js-yaml`, `smol-toml` | 5.5.0 and 1.9.1, same majors, so the docs linter keeps parsing YAML and TOML configs. |
| `micromark-extension-math` → `katex` | 0.19.1, the first version without the prototype-pollution bypass. |

All of them are build and lint tooling: `npm audit --omit=dev` was already
clean, and nothing in the overrides reaches a shipped file. The CLI checks are
what catch a bad override — the build (cssnano) and `npx markdownlint-cli` are
the two that actually execute these packages.

## Continuous integration

`.github/workflows/tests.yml` runs on every push and pull request to `main`.
Eight jobs, each one running on every push:

- Node 20 installs the committed lockfile with `npm ci`, runs `npm run test:unit`,
  builds every bundle, runs `npm run plugin-zip`, and uploads the archive as an
  artifact. The lockfile stays committed so CI installs the tree that was tested
  instead of resolving the ranges again — a fresh `npm install` resolution
  crashed on the runner in npm's peer-dependency code;
- PHP 7.4 and 8.2 run `php -l` over every PHP file;
- the front-end icon check at 390x844 and 1440x900, the previous/next links of
  that page, the same page's title rewritten as the other elements a theme may
  use, the editor canvas check at 390x844, and the editor sidebar and settings
  dashboard check, each against a WordPress the job installs itself
  (`tests/integration/setup-test-site.sh`).
  The jobs bring a MariaDB service container, `setup-php`, wp-cli, the latest
  WordPress and the plugin's built bundles, then seed three published posts
  whose first stages are live — the one under test with a post on either side of
  it, so its adjacent links have something to carry
  (`tests/integration/fixtures/seed-test-site.php`) — and serve the site on
  PHP's built-in server with eight workers. The checks need no
  repository variables and no secrets; the runner installs the Chromium they
  drive, since it has no desktop Chrome at the path a developer machine does.

### The ZIP a site actually installs

Every check above runs against the build tree. `tests/integration/playground-fresh-install.sh`
runs against the archive: it mounts `titlesparks.zip` into WordPress Playground —
a WordPress in WASM with SQLite, so it needs no database, no server and nothing
to clean up — installs and activates it exactly as **Plugins → Add New → Upload
Plugin** would, and then runs `tests/integration/playground/check.php` against
the result. That script asserts what a first install has to survive: the plugin
file where WordPress looks for it, the six folders the archive is supposed to
contain, an active plugin, one version across the header, the constant and the
readme's stable tag, the text domain, the menu slug, and an admin screen that
renders its mount node, its skeleton and its app scope while printing no notice
control and no asset markup of its own. A failure is thrown, which fails the
Blueprint step, so a packaging mistake stops the release instead of the site
that downloaded it.

Run it locally the same way the release workflow does — `npm run plugin-zip`
first, then:

```bash
bash tests/integration/playground-fresh-install.sh titlesparks.zip
```

It prints every measurement it took, and exits non-zero when one is wrong. The
first run downloads WordPress into Playground's cache; later runs reuse it.

Those browser checks were opt-in until they moved onto a runner-built
site: they took a test site URL from a repository variable and an admin login
from secrets, and skipped themselves while those were absent — a green run that
had measured nothing. A check that can skip is a check nobody relies on, so the site is now
part of the job and the jobs always run.

`setup-test-site.sh` is the same install a developer can run locally against a
database they already have; point `DB_HOST`, `DB_NAME`, `DB_USER` and
`DB_PASSWORD` at it, then serve `.test-site` and run the check commands below.

The admin-panel job logs in with the administrator `setup-test-site.sh` created,
so the sidebar and dashboard check runs there too; run its command below when
you want the same measurements against your own site, whose theme and plugins CI
does not replicate.

`.github/workflows/security.yml` runs the `phpcs.xml.dist` ruleset on every push
and pull request, with `cs2pr` turning the checkstyle report into annotations on
the lines that fail. It is a gate rather than a report: a security finding fails
the build, and the same ruleset is what a developer runs locally.

Releases are the one thing CI does not do by itself.
`.github/workflows/release.yml` creates one when it is dispatched by hand with
the version to ship: it checks the version the plugin reports, runs the same
tests and build, builds the ZIP, installs that ZIP on a clean WordPress in
Playground, and only then attaches the ZIP and its checksums to the release and
puts a Playground live preview of it at the top of the notes; see
[release and maintenance](release-and-maintenance.md). A tag pushed by hand runs
the attach job on its own: it rebuilds the archive, installs it the same way,
and refreshes the release's assets.

## Checking against a real install

A compiled bundle is not a working feature. The checks worth doing, cheapest
first:

1. **Load the screen.** Open the admin page and the post editor, and confirm the
   page renders and the sidebar opens.
2. **Measure, do not eyeball.** Computed styles are the honest check for styling:
   in the page console,
   `getComputedStyle( node ).borderTopWidth / borderRadius / height`. This is how
   the scoping bug was found — every control was rendering with wp-admin's 2px
   radius and grey while its class list said otherwise.
3. **Drive the real route.** `wp.apiFetch` is on the admin page, so a route can be
   exercised from the console with the page's own nonce:

   ```js
   await wp.apiFetch( {
       path: '/titlesparks/v1/folders',
       method: 'POST',
       data: { folder: { name: 'News', tags: [ 'news' ] } },
   } );
   ```

4. **Exercise the PHP directly.** For a sanitizer or a store, write a throwaway
   script that loads `wp-load.php`, does the work, prints what came back, and
   **restores the row it touched** — copy the option first and write it back at
   the end.

### The browser check

`tests/integration/editor-sidebar-layout.cjs` drives the two screens that share
this stylesheet and asserts what a unit test cannot measure:

- the editor sidebar is WordPress's panel width, with no element crossing its
  edge and no horizontal page scroll;
- the panel heading is 14px and its labels 12px, even though the editor sets
  `html { font-size: 10px }` — a `rem` returning to the build would shrink them;
- each offset letter sits over its own input, and the preview card is gone;
- the settings dashboard still measures 14px labels, 40px controls and 8px
  corners after the pixel build.

Run it against a real install (nothing is saved; the editor is read and closed):

```bash
TITLESPARKS_TEST_EDITOR_URL=http://localhost:10010/wp-admin/post.php?post=275&action=edit \
TITLESPARKS_TEST_USER=admin TITLESPARKS_TEST_PASSWORD=secret \
node tests/integration/editor-sidebar-layout.cjs
```

Pass `TITLESPARKS_TEST_STORAGE_STATE=./playwright-state.json` instead of the
user and password to reuse a saved Playwright session. `TITLESPARKS_TEST_ADMIN_URL`
overrides the settings URL, which otherwise comes from the editor URL.

`tests/integration/frontend-icon-stability.cjs` checks the page a reader gets,
with no login:

```bash
TITLESPARKS_TEST_POST_URL="http://localhost:10010/deserunt-pariatur-assumenda-nihil-est-maiores/ \
http://localhost:10010/category/uncategorized/ http://localhost:10010/" \
TITLESPARKS_TEST_VIEWPORTS="390x844,768x900,1440x900" \
node tests/integration/frontend-icon-stability.cjs
```

One run takes one URL or a list of them, separated by commas or whitespace, so a
post, a listing and the homepage are one command rather than three. Each page
opens in a fresh tab and is measured exactly as it would be on its own; a page
that fails is reported and the rest still run, and the run exits non-zero with
the failed windows listed. Every page prints `PASS <url> @ <width>x<height>` as
it finishes.

`TITLESPARKS_TEST_VIEWPORTS` names the windows, `WIDTHxHEIGHT`, the same way and
defaulting to `1440x900` so a single size behaves exactly as before. The editor
canvas and front-end checks use `CHROME_EXECUTABLE` when it is set and
Playwright's own Chromium otherwise — `npx playwright install chromium` on a
machine without Google Chrome, which is what the CI runner does. A phone
width is not a smaller copy of a wide one for this arithmetic: at 390px a 12px
card title draws a 16px icon, which is inside `ICON_ANCHOR_SIZE`, so its near
edge stands half its narrowing further from the words and the nudge has to be
read back with that shift removed. The sweep is what found that the check was
not modelled for sub-20px icons at all — every icon it had measured on a wide
window was wider than the anchor box, so the missing 2px could not show.

It waits for fonts and images, then watches every title outside a known slider
for style changes and samples the icon and text relative to that title. A placement pass
that changes the title's layout and immediately gives it back shows up here as a
title that keeps changing style and an icon that moves; the icons must stay
still and the title padding must stay at one value. An icon whose host element
changes during the sampling fails too: placement never moves an icon once it is
in place, and a pass that picks a second host alternates with the one before it,
which is how a card icon that had been moving between its heading and the link
inside it, a pixel at a time, was found on an archive page. It also fails a title that
is indented when nothing clips its icon, which is what the retired `wrap`
answer did to a card that let the icon show. It also reads each icon's stage bands from
the page and checks that its nudge grew no further than those bands grew the
icon, so an icon the bands held at one width does not drag its nudge along.
Sliders are skipped because a theme moves them on purpose, and all measurements
are relative to the title, so a lazy image pushing the whole page down does not
count as a move. Which containers count as sliders is matched by whole class
name — a library's own slide elements, or a literal `carousel`/`ticker` — rather
than by the substring a `[class*="carousel"]` filter reads. The reference theme
puts `af-cat-widget-carousel` on the content wrapper of every post page, so that
substring skipped the page's own title and both adjacent-post titles, which are
exactly the icons a placement bug lands on. Any other container that moves its
own titles while the page is being watched is named and passed over instead: a
banner marquee on the reference homepage slid a title 91px with the icon holding
its offset, and reading that as placement reported an icon that "moved" on every
pass.

It also reads each icon's clearance against the words the plugin measured, not
against the wrapper the icon was inserted into: a card link holds a label above
the title and a thumbnail beside it, so reading the link read another line as the
title and reported the adjacent-post icons as roughly a hundred pixels off. The
words are found by the title the server sent for that entry.

It also reads the author's nudge back off the page, on both axes. The clearance
between an icon and its title's text is the gap (`0.15em`, from
`editorTitleDom.js`) plus the nudge, so the nudge is what is left when the gap is
taken out — or the nudge alone for a post whose own spacing is `flush`, which
draws no gap at all (both read from the page's icon data, so a post's own
answer is what the check measures against); vertically, the icon's middle is compared with the middle of the line
— or of the whole block, for the `block` anchor — that `icon_anchor` names, since
`top` plus `translateY(-50%)` puts the middle on that number. A corner icon is
left out of the vertical check: it is placed against the top or bottom of the
text, not on a line's middle. That number
must be the one the author typed, scaled by the title's own size in proportion up
to 1.4x — and, for a title-following icon, no larger than the growth its own
bands allow, because the icon may have stopped following the title. A card's icon
is held to the same number as the post's own title: it gets the post's offsets
with no clearance held back and no floor under the scale, so an authored 37px on
a 17px card title is measured at 17/32 of it, exactly as its single page measures
it. A pixel floor coming back on the gap, a small title's nudge held above the
proportion its size asks for, or a card icon stopped short of the words, all fail
here. A phone width is the other half of this: where the gutter beside a title is
narrower than the icon and its gap, the placement holds the icon at the page's
own edge rather than at the title's, and the check requires the icon to be
exactly there rather than reading the hold as a nudge error.

Every copy of a title is read, not just the page's own: the previous/next links,
a sidebar widget, a listing card (`-title-N`), and each of those is looked up by
the post its icon id names, so a copy cannot fall out of the check by being named
differently. Each page ends with what it covered — `covered 25 of 25 icon(s): 25
nudge(s) read, 0 in a container that moves its titles, 0 inside a slider, 0 not
rendered` — because a run that measured three icons on a page printing twenty
looks exactly like a pass. Icons in a library's own slides are the one skip that
is not about placement: Slick and its peers park the slides they are not showing
outside the viewport (`279-slide-2` measured at x=2489 on a 1440px page), so
there is no placement there to read. Put a listing page and a post in the same
run: the small titles on the listing are what exercise the small end of the
scale, and the single pass keeps them measured by the same rules.

`tests/integration/adjacent-post-icons.cjs` checks the two links at the foot of
a post, with no login:

```bash
TITLESPARKS_TEST_POST_URL="http://localhost:10010/deserunt-pariatur-assumenda-nihil-est-maiores/" \
node tests/integration/adjacent-post-icons.cjs
```

It reads each link's own `href`, finds the icon entry the server resolved for
that permalink in `window.titleSparksFrontendData`, and requires the link to hold
that entry's icon: inside the link, drawn with a non-zero box, its picture
loaded, and carrying one of the placement classes, so an icon that exists but was
never placed fails as well. The permalinks are compared with their query string
intact — a site without pretty permalinks names its posts `?p=12` and `?p=13`, and
the fold the plugin's own URL comparison applies would make the two one URL and
let the wrong post's icon satisfy the check. Nothing about the fixture's ids is
assumed, and a page it cannot test is a failure rather than a pass: no adjacent
link at all, or fewer than two links whose posts carry an icon, is reported with
what was found — which is why `tests/integration/fixtures/seed-test-site.php`
publishes a post on either side of the one under test, each with a live stage of
its own.

That is the regression it exists for. The adjacent links are inline links inside
a `nav`, with no heading and no title class to identify them by, and a title
finder that prefers a heading can answer for the whole page at once and leave
both of them bare while every card below them is decorated — measured on a post
whose two neighbours appeared both in the nav and in a query loop under it, where
the cards received the icons. `TITLESPARKS_TEST_VIEWPORTS` names the windows the
same way the front-end icon check does, defaulting to `1440x900`, and
`TITLESPARKS_TEST_POST_URL` takes one URL or a list of them.

`tests/integration/editor-title-left-space.cjs` checks the same rule in the
block editor, where the icon is drawn over the title rather than inside it:

```bash
TITLESPARKS_TEST_EDITOR_URL=http://localhost:10010/wp-admin/post.php?post=275&action=edit \
TITLESPARKS_TEST_USER=admin TITLESPARKS_TEST_PASSWORD=secret \
node tests/integration/editor-title-left-space.cjs
```

It measures the editor's own post title at two canvas widths and fails a title
whose words start inside the heading — room reserved beside words whose icon is
positioned absolutely — or whose indent changed when the plugin's footprint was
taken out: that is what leftover left space is, and the message says which one
it found. `TITLESPARKS_TEST_VIEWPORTS` replaces the two widths with its own list
(`390x844,1280x1000`), which is how the phone width is checked without editing
the script — CI runs that width on every push, against the site its own job
installs. The theme's own alignment is not measured, and the plugin never writes
`text-align` on the title. It also takes
the plugin's footprint out for one measurement — the icon, the wrapper's
positioning class and the injected stylesheet — and puts it back in the same
task, so the heading, the wrapper and the words have to be in the same place to
sub-pixel accuracy. That is what an out-of-flow icon cannot do, and the
stylesheet may declare no `padding`, `margin`, `float` or `text-indent` beside
the title. The icon itself must sit before or after the heading in WordPress'
wrapper — never inside the contenteditable heading, where typing would save it
into the title — and it must be `absolute`, because a static or floated one
takes space in the title's line. Point `TITLESPARKS_TEST_EDITOR_URL` at a post
whose icon shows; nothing is saved. `canvasTitleSpace.test.js` pins the DOM
half of the same rule in jsdom, where `npm run test:unit` runs it; this check
is the half that needs a laid-out page.

Two traps that only appear against a real install:

- **wp-admin is a hostile stylesheet.** Its rules are stronger than one class, and
  it styles `input`, `select`, `button`, `textarea` by element. Anything that only
  *looks* right in isolation will not look right here.
- **A WordPress login expires.** Admin screens need an authenticated session; keep
  the cookie header from a throwaway session and destroy that session when you are
  done.
