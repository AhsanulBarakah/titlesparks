=== TitleSparks ===
Contributors: jamaaldev, ahsanulbarakah
Donate link: https://www.buymeacoffee.com/jamaaldev
Tags: post title, icons, images, gif, editor
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Attach customizable images, icons, and animated GIFs to post titles, with a three-stage expiration timeline.

== Description ==

TitleSparks draws a visual marker beside the titles of the posts you choose — an
icon, an image or an animated GIF — and lets that marker change on a schedule.
Each post carries its own timeline of up to three stages, so a "New" badge can
hand over to a quieter icon and then disappear without the post being edited
again.

The same icon follows the title wherever that title is printed: the post itself,
an archive card, a sidebar's latest-posts list, and the previous and next links
that point at it.

* One shared library of assets; every post picks from it and keeps its own timeline.
* Up to three stages per post, each with its own asset, position and expiry.
* A live icon in the editor, so you see the result while you write.
* Works with classic and block themes alike.

== Installation ==

1. Install the plugin through **Plugins → Add New**, or upload `titlesparks.zip`.
2. Activate TitleSparks through the Plugins screen.
3. Open **TitleSparks** in the administration menu to choose the supported post
   types and the default timeline behavior.
4. Edit a supported post to give it its own timeline.

== Frequently Asked Questions ==

= Does the icon stay right when a page is cached? =

Yes. Each page carries every stage's start and end time, and the browser picks
the stage that is live from its own clock, so a cached page shows the stage a
reader should see.

= Does it slow my site down? =

One small script loads on pages that have an icon to place, and a small
stylesheet loads on every page while the plugin is switched on.

= Will it change my post titles? =

No. The title text is never filtered or rewritten; the icon is placed beside it
in the browser, after the page has loaded.

= What happens when I delete the plugin? =

Its settings, every post's timeline and the still frames it made for animated
GIFs are removed. Your images in the Media Library are kept.

= Where can I find the source code? =

The compiled JavaScript is built from the source in the public repository:
https://github.com/AhsanulBarakah/titlesparks (the `blocks/` folder). To rebuild
it, run `npm ci` and then `npm run build`.

== Screenshots ==

1. The asset library, with its tags, folders, search box and type filters over every icon, image and animated GIF the site can attach to a title.
2. A post's timeline in the editor sidebar: the stage that is live, its asset, position, expiry date and size scale, with that icon drawn on the real title in the canvas.
3. Default settings: the position of an icon, the line of the title it lines up with, the space beside it, and the switch that fits icons inside tight cards.
4. Supported post types and the page types that show icons, above the Theme areas and widgets list, where each area's switch names the pages it appears on and each widget's switch names the sidebar it sits in.
5. A post's own page: the icon beside the article title, at the size and position that post's own timeline asks for.
6. The previous and next links at the foot of a post, each carrying the icon of the post it points to.
7. An archive or the homepage, where every copy of a title is decorated and each card's icon is sized from that card title's own size.

== Changelog ==

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.0 =
First release. Nothing to do before installing.
