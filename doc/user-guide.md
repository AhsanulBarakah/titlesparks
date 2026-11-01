# User guide

TitleSparks lets a site administrator maintain a shared library of title icons and lets editors configure a three-stage timeline for supported posts. The icon shown on the site follows the post’s current stage.

## Requirements

- WordPress 6.6 or newer.
- PHP 7.4 or newer.
- For source development only: Node.js 20+ and npm 10+.

## Install and activate

1. Upload the `titlesparks` plugin folder to `wp-content/plugins/`, or upload a plugin ZIP that contains that folder and its `titlesparks.php` entry file.
2. In WordPress, open **Plugins** and activate **TitleSparks**.
3. Open the **TitleSparks** top-level administration page. Users need the `manage_options` capability to manage the shared plugin settings.
4. Switch on TitleSparks, select the public post types where it may run, and save.
5. Add assets to the shared library and choose defaults for new posts.

The plugin can be installed under a renamed directory: its paths are derived from the entry file rather than hard-coded to one folder name. WordPress’s plugin identity is the entry file path, so moving the directory may require reactivating the plugin in the Plugins screen.

## Manage the asset library

1. Open **TitleSparks** and go to the library view.
2. Use the WordPress media picker to choose an attachment, or add an image using its URL and a readable label.
3. Optionally choose a display size and add tags. Tags are lower-case, de-duplicated, limited to 32 characters each and 12 per asset.
4. Save. The library can filter by GIF, icon, image, search text, and folder. Search matches labels, URLs, and tags.
5. Use folders to create saved tag-based views. A folder matches assets carrying **any** of its tags. Folders with no tags are empty.

Deleting an asset removes the library entry. Posts that refer to the removed asset safely render no icon until an editor selects an existing asset again. Deleting a folder only deletes the saved view; it does not remove the tags or assets.

## Configure site defaults

In the settings area:

- Enable or disable TitleSparks globally.
- Select public post types where icons are allowed. Attachments are not offered.
- Set a default for each stage: icon, position, duration, and unit.
- Choose whether timelines begin at each post’s publish date or at one fixed site date/time.
- Choose what happens after stage three: keep the latest configured icon permanently, or remove it.
- Choose the space beside an icon (**Space beside the icon**): the usual gap, or flush against the words for icons that finish the last word rather than standing beside it. A post can overrule it for its own icon, and a post that chooses nothing follows this setting.
- Choose what the offsets count from (**Icon lines up with**). **First line of the title** (the default) keeps the icon on the line you placed it on, so a title that wraps to two or three lines does not drag it down, and puts a side icon right beside that line’s words. **Last line of the title** keeps it on the bottom line instead, and puts a side icon after that line’s last word. **Middle of the whole title** centres it on all the lines together, the older behaviour, which measures a side icon from the widest line rather than from the words on the icon’s own line.
- Set **Fit icons inside tight cards** when a widget or homepage card is narrower than the icon. Off (the default) draws the icon exactly where you placed it and leaves the card edge to your theme; on draws an icon that a card would cut off at the smaller size the card’s own padding leaves for it, down to 8px. Only a card that hides what leaves it is affected, and the title itself never changes: its words stay on the same line and are never indented, so a widget title keeps its full line length. An icon is never hidden, and a post’s own title is never fitted.
- Choose which areas of your pages may show icons. **Theme areas** list each block the scan finds in your theme's templates, its template parts, your front page and the recent content of your posts and pages, with a synced pattern listed by the blocks it holds; every entry says which pages it appears on. **Widgets** list the widget instances assigned to active sidebars, named by their title or by the block they contain, by the sidebar they sit in and by the pages that sidebar renders on; two widgets that end up with the same name carry their instance ID so they can be told apart. **Deep scan** reads everything again after you add a widget or change a template, a post or a page. The name of the theme that list was read from sits above it, because the list is the cached result of the last scan: after you switch theme, the entries still belong to the old one until **Deep scan** runs, and a child theme is named with the theme it is built on.
- Choose how an icon that follows the title is sized, under **Title size → icon size**. Type a title size and the icon size you want for it, and add a row for each size you care about. These are the site's sizes; a stage in the post editor can carry a table of its own.
- Set the icon's **stacking order** when your theme stacks its own elements over the title. It is the icon's CSS `z-index`: `0` is the page's normal order and changes nothing, a higher number brings the icon over a share bar, ribbon or hover overlay, and a negative number sends it behind them. The editor and your site use the same number.

These settings seed new and unconfigured post timelines. Editors may change the timeline for an individual post. See the [settings reference](settings-reference.md) for the exact fields and behavior.

## Edit a post timeline

1. Open a post type enabled in TitleSparks.
2. Open the TitleSparks sidebar in the block editor. The classic editor also has a metabox fallback.
3. Enable the timeline for this post.
4. For each of the three stages, choose a library asset, a position, an end date/time (or duration in the classic editor), and optionally an icon size.
5. Under **How the icon sits on this title**, leave **Icon lines up with** and **Space beside the icon** on the site settings, or pick the first line, the last line or the middle of the whole title, and the usual gap or a flush icon, for this post alone.
6. Review the preview beside the post title. It updates as you edit. Save the post to persist the timeline.

Stages are sequential: stage two starts when stage one ends; stage three starts when stage two ends. The timeline uses the post publish date by default, unless the site uses a fixed start or the post has its own saved anchor. All dates are interpreted using the WordPress site clock, not the browser’s timezone.

A stage with zero duration is skipped. After all three stages elapse, **Keep Icon Permanently** displays the newest stage that actually has an icon; **Disappear Completely** displays nothing. A missing or deleted asset never produces a broken image.

## Icon sizing

Each stage chooses how its icon is drawn, under **Sizing mode**. **Fixed size** uses the size you set, or the library asset's own size when the stage sets none. **Advanced (custom sizes)** draws the icon from a table of title sizes and icon sizes, and those rows appear only once you choose it, so you can see what you are setting up. Each row sets the icon size for titles from its own title size up to the next row, so `12` → `10` with `16` → `12` draws a 10px icon on a 14px title and 12px from a 16px title onwards, and `32` → `32` with `40` → `45` gives every title from 32px to 39px a 32px icon. A title smaller than every row uses the first row’s icon, and one larger than every row uses the last, so the sizes you choose also hold at the extremes. No size is invented between rows: the icon is always drawn at a size you typed.

**Advanced** starts from a copy of the site’s table under **Title size → icon size** in the settings, so the first edit has numbers to work from; editing a row gives this stage a table of its own, which the other stages and the settings do not share. Add a row for each size you want, and remove any you do not — one row always stays. An empty site table falls back to the sizes the plugin ships with. Switching back to a fixed size keeps the stage’s table, so going back to Advanced finds the numbers you last set.

## Icon positions and offsets

Each stage has a **Flip horizontally** option for an icon that faces the wrong way: an arrow or a hand can be mirrored for that stage alone, in the editor and on the page, without editing the library asset or the other stages. The icon sits to the left or the right of the title. The X/Y offset fields then move it anywhere from there: positive X moves it right, positive Y moves it down, and negative values move it the other way. Leaving both at 0 keeps the icon centred on the title's first line, the same in the editor and on the page: a headline that becomes two or three lines — a phone, a narrower column, a longer title — leaves the icon exactly where you put it. Offsets are bounded from -100 to +100 and scale with the rendered title size, in proportion: a title near the editor's own size gets your number almost exactly, and a title half that size gets half the nudge, so the same post's icon sits the same way in a widget or a listing card as on its own page. Only a very large headline stops growing the nudge, at 1.4x, where it would otherwise clear a whole line. With a stage that follows the title size, the nudge follows the icon rather than the text alone: it keeps scaling with the title up to the point where your table stops growing the icon, and holds at that size from there, because the icon itself has stopped following the title. A copy whose icon is already held at one width by its table gets a nudge that holds with it, however much larger the copy's title is. Changing Size never draws the icon over the words and never moves it off the title's line: up to 20px it grows and shrinks about its own middle, and larger icons keep their gap and grow away from the title. A stage saved by an older version with an above/below or corner position keeps that position, shown as a legacy choice, until you pick a side.

**Icon lines up with** in the sidebar moves this post's icon to the last line, so its offsets count from the bottom line and a side icon sits after that line’s last word, or to the middle of the whole title, which is the older behaviour. Leaving it on **Use site setting** follows the site's own answer, so a post that never chooses keeps up with the setting. **Space beside the icon** can also be set to **Flush against the words** for this post: the gap goes to zero and the icon’s own edge, not its middle, is what touches the last character. Both choices follow the icon wherever it is drawn, including a card on a listing page; every other post keeps the site setting, which offers the same two answers so a site can prefer one without touching its posts.

## Translations and languages

The text domain is `titlesparks`. The generated translation template is `languages/titlesparks.pot`. WordPress.org can provide hosted translations; the plugin also declares a local languages directory for translation catalogs shipped with manual installations. See [release and maintenance](release-and-maintenance.md).

## Frequently asked questions

### Will disabling or deactivating delete my library?

No. Deactivation leaves settings, assets, folders, and per-post timelines in place. Ordinary deactivation does not erase plugin data.

### Why does an icon not appear?

Check that the global switch and post type are enabled, the post timeline is enabled, the current stage has an asset, its duration has not elapsed (or the final behavior is Keep), the asset still exists in the library, and the frontend bundle is present. See [troubleshooting](troubleshooting.md).

### Why does the editor show a different clock than I expect?

The timeline uses WordPress’s configured site timezone. Browser timezone is intentionally not used for stage calculation.

### Are assets assigned directly to folders?

No. Folders are saved views based on tags. Assets keep their tags, and matching assets appear automatically in every folder that watches one of those tags.
