# Hooks and extension points

TitleSparks exposes a small set of WordPress hooks for extensions. Prefer these supported hooks over reaching into private properties or changing plugin option values directly. Check the source annotations before relying on an argument’s exact type across major upgrades.

## Actions fired by TitleSparks

| Hook | Arguments | Fired when |
| --- | --- | --- |
| `titlesparks_loaded` | `Plugin $plugin` | The plugin has completed booting and registered its components. |
| `titlesparks_settings_saved` | `array $clean` | A sanitized global settings payload has been persisted. |
| `titlesparks_timeline_saved` | `int $post_id`, `array $timeline` | A sanitized per-post timeline has been persisted. |

These action callbacks should avoid recursively saving the same settings/timeline unless recursion and duplicate writes are explicitly guarded.

## Filters applied by TitleSparks

| Hook | Value and arguments | Purpose |
| --- | --- | --- |
| `titlesparks_icon_alt_text` | Filter `string $label`; receives `array $asset`, `array $resolved` | Change the accessible alt text for a rendered title icon. Return text, not markup. |
| `plugin_action_links_{plugin_basename}` | WordPress plugin link list | TitleSparks prepends its Settings link when the current user has `manage_options`. This is a standard WordPress plugin-specific filter, not a fixed TitleSparks hook name. |

The title renderer also participates in WordPress’s `the_title` filter, but deliberately returns the title unchanged. It uses that hook only to notice eligible visible titles and collect icon data for the page script. Extensions should not expect this filter to contain TitleSparks markup.

## Adding an extension

1. Hook into the documented action/filter using `add_action()` / `add_filter()`.
2. Use unique callback names and namespaces; do not define generic global functions.
3. Respect WordPress capability checks and escaping requirements in any UI/API your extension adds.
4. Avoid writing TitleSparks’ option or post-meta rows directly. Use supported Settings/REST behavior so sanitization and cache invalidation run.
5. Add a focused test or integration note and update this page if you add a supported hook.

Public REST routes are documented in [REST API](rest-api.md). New first-party features should follow [adding a feature](adding-a-feature.md).
