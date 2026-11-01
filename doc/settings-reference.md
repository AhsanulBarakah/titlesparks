# Settings reference

The **TitleSparks** admin screen requires `manage_options`. The REST API applies the same capability to settings and library operations. Settings are persisted in the single `titlesparks_settings` WordPress option. The shape is defined by `Settings::defaults()` and normalized by `Security::settings()`.

## Global settings

| Setting | Stored key | Values / behavior |
| --- | --- | --- |
| Enable plugin | `enabled` | Boolean. When false, the renderer and editor functionality are inactive site-wide. Defaults to `false`. |
| Enabled post types | `post_types` | List of public post type slugs, excluding `attachment`. Defaults to `post`. |
| Show icons on | `display_locations` | Booleans for `singular` (post and page content), `home`, `archive`, and `search`. All default to `true`. |
| Widget choices | `widget_display` | Map of active widget instance ID → boolean. A widget's choice applies wherever it renders, and each widget reports the sidebar areas it sits in and the page contexts of those sidebars, read as text from the theme's PHP files for `dynamic_sidebar()` and `is_active_sidebar()` calls (a theme that passes a variable leaves them as every page). An unset ID defaults on. |
| Theme area choices | `section_display` | Map of section ID → boolean. Sections come from the known news-theme areas, the deep scan of every block template and template part, the front page, and the recent content of every public post type, and the `titlesparks_homepage_sections` filter. A synced pattern a block references is walked into, so the blocks it holds are the sections. Each section records the page contexts it renders in, and its switch only gates those pages. An unset ID defaults on. The list is the cached result of the last scan, so the screen names the active theme the scan was read from — and the theme it is built on when the active one is a child theme, whose parent's templates are what the site renders. |
| Timeline start | `anchor_source` | `post` uses each post’s publish date; `fixed` uses the configured fixed date/time. Defaults to `post`. |
| Fixed start date/time | `anchor_datetime` | Sanitized site-clock `Y-m-d H:i:s` value used when `anchor_source` is `fixed`. An empty/invalid value falls back to the post date. |
| After stage three | `default_behaviour` | `keep` shows the newest stage that has an icon; `remove` shows nothing. Defaults to `keep`. |
| Fit icons inside tight cards | `tight_fit` | One on/off switch for icons drawn inside a card (a widget or theme area). `keep` (off, the default) draws the icon exactly as the author placed it and leaves the card edge to the theme. `shrink` (on) draws an icon the card would cut off at the smaller size the card's own padding leaves for it, down to 8px — and only where the card clips (overflow `hidden`, `clip`, `scroll` or `auto`), because a card that lets the icon show shows all of it. The title is never indented and never wraps earlier, so its words stay where the author put them; a card too narrow even for the smallest icon is left to clip. `wrap` was this answer's older name and is sanitized to `shrink`, the retired `hide` answer to `keep`, and a post’s own title is never fitted. |
| Icon lines up with | `icon_anchor` | What the icon's X/Y offsets are measured from. `first_line` (default) anchors the icon to the title's first line, so a title that wraps to two or three lines keeps the icon exactly where the author placed it, and a side icon sits beside that line's own words — after its last character on the right, before its first on the left. `last_line` anchors it to the bottom line instead, so a side icon sits after that line's last word. `block` measures from the whole text block, the older behaviour: it centres the icon on all the lines together, and a side icon stands at the widest line's edge rather than beside the words on its own line. Applies to every icon, in the editor canvas and on the front end alike; a post may overrule it for its own icon in the sidebar (**Icon lines up with**). |
| Space beside the icon | `icon_spacing` | The space every icon keeps from the words unless its post chooses another answer. `gap` (default) leaves the shipped `0.15em` of the title's own size; `flush` leaves none at all and drops the small-icon centring with it, so the icon's own edge touches the last character rather than its middle standing half a box out. A post can overrule it in the sidebar (**Space beside the icon**), and a post that chooses nothing follows this value. |
| Icon stacking order | `icon_z_index` | The icon's CSS `z-index`, an integer clamped to the range the property accepts. `0` (default) is the page's normal order, so an untouched site draws the icon exactly as it did. A higher number draws the icon in front of elements the theme stacks at a lower number (share bars, ribbons, hover overlays); a negative one puts it behind them. Applied on every placement in the editor canvas and on the front end, so both use the same number. |
| Title size → icon size | `sizing_rules` | The site's bands for an icon that follows the title: an ordered array of `{ font, icon }` pixel pairs. At a band’s `font` the icon is exactly its `icon`, and that row holds from its own title size up to the next row (12→10 with 16→12 draws 10px beside a 14px title and 12px from 16px on), so the icon is never drawn at a size no row names. A title smaller than the first band uses its icon, one larger than the last band uses the last band’s. Normalised on read and save: `font` 4–200, `icon` 4–512, sorted by `font`, one row per size (the later row wins), at most eight rows. An empty table returns the default ladder rather than drawing nothing, and that ladder is one ratio throughout (three quarters of the title at every band) so a small copy draws the same share of its title as a large one. A table an author fills in is only that proportional when its own rows are: a card icon and the post’s page icon differ in size exactly as far as the table’s ratio changes between their title sizes, which [troubleshooting](troubleshooting.md) works through. A stage in the post editor can carry its own table; an empty stage table follows this one, and a stage set to a fixed size keeps its own size instead. |
| Asset library | `assets` | Ordered array of normalized asset records. See [data model](data-model.md#the-asset-library). |
| Folders | `folders` | Ordered array of tag-based saved views. See [assets and folders](assets-and-folders.md). |

### Default stages

The keys `default_stage_1`, `default_stage_2`, and `default_stage_3` each hold a stage with:

| Stage field | Meaning |
| --- | --- |
| `asset_id` | Selected library asset id; empty means no icon configured. |
| `position` | `left` or `right` in the editor. A timeline saved by an older version may still hold `top`, `bottom`, `left-top`, `left-bottom`, `right-top`, or `right-bottom`; it keeps rendering there until a side is chosen. |
| `duration` | Whole-number duration. Zero skips the stage. Maximum is ten years expressed in the selected unit. |
| `unit` | `days`, `hours`, or `minutes`. |
| `size` | Valid CSS length; empty inherits asset size and then falls back to `20px`. |

Built-in defaults are stage 1: 1 day; stage 2: 2 days; stage 3: 7 days. Each starts with no asset, position `left`, and the settings screen lets an administrator change these values. Defaults seed unconfigured post timelines; changing them does not overwrite a post’s saved custom timeline.

## Per-post timeline

Each post timeline is stored as JSON in protected post meta `_titlesparks_timeline_schema`. The REST field name exposed to Gutenberg is `titlesparks_timeline_schema`. It contains:

| Field | Meaning |
| --- | --- |
| `enabled` | Whether this post uses TitleSparks. Defaults to false. |
| `anchor` | Optional post-specific site-clock start. Empty inherits the site setting (or publish date). |
| `stage_1`, `stage_2`, `stage_3` | Stage objects described above. |
| `stage_3_behaviour` | `keep` or `remove` when the entire timeline elapses. |
| `position_offsets` | Complete map of the eight allowed positions to `{ x, y }` integer values, clamped to ±100. |

The server registers the meta only on the public post types enabled in settings. Every metadata write runs through `Security::timeline()`; an invalid or partial value becomes a complete safe timeline.

## Validation details

- Allowed positions, units, and stage-end behaviors are explicit allow-lists shared with the JavaScript editor constants.
- Stage durations are whole, nonnegative integers capped at ten years in days/hours/minutes.
- Asset labels and tags are sanitized; asset URLs must be accepted image URLs.
- Asset tags are lower-case and unique (maximum 12, 32 characters each).
- Folder names determine their ids; the server applies the canonical slug rules.
- An asset size and a stage size are safe CSS lengths. Inheritance order is stage → asset → `20px`.
- Offset data always contains every position, preventing a missing key from dropping an editor’s adjustment.

For the complete serialized structures and the PHP/JS sanitizer mapping, see [data model](data-model.md#the-sanitisation-contract).
