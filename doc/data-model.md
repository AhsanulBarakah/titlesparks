# Data model

Everything TitleSparks stores lives in two places: one option row for the site,
one meta row per post. There is no custom table, no cron, and nothing cached
outside the request.

```text
wp_options:  titlesparks_settings      -> Settings        (switches, defaults, assets, folders)
wp_postmeta: _titlesparks_timeline_schema -> Post_Meta    (one post's timeline)
```

Both keys are defined once in `titlesparks.php` (`TITLE_SPARKS_OPTION_NAME`,
`TITLE_SPARKS_META_KEY`) and read through those constants everywhere.

## The settings row

Written only by `Settings::update()`, which runs the whole payload through
`Security::settings()`. Read with `Settings::all()`, which merges the stored row
over `Settings::defaults()` — which is why a key added in a new version works on
an existing install without a migration.

```php
array(
    'enabled'           => false,          // is the feature on site-wide
    'post_types'        => array( 'post' ),// public post types it may run on
    'assets'            => array(),        // the library (below)
    'folders'           => array(),        // the folder views (below)
    'default_stage_1'   => array( ... ),   // a stage (below): asset_id, position, duration, unit, size
    'default_stage_2'   => array( ... ),
    'default_stage_3'   => array( ... ),
    'default_behaviour' => 'keep',         // keep | remove, once stage 3 has elapsed
    'tight_fit'         => 'keep',         // keep | shrink, one on/off switch for icons inside narrow cards
    'icon_anchor'       => 'first_line',  // first_line | last_line | block, what the icon's X/Y offsets count from
    'icon_z_index'      => 0,              // signed CSS z-index; 0 is the page's normal order
    'sizing_rules'      => array(),        // the site's bands: { font, icon } pixels; normalised on read
    'anchor_source'     => 'post',         // post | fixed
    'anchor_datetime'   => '',             // 'Y-m-d H:i:s' on the site clock, when fixed
)
```

`sizing_rules` is how a title-following icon is sized: an ordered table of
title-size bands, each naming the icon size at one title size. A band holds from
its own title size up to the next band’s, so no size is invented between two
rows, and outside the table the nearest band holds
— a title smaller than the first band draws its icon, a larger one draws the
last band's. The site table is stored as `array()` and normalised on read, so the
default ladder ships without being written into every install, and a site that
has never edited it still has a table to draw from. A stage can carry a table of
its own; an empty stage table means "use the site's". There is no other sizing
mode: a title-following icon is always drawn from bands.

`anchor_source` decides what a post's timeline counts from: `post` uses the
publish date, `fixed` uses `anchor_datetime`. A post may still store an anchor of
its own, and `Settings::anchor_for()` prefers it — that is what keeps timelines
saved before this setting existed behaving as they did.

### A stage

```php
array(
    'asset_id'      => 'att-12',                 // library asset id ('' = none)
    'position'      => 'left',                   // Security::allowed_positions()
    'flip'          => false,                    // mirror the icon horizontally for this stage only
    'duration'      => 3,                        // length, in `unit`
    'unit'          => 'days',                   // days | hours | minutes
    'size'          => '20px',                   // '' = inherit the asset's own size
    'size_mode'     => 'fixed',                  // fixed | advanced (follows the title size)
    'sizing_rules'  => array(),                  // this stage's own bands; empty = the site's table
)
```

`size` is deliberately the raw CSS length rather than a resolved one: an empty
size means "whatever the asset is set to", and filling in the default here would
silently resize every stage that has never chosen one. Resolution order (stage →
asset → `20px`) lives in `Security::icon_size()` and `iconSize()` in
`blocks/shared/constants.js`, which mirror each other.

`size_mode` chooses between that fixed length and following the title, where the
icon's width comes from title-size bands: the stage's own table when it has one,
the site's when it does not — which is why the post editor can offer the band
fields only once **Advanced** is chosen. The stage's table is kept whatever the
mode is — switching back and forth must not lose the numbers the author wrote —
so **only `size_mode` decides whether it is read**. A stage saved before the
bands were the only calculation carries `adaptive`, which meant "follow the
title"; both sanitizers map it to `advanced` so the author's choice survives.
The renderer resolves the table into each icon's data (`sizeMode` and
`sizingRules`) so the browser does not need a second copy of the fallback rule.
The front end draws the icon at roughly the default ladder's proportion until
the script has measured the title, and the placement script then writes the
band's exact pixel width.

## The asset library

An asset row, as stored in the `assets` key and as sent to the browser by
`Asset_Library::to_editor_list()`:

| Key | Stored | Sent to the editor | Notes |
| --- | --- | --- | --- |
| `id` | ✓ | ✓ | `att-<attachment id>`, or any slug for a manually added row |
| `label` | ✓ | ✓ | defaults to the attachment title, then to the id |
| `url` | ✓ | ✓ | the file the front end draws |
| `attachment_id` | ✓ | — | stays on the server |
| `size` | ✓ | ✓ | CSS length, `20px` by default |
| `tags` | ✓ | ✓ | normalised, ≤ 32 characters each, ≤ 12 per asset |
| `preview` | — | ✓ | computed: WordPress' `medium`/`thumbnail` copy, for grids |

`preview` exists because an animated GIF is routinely several megabytes and a
card is 80 pixels tall: the grid paints the still frame first and swaps in the
animation when the browser is idle (`useDeferredPreview`). The file the front end
uses is always `url`.

## Folders and tags

```php
'folders' => array(
    array( 'id' => 'news', 'name' => 'News', 'tags' => array( 'news', 'flash' ) ),
)
```

A folder stores a **rule**, not a member list: `id` (derived from the name on the
server with `sanitize_title()`, and on the client by `folderId()`), `name`, and
the tags it collects. An asset is in the folder when it carries **at least one**
of them, so tagging a new icon once files it into every folder that already
describes it, and deleting a folder can never delete or unfile an asset. Tags are
lower case on both sides so `News` and `news` are one tag. The full behaviour is
in [`assets-and-folders.md`](assets-and-folders.md).

## Post meta

`_titlesparks_timeline_schema` holds one JSON string per post, written by
`Post_Meta::save()` and read by `Post_Meta::get()`. It accepts JSON as well as a
PHP array so a site that has been through the meta box and one that has only ever
been saved by the block editor look identical.

```json
{
  "enabled": true,
  "anchor": "2026-10-01 12:00:00",
  "stage_1": { "asset_id": "att-12", "position": "left", "duration": 1, "unit": "days", "size": "", "size_mode": "fixed", "sizing_rules": [] },
  "stage_2": { ... },
  "stage_3": { ... },
  "stage_3_behaviour": "keep",
  "position_offsets": {
    "left": { "x": 0, "y": 0 },
    "right": { "x": 0, "y": 0 },
    ...one entry for every allowed position...
  },
  "icon_anchor": "",
  "icon_spacing": ""
}
```

`position_offsets` is always the complete set, whether or not the stored data had
one, because the renderer and the editor both look an offset up by the position
they are about to draw. An offset is a screen delta: positive moves the icon
right or down, negative moves it left or up, for every position. Both axes move
freely in either direction within ±100, including over the title text. The
editor preview, the editor canvas and the front end apply the same rules;
only inline widget icons keep a small horizontal clearance from their text.
Offsets are relative to the title's whole text block, so a title that wraps at
the theme's width does not move the icon to a different line's edge.

**An empty `anchor` means "use the site's choice"** (`Settings::anchor_for()`),
which is how a per-post override and a site-wide default coexist.

`icon_anchor` is the same idea for the icon itself: an empty string follows the
site's **Icon lines up with** setting, while `first_line`, `last_line` or `block`
overrides it for this post alone (`Settings::icon_anchor_for()`). `icon_spacing`
is `gap` for the shipped `0.15em` space beside the icon, `flush` for none at
all, and empty for the site's **Space beside the icon** setting
(`Settings::icon_spacing_for()`). Both answers travel with the post's icon
wherever it is drawn, including a card on a listing page, and an unknown value
falls back to following the site rather than to a silent default.

## The sanitisation contract

`Title_Sparks\Security` is the only place that decides what a valid value is, and
every write path goes through it. Two things follow from that:

- A stored value cannot differ depending on which entry point wrote it — the meta
  box, the REST controller and the settings page all normalise identically.
- The browser constants (`blocks/shared/constants.js`) mirror the PHP ones, so the
  editor never offers a value the server would reject. When you change one, change
  the other, and update the test that pins them together.

| PHP | JS | Guards |
| --- | --- | --- |
| `Security::asset_tag()` | `sanitizeTag()` | one tag: lower case, single spaced, ≤ 32 chars |
| `Security::asset_tags()` | `sanitizeTags()` | ≤ 12 unique tags; a string splits on commas only |
| `Security::folder()` | `normalizeFolders()` / `folderId()` | a folder id/name/tags; the id derives from the name |
| `Security::library_asset()` | `normalizeAssets()` | one asset row |
| `Security::timeline()` | `emptyTimeline()` / `readTimelineFromJson()` | a whole timeline |
| `Security::offsets()` | `emptyOffset()` | one offset per position, clamped to ±100 |
| `Security::stage()`, `stage_duration` | `stageSeconds()` | a stage: asset, position, length, unit, size, sizing mode and its bounds |
| `Security::size_mode()` | `sizeMode()` | `fixed` or `advanced`; a legacy `adaptive` becomes `advanced`, anything else `fixed` |
| `Security::sizing_rules()` | `normalizeSizingRules()` | the site's bands: `font` 4–200, `icon` 4–512, sorted, one row per font size, at most 8, defaults when empty |
| `Security::stage_sizing_rules()` | `stageSizingRules()` | one stage's bands: the same cleaning, but an empty answer stays empty so the stage follows the site's table |
| `Security::settings()` | `Dashboard.makeDraft()` | the whole settings payload |

Values that are not usable are **dropped, not repaired**: an asset with no id or
URL never reaches storage, a tag that sanitises to nothing is not stored at all,
and an unrecognised position becomes `left`. The front end can therefore render
whatever it finds without another check.

## Defaults and lifecycle

- **Defaults** live in `Settings::defaults()` and are merged on read, so adding a
  setting is a one-line change that also works on existing installs.
- **Deactivation** writes nothing: the library and every post's timeline survive
  a deactivate/reactivate cycle, because that is what users expect. Permanent
  removal is therefore an explicit decision, not a side effect — if you add an
  `uninstall.php`, it is the only file allowed to delete the option row and the
  meta key.
- **Storage names** are the TitleSparks names from the first release. Because
  this plugin was renamed before release, no legacy-key migration is included.
  If an incompatible storage rename is needed in a future released version,
  introduce and test an explicit upgrade path before changing the keys.
