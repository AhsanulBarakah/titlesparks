# Code map

Use this page to locate the source of a behavior before editing it. Production bundles are generated from `blocks/`; do not edit their minified output by hand.

## Plugin entry and server-side components

| Source | Responsibility |
| --- | --- |
| `titlesparks.php` | WordPress plugin header, path/identity constants, class autoloader registration, translations, bootstrap, activation, and deactivation. |
| `includes/class-ts-autoloader.php` | Maps `Title_Sparks\...` class names to the `includes/` directory and class filenames. |
| `includes/class-ts-plugin.php` | Single composition root that registers the plugin’s services. |
| `includes/class-ts-settings.php` | Site-wide option defaults, merged reads, writes, cache invalidation, and setting accessors. |
| `includes/class-ts-security.php` and `includes/traits/trait-ts-security.php` | Plugin data shapes, allow-lists, field sanitizers, and generic validation primitives. |
| `includes/class-ts-asset-library.php` | Reads/writes assets, resolves media attachments, and prepares lightweight editor records. |
| `includes/class-ts-asset-folders.php` | Reads/writes folder rules; folder membership is tag-derived, not stored. |
| `includes/class-ts-post-meta.php` | Registers the protected timeline REST meta, saves classic editor values, and bootstraps editor state. |
| `includes/class-ts-decay.php` | Pure-ish timeline arithmetic: anchor, stage boundaries, expiration, duration, and preview summary. |
| `includes/class-ts-title-renderer.php` | Frontend eligibility, PHP stage/asset resolution, inline page data, CSS/script enqueueing, preview markup. |
| `includes/class-ts-rest-controller.php` | All custom `titlesparks/v1` routes, permission callbacks, and request handlers. |
| `includes/traits/trait-ts-assets.php` | Bundle paths, manifest parsing, cache-busting versions, and safe missing-manifest defaults. |
| `includes/admin/class-ts-settings-page.php` | Top-level admin page, dashboard bootstrap, admin bundle enqueue, and public post-type choices. |
| `includes/admin/class-ts-block-assets.php` | Conditional block editor sidebar bundle/style enqueue. |
| `includes/admin/class-ts-meta-box.php` | Classic editor timeline controls and save UI. |
| `includes/admin/class-ts-media-modal.php` | On-demand markup and dependencies for the native WordPress media picker. |

For the detailed request lifecycle and security invariants, see [architecture](architecture.md). For route details, see [REST API](rest-api.md).

## Browser source

| Source | Responsibility |
| --- | --- |
| `blocks/admin/index.js` | Admin dashboard entry and mount. |
| `blocks/admin/Dashboard.js` | Dashboard tabs, initial state, defaults editing, and page-level composition. |
| `blocks/admin/useLibrary.js` | Admin REST calls and server-returned settings/library/folder state. |
| `blocks/admin/AssetLibrarySection.js` | Asset grid, search/type/folder filtering, paging, and asset edit flow. |
| `blocks/admin/AssetFolders.js` | Folder list, counts, create/edit/delete dialogs. |
| `blocks/admin/DefaultSettings.js` | Global feature switch, post types, default stages, timeline anchor and expiry behavior. |
| `blocks/admin/Guide.js` and `InfoCards.js` | In-product help content. |
| `blocks/sidebar/index.js`, `blocks/sidebar/sidebar.js` | Gutenberg plugin-sidebar registration, post meta subscription, stage controls, and the canvas icon. |
| `blocks/shared/constants.js` | Shared allow-lists, defaults, validation mirrors, timeline serialization, tag/folder behavior, and localized labels. |
| `blocks/shared/stageDates.js` | End-date inputs to stage durations and contiguous timeline date calculations. |
| `blocks/shared/StageEditor.js` | Reusable per-stage controls. |
| `blocks/shared/useAssetLibrary.js` | Shared editor asset-library state and media picker interaction. |
| `blocks/shared/useMediaFrame.js`, `mediaModal.js` | Media modal lifecycle and on-demand modal integration. |
| `blocks/shared/EditorTitleIcon.js`, `editorPreview.js` | Icon rendering/preview in the editor canvas. |
| `blocks/shared/editorTitleDom.js` | Shared box hardening, font-aware gap, offset scaling, measuring and placement primitives. |
| `blocks/shared/frontendTitleDom.js` | Frontend title discovery, icon insertion, and duplicate avoidance. |
| `blocks/frontend/index.js` | Frontend placement orchestration, page data consumption, and reflow handling. |
| `blocks/shared/ui.js`, `icons.js` | Shared presentational controls and inline SVG icon set. |
| `blocks/shared/tailwind.css`, `tailwind.config.js` | Scoped utility generation; keep app CSS under `.titlesparks-app`. |

## Build configuration and outputs

`webpack.config.js` selects a single entry and a separate output directory for each target:

| npm command | Source entry | Output directory |
| --- | --- | --- |
| `npm run build-admin` | `blocks/admin/index.js` | `build-admin/` |
| `npm run build-block` | `blocks/sidebar/index.js` | `build-block/` |
| `npm run build-frontend` | `blocks/frontend/index.js` | `build-frontend/` |

Each output has an `index.js` and an `index.asset.php`; admin and block targets also emit CSS. The manifests provide WordPress dependencies and a content-derived cache version. `npm run build` builds all targets.

## Tests

- `blocks/admin/__tests__/` exercises dashboard components and their author-visible behavior.
- `blocks/shared/__tests__/` exercises timeline/folder/date logic, DOM discovery and placement, CSS invariants, and shared editor behavior.
- `npm run test:unit` runs all 17 Jest suites. The testing guide describes the assertions and live-site checks.

When adding a feature, locate the owning module above, keep server validation authoritative, update the JavaScript mirror if needed, add focused tests, then update the relevant [documentation page](README.md).
