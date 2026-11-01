# Architecture

## The moving parts

```text
titlesparks.php            constants, autoloader, activation
includes/
  class-ts-plugin.php      registers everything (the only place that wires parts together)
  class-ts-settings.php    the one option row: switches, defaults, the asset library, folders
  class-ts-security.php    every allow-list and sanitizer the plugin has
  class-ts-asset-library.php   reads/writes the `assets` key of that option
  class-ts-asset-folders.php   reads/writes the `folders` key of that option
  class-ts-post-meta.php   reads/writes one post's timeline
  class-ts-decay.php       timeline + start date -> which stage a post is in
  class-ts-title-renderer.php  draws that stage's icon into the title
  class-ts-rest-controller.php the only write path from a browser
  traits/trait-ts-security.php  generic sanitizers (text, url, css size, int, list)
  traits/trait-ts-assets.php    build-manifest and enqueue helpers, shared by both
                                admin-side entry points
  admin/class-ts-settings-page.php  the admin screen and its bootstrap object
  admin/class-ts-meta-box.php       the classic-editor fallback
  admin/class-ts-block-assets.php   decides where the editor sidebar is enqueued
  admin/class-ts-media-modal.php    the media modal, served on demand
blocks/                    all browser source, three bundles
  shared/                  constants, UI kit, icons, DOM helpers (used by all three)
  admin/                   the dashboard (tabs: settings, library, guide)
  sidebar/                 the block editor plugin sidebar
  frontend/                positions the icon after the theme has laid out the page
build-admin/ build-block/ build-frontend/   build output, committed
doc/                       developer and user documentation
```

The class files are named for the autoloader, not for taste:
`Title_Sparks\Asset_Folders` → `includes/class-ts-asset-folders.php`, and
`Title_Sparks\Admin\Settings_Page` → `includes/admin/class-ts-settings-page.php`.
There is no Composer step, so nothing else has to be regenerated when a class is
added.

## One request end to end

**Reading the admin screen.** `Settings_Page::render()` prints a skeleton in the
shape of the dashboard and inlines a bootstrap object
(`window.titleSparksAdminData`) holding the settings row, the asset list, the
folders, the post types, the active theme, the allow-lists and the version. The React app paints
from that object, then `useLibrary` re-reads `GET /settings` to be sure it is
current. The first paint therefore never waits on a request.

**Saving anything.** Every write goes to `titlesparks/v1` and every route has a
`permission_callback` (`manage_options`, except the preview route, which checks
that the user can edit that post). The controller validates with `Security`,
writes through `Settings`, `Asset_Library`, `Asset_Folders` or `Post_Meta`, and
returns the *whole* new state — the library, the folders and the settings row —
so the browser never has to guess what its own write did.

**Drawing the front end.** `Title_Renderer` runs on the title filter, asks
`Decay` which stage is live, and prints the icon markup with its size. The front
end script (`build-frontend`) then measures the title and places the icon, which
cannot be done in PHP because it depends on the theme's own layout. The script
sets only the measured position and the chosen size; the icon's presentation is
left to the theme, with no `!important` and no box reset (`iconBox.test.js`
guards this).

**The editor.** `Block_Assets` enqueues the sidebar bundle only on the post types
the settings allow. The sidebar reads and writes post meta over REST and paints a
preview beside the real title in the canvas.

## House rules

These are the invariants that keep the plugin a good citizen. They are not
style preferences; each one is a bug that was found and fixed.

1. **The stylesheet is scoped to `.titlesparks-app`.** Prefixed classes —
   `titlesparks:flex` in v4, where the prefix is a variant — no `base` layer
   import (so no reset leaks into wp-admin) and `important: '.titlesparks-app'`
   (so a utility outranks wp-admin's element rules, which are stronger than a
   plain class). Every surface renders inside a `.titlesparks-app` root, and a
   test (`blocks/shared/__tests__/appScope.test.js`) keeps the config, the PHP
   mount node and the sidebar wrapper in step.
   The imports are deliberately **unlayered**: `@import "tailwindcss/utilities.css"
   layer(utilities)` would put every utility in a cascade layer, and unlayered CSS
   — which is all of wp-admin — beats layered CSS whatever the specificity, so
   every control fell back to WordPress' 2px corners and grey border.
2. **Tailwind's own names stay in the namespace.** v4 writes three things for
   the whole document: `@property` registrations for the `--tw-*` variables
   every utility is built from, a `*` rule seeding them, and `@keyframes`. The
   build rewrites them to `--titlesparks-tw-*`, scopes the seeding to
   `.titlesparks-app`, and prefixes the keyframe names
   (`bin/scope-tailwind-globals.js`), so another plugin on the same screen can
   neither register nor override them. `cssPrefix.test.js` fails if any of that
   reaches a built stylesheet unprefixed.
3. **Never build a class name by concatenation.** Tailwind scans source text; a
   composed name is never generated. Every class list is one complete literal.
4. **The server re-validates everything.** The browser's constants mirror
   `Security`, but a value is only trusted after it has been through
   `Security::*` on the write path.
5. **One writer per concept.** Settings, assets, folders and post meta each have
   exactly one class that writes them, and one REST route that calls it.
6. **Icons are code, not a package.** `blocks/shared/icons.js` holds a stroked
   24-unit set so no extra dependency ships and every icon inherits
   `currentColor`.
7. **The icon's presentation belongs to the theme.** The plugin sizes the
   image and gives in-flow icons their gap, but declares no `!important` rules
   and resets nothing, so a site can restyle the icon. `iconBox.test.js` fails
   if a forced box or `!important` returns.
8. **Text is translated.** Every string goes through `__()` / `_n()` /
   `sprintf()` with the `titlesparks` domain, in PHP and in JS.
9. **Lengths ship in pixels.** The plugin's Tailwind scale is written in
   `rem`, but the block editor sets `html { font-size: 10px }` while the settings
   page uses 16px, so the same utility was 62.5% smaller in the sidebar than on
   the page it was designed on. `bin/rem-to-px.js` resolves every `rem` to a
   pixel value at build time (see `postcss.config.js`), and
   `remToPx.test.js` fails if a built stylesheet still carries one. `em` is
   left alone because the front end icon's gap is deliberately relative to the
   title it sits in.
