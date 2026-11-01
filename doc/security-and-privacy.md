# Security and privacy

TitleSparks stores configuration and displays selected images, but it should not become an untrusted write path or leak privileged data. Keep these rules in mind when changing the server, browser, or REST API.

## Permissions and request protection

- The admin settings page and library/folder REST operations require `manage_options`.
- Preview requires permission to edit the specific post id.
- Registered timeline metadata has an `auth_callback` based on whether the current user can edit the target post.
- Browser API requests use the authenticated WordPress session and REST nonce supplied by WordPress/bootstrap. A nonce is not a substitute for capability checks.
- Keep each route’s `permission_callback` explicit. Do not rely on the UI hiding a button as authorization.

## Validate every write

`Title_Sparks\Security` and `Title_Sparks\Traits\Security` define accepted values. All write paths should normalize using these methods:

- Settings saves use `Security::settings()`.
- Asset and folder records use their corresponding domain validators.
- Post timelines use `Security::timeline()` regardless of whether they arrive through REST meta, the classic editor, or custom REST routes.
- The browser mirrors allow-lists to help authors, but PHP remains authoritative.

Prefer dropping unusable records or defaulting allow-listed choices over storing partially trusted fields. If a rule changes, update the browser mirror, tests, and the data model/settings docs together.

## Escape output and avoid title mutation

- Escape image URLs, attribute values, inline data, and generated text at the output boundary.
- The front-end title filter returns the title unchanged. Do not inject markup through `the_title`; title values can be printed in attributes, feeds, metadata, breadcrumbs, and secondary loops.
- DOM insertion is limited to discovered visible title elements and uses DOM APIs rather than concatenating author-controlled HTML.
- Keep plugin classes/styles scoped; do not introduce global resets or broad selectors into a shared WordPress page.

## Assets and external data

- An attachment selection is resolved on the server to a URL/label; never trust an arbitrary browser-supplied attachment URL as proof of permission.
- Image URLs and CSS sizes pass sanitizer checks. Continue to reject unsafe URL schemes and declaration injection.
- Library records contain image URL/label/tags, attachment id where available, and display size. They do not store image bytes in the plugin directory.
- The plugin does not define a custom database table or collect analytics/telemetry. No data is transmitted to an external service by normal plugin operation.

## Data lifecycle

- Site-wide configuration is stored in the `titlesparks_settings` option.
- Each configured post’s timeline is stored in protected post meta `_titlesparks_timeline_schema`.
- Deactivation intentionally preserves this data. Any future uninstall implementation should explicitly document what it removes and only delete data after WordPress requests permanent uninstallation.
- Persistent identifiers are part of the plugin’s compatibility contract. After release, migrate renamed option/meta keys explicitly rather than silently dropping users’ saved data.

See [data model](data-model.md), [REST API](rest-api.md), and [troubleshooting](troubleshooting.md) for the relevant data shapes and operations.
