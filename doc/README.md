# TitleSparks documentation

This folder contains the complete user and developer documentation for TitleSparks. Use this page to find the right guide, then follow its links for implementation detail.

## Start here

| Guide | Audience | What it covers |
| --- | --- | --- |
| [Overview](overview.md) | Everyone | Product summary, requirements, and basic development commands. |
| [User guide](user-guide.md) | Site administrators and editors | Installation, first-time setup, adding assets, creating timelines, previews, and common questions. |
| [Settings reference](settings-reference.md) | Administrators and developers | Every site-wide setting, default, and what it changes. |

## Developer reference

| Guide | What it covers |
| --- | --- |
| [Architecture](architecture.md) | PHP and JavaScript components, lifecycle, bundles, rendering flow, and project invariants. |
| [Data model](data-model.md) | Stored option/meta fields, assets, folders, sanitization, defaults, and migrations. |
| [Assets, tags, and folders](assets-and-folders.md) | Asset library behavior, tags, folders, paging, and relevant REST endpoints. |
| [REST API](rest-api.md) | Routes, permissions, request/response shapes, examples, and error handling. |
| [Security and privacy](security-and-privacy.md) | Capability boundaries, sanitization, escaping, data lifecycle, and privacy expectations. |
| [Hooks and filters](hooks-and-filters.md) | Supported WordPress extension points and their arguments. |
| [Frontend rendering](frontend-rendering.md) | Timeline resolution, title discovery, positioning, offsets, responsive behavior, and accessibility. |
| [Adding a feature](adding-a-feature.md) | Safe implementation sequence covering storage, validation, REST, UI, tests, and docs. |
| [Testing and tooling](testing-and-tooling.md) | Commands, test coverage, lint baseline, and real WordPress verification. |
| [Troubleshooting](troubleshooting.md) | Common installation, build, editor, library, preview, rendering, and migration issues. |
| [Release and maintenance](release-and-maintenance.md) | Translation catalogs, builds, packaging, compatibility, and release checklist. |
| [Code map](code-map.md) | Fast lookup from behavior to the owning PHP, JavaScript, build, and test files. |

## System at a glance

The plugin entrypoint `titlesparks.php` defines its paths and shared names, loads the class autoloader, and registers WordPress lifecycle callbacks. `Title_Sparks\Plugin` wires the services together after WordPress loads plugins. Global settings, the asset library, and folder rules live in one option; each post’s timeline is stored as JSON in protected post meta. The server validates every write through `Security` and the REST controller. Three independently built browser bundles provide the settings dashboard, editor sidebar, and front-end title icons.

The main request flow is:

1. WordPress loads `titlesparks.php`; its constants resolve paths relative to the actual plugin directory, including a directory named `titlesparks`.
2. `Plugin::boot()` performs any one-time storage migration, then registers metadata, the title renderer, REST routes, admin pages, editor assets, and fallback metaboxes.
3. The dashboard and editor receive initial server-rendered bootstrap data and fetch/update through the `titlesparks/v1` REST namespace where appropriate.
4. The renderer resolves one timeline stage for a visible post title. The frontend bundle locates the corresponding title in the completed document and positions the icon without changing the title string.

## If you only have five minutes

- **Where does a stored setting go?** Add defaults to `Settings::defaults()` and validation to `Security::settings()`; see [data model](data-model.md).
- **Where are writes authorized?** In `Rest_Controller` route permission callbacks; see [REST API](rest-api.md).
- **Where does front-end positioning live?** `Title_Renderer` resolves data in PHP and `blocks/shared/frontendTitleDom.js` plus `editorTitleDom.js` position it; see [frontend rendering](frontend-rendering.md).
- **How do I validate a change?** Run `npm run build` and `npm run test:unit`, then use [testing and tooling](testing-and-tooling.md) for live checks.
- **What should be updated with a feature?** Follow [adding a feature](adding-a-feature.md), and update the affected reference pages here.

## Documentation conventions

- Paths and identifiers in these guides reflect the source code; when behavior changes, update the corresponding page in the same change.
- `readme.txt` is the WordPress plugin-directory readme; this Markdown folder is the longer-lived project documentation. The repository's root `README.md` is the landing page a code host renders, so it restates `readme.txt`'s description and screenshots rather than replacing either.
- The root `doc/README.md` is intentionally the table of contents, so a new guide should be linked above.
- Example data is illustrative. Production writes still have to pass through the plugin’s PHP sanitizer.
