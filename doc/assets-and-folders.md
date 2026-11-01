# Assets, tags and folders

The library is the list of GIFs, icons and images every post can draw. A **tag**
is a word an asset carries; a **folder** is a name plus the tags it collects, and
it shows every asset carrying at least one of them. That is the whole feature:
tags are the filing system, folders are saved views of it.

## Why folders are not containers

An asset cannot be "inside" a folder in the storage sense. If it could, three
things would have to be true at once and stay true:

- deleting an asset would have to find and edit every folder that held it;
- renaming a tag would have to walk the library and rewrite memberships;
- an asset tagged after the fact would stay out of the folder that describes it,
  and someone would have to notice and file it by hand.

So membership is computed, never stored. A folder holds exactly what the rule
says it holds, and the same answer is produced by `assetsInFolder()` in the
browser and by nothing at all on the server — the front end never needs it, so
there is no second implementation to keep in step.

**The match rule is a union.** Naming a second tag widens a folder rather than
narrowing it to assets tagged both ways, which is the reading an author has when
they add one: "also collect these". A folder with no tags holds nothing, and the
panel says so rather than looking broken.

## Tags

- Free form, one word or a short phrase (`hot news` is one tag).
- Stored lower case (mirrored as keys, so `News` and `news` cannot drift apart).
- At most 32 characters, at most 12 per asset, de-duplicated
  (`Security::asset_tag()` / `sanitizeTag()`).
- A string form splits on commas only, because a tag may contain a space.
- The editor offers every tag already in use, with its count, so a new tag is
  usually a click rather than a near-miss of an existing one.

## The UI

Both the **Settings** tab and the **Library** tab lay the library out as two
columns: the grid on the left, the folder panel on the right.

- **The folder panel** (`blocks/admin/AssetFolders.js`): "All assets" plus one row
  per folder, each showing its name, how many assets it holds, and the tags it
  watches; per-row edit and delete buttons; the active folder is highlighted.
  Creating or editing a folder opens a modal with a name and a tag editor.
- **The grid** (`blocks/admin/AssetLibrarySection.js`): cards of four to a row,
  eight to a page, with numbered pages underneath and a `Showing 1–8 of 14`
  summary. The Library tab adds the type tabs (All / GIFs / Icons / Images), the
  search box (which matches labels, URLs and tags) and a row of folder chips.
- **The folder in view** is a prop, owned by `Dashboard`: the panel and the grid
  both need it, and switching tabs should not lose it. Choosing a folder also
  resets the grid to page 1.
- Choosing a folder on either surface narrows the grid; the banner above the grid
  repeats the folder's name, its size and its tags, with a "Show all" escape.
- **Deleting a folder** deletes only the rule. The confirmation says as much, and
  how many assets are in it right now.

## Paging

`LIBRARY_PAGE_SIZE` is 8 — four to a row, two rows — and `paginate()` clamps the
page into range rather than resetting it, so deleting the last card on the last
page leaves a page that exists. A page change or a filter change is never a
request: the whole library is already in the browser, which is what makes the
folder switch instant.

That is a deliberate trade. `to_editor_list()` sends every asset's tags to the
browser so a folder can be counted without a round trip; a site with thousands of
assets in one library would want the filter pushed back into a REST argument
instead.

## REST routes

Namespace `titlesparks/v1`. Every route requires `manage_options` except
`GET /preview/{post_id}`, which requires the ability to edit that post.

| Route | Method | Body | Returns |
| --- | --- | --- | --- |
| `/settings` | GET | — | `settings`, `assets`, `folders`, allow-lists, defaults |
| `/settings` | POST | `settings` (partial is fine) | `settings`, `assets`, `folders`, `message` |
| `/assets` | POST | `asset` (`{ id, label, url, size, tags }`, or `attachment_id` to build one) | `asset`, `assets`, `folders`, `message` |
| `/assets/{id}` | DELETE | — | `assets`, `message` |
| `/folders` | POST | `folder` (`{ id?, name, tags }`) | `folder`, `folders`, `message` |
| `/folders/{id}` | DELETE | — | `folders`, `message` |
| `/media-modal` | GET | — | the WordPress uploader markup, on demand |
| `/preview/{post_id}` | GET | — (or `timeline` to preview unsaved changes) | `stage`, `expired`, `remaining`, `endsAt`, `html`, `summary` |

Notes for anyone editing these:

- A write returns the **whole** library and folder list, not just the row that
  changed, so the browser never has to merge its own optimistic guess.
- `POST /settings` merges onto the stored row before validating, so a payload
  that omits `assets` or `folders` cannot blank them.
- `POST /assets` accepts a bare `attachment_id`: the server looks up the URL, the
  preview size and the label itself, and no image data is trusted from the client.
- `POST /folders` derives the folder's id from its name when none is given, which
  is what makes two folders called "News" one folder.
- The routes are registered in `Rest_Controller::register_routes()` and the
  permission callbacks are one method each; there is no other write path from the
  browser.
