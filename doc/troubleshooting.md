# Troubleshooting

Use the smallest check that can distinguish a configuration problem from a missing build or a code issue. Keep a copy of existing settings before testing writes against a real site.

## Plugin is missing or will not activate

1. Confirm the plugin folder contains `titlesparks.php` at its root.
2. Confirm WordPress lists the plugin under **Plugins**. WordPress identifies an installed plugin by its entry-file path (for example, `titlesparks/titlesparks.php`).
3. Check the server’s PHP version (7.4+) and WordPress version (6.6+).
4. Inspect the PHP error log for a fatal error during plugin load. Every class file must follow the autoloader’s `Title_Sparks` filename mapping.
5. For source installs, build the bundles with `npm run build`; missing bundle notices explain the relevant target build command.

The plugin derives filesystem and URL paths from `titlesparks.php`, so it does not need hard-coded folder path edits after a rename. If moved while active, activate the newly discovered entry in WordPress.

## Settings screen is blank or stuck on its skeleton

- Verify `build-admin/index.js`, `build-admin/index.css`, and `build-admin/index.asset.php` exist.
- Check browser console/network failures and the PHP error log.
- Confirm the admin bundle was built after source edits and that its manifest dependencies are available through WordPress.
- The screen requires the `manage_options` capability.

## Sidebar is missing

- Confirm the post type is public and selected in TitleSparks settings.
- Confirm the global enable switch is on and `build-block/` contains its entry and manifest.
- Verify the editor is loading the expected registered post meta field `titlesparks_timeline_schema`.
- Inspect the browser console and REST responses for nonce or capability errors.

## An asset will not save or display

- A saved asset needs a valid image URL and label/id; selecting an attachment lets the server derive its URL/title.
- Inspect the normalized `assets` response from `GET /titlesparks/v1/settings`.
- If the asset was deleted from the library, choose a current asset again; the renderer intentionally avoids broken image URLs.
- Check the file URL is reachable by the visitor and allowed by the image URL sanitizer.
- Tags are lower-case, max 32 characters, max 12 per asset. A folder is a tag view and matches any watched tag.

## Timeline preview or date looks wrong

- Confirm the timeline is enabled on the post as well as globally.
- Verify the site’s timezone in WordPress settings. Timeline math uses the site clock and the editor bootstrap sends its current site-clock value.
- A post-specific anchor overrides the global anchor; otherwise `anchor_source=fixed` uses the valid fixed date and `post` uses the publish date.
- Stage two and three start at the previous stage’s end. Zero-length stages are skipped.
- After stage three, `keep` retains the most recently configured stage with an icon; `remove` clears it.
- The editor preview may show the stage being edited intentionally; verify the saved post’s resolved stage through the preview response if investigating a discrepancy.

## Icon missing or in the wrong place on the frontend

1. Check that the post type is enabled, the global and per-post switches are on, and the current stage has a valid asset.
2. Confirm `build-frontend/index.js` and its manifest exist.
3. Inspect the final DOM for a matching visible post title and inspect `window.titleSparksFrontendData` for the resolved icon entry.
4. Check the title markup and permalink against the title-discovery rules in [frontend rendering](frontend-rendering.md). A theme may use custom title wrappers or duplicate the title in a sidebar. Every visible copy of an eligible post's title is decorated; a bare copy is one the settings exclude — a widget switched off, or a disabled theme area — or a title the finder cannot identify, so compare its markup with the examples there. On a post's own page, check the **Theme areas and widgets** list for a section that applies to that page and is switched off.
5. On a listing, remember which switch owns the page: **Archives and categories** also covers search results and any other listing context, and **Post pages** covers everything printed on a single post or page, including the copies in its own sidebars and related rails.
6. Compare computed position/size against the editor, then test another theme or viewport to isolate theme-specific CSS.
7. Ensure the stylesheet at `assets/css/title-icons.css` is loaded and not replaced by stale cached CSS. Its URL uses a content hash, and the frontend JavaScript URL uses the build-manifest hash, so rebuilding/changing either asset produces a new browser cache key. These keys do not invalidate cached page HTML or a CDN/full-page cache; purge those separately if a page still serves old inline settings or markup.

Do not “fix” this by adding markup to the `the_title` filter; the plugin deliberately leaves title strings unchanged because that filter is used in metadata, attributes, feeds, and secondary loops.

## A card’s icon is a different size from the post’s own page

Both copies are placed by one rule, so a difference is the **size**, and size comes from the title-size bands (`sizing_rules`, **Settings → Advanced**), not from the post: a 17px card title takes the 16 row’s icon while a 40px page title takes the 40 row’s, and those two rows need not agree about the ratio. A table with one ratio in every row draws the same share of the title at every size — the shipped table holds 0.75 throughout. Give every row one ratio and every copy matches:

| Title size | Icon size |
| --- | --- |
| 12 | 15 |
| 16 | 20 |
| 20 | 25 |
| 24 | 30 |
| 32 | 40 |
| 40 | 50 |

That table is 1.25 throughout. A table whose ratio moves between rows (12→16 is 1.33, 16→24 is 1.5) makes small copies look heavier than the post’s own page: the table working as written, not a placement fault. Keep one ratio in every row, or accept the difference. One table serves every copy of a title; a stage may override it, still with a single table. Rows are clamped on save (`font` 4–200, `icon` 4–512) and sorted by `font`.

Offsets scale with the title for the same reason, so the gap between icon and words grows with the font size. Two copies at the *same* size that place differently are a placement fault, not a band: `tests/integration/frontend-icon-stability.cjs` names the row and the number it expected.

## An icon is drawn stretched, taller than the size it was given

A theme's rule for its own images can land on this icon and outrank the plugin's size on one axis only. The reference theme styles the pictures beside its adjacent-post links with `:is(.nav-previous, .nav-next) img { width: 80px; height: 80px; object-fit: cover }`, and its own broad `img { max-width: 100% }` capped that width against the icon's placed box while its height stayed 80px: an icon the size mode had drawn 20px wide rendered 20×80, cropped, which reads exactly like a size setting being ignored. `assets/css/title-icons.css` therefore writes the width and the height together on a positioned icon, so the width the placement chose decides the box and the picture keeps its shape. `tests/integration/frontend-icon-stability.cjs` now fails any icon whose drawing does not match its picture's own aspect ratio, and reports the two numbers. If an icon is still distorted, inspect the theme's rules for that block in DevTools and add a selector of your own — the plugin deliberately writes no `!important` declarations, so a theme can always override it deliberately.

## Safe diagnostics

- Read-only checks: `wp plugin list`, `wp plugin get titlesparks`, `wp option get titlesparks_settings --format=json`.
- API checks: use the authenticated admin browser’s `wp.apiFetch` and a read endpoint first.
- Before a test mutation, copy the affected option/meta value and restore it immediately after the test.
- Avoid printing REST nonces, cookies, or credentials in shared logs.

For reproducible verification steps, see [testing and tooling](testing-and-tooling.md).
