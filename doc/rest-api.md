# REST API reference

TitleSparks registers routes under the WordPress REST namespace `titlesparks/v1`. The root is normally `https://example.test/wp-json/titlesparks/v1` (use the WordPress-provided REST URL in code rather than constructing it manually).

## Authentication and permissions

For browser requests, use the authenticated WordPress session and a REST nonce. The admin and editor bootstrap objects provide the REST URL/namespace and nonce. With `wp.apiFetch`, WordPress’s integration handles the nonce for same-origin requests.

- Settings, assets, folders, and media-modal routes require `manage_options`.
- Preview requires the current user to be able to edit the target post.
- Post meta is registered with its own per-post edit capability callback.
- Every write is sanitized server-side. Never treat browser validation as authorization or data validation.
- Route registration is centralized in `Rest_Controller::register_routes()`.

## Routes

| Path | Method | Permission | Request | Response |
| --- | --- | --- | --- | --- |
| `/settings` | GET | `manage_options` | None | `settings`, `assets`, `folders`, allowed `positions`, `behaviours`, `units`, and `defaults`. |
| `/settings` | POST | `manage_options` | `{ "settings": { ... } }` | Sanitized `settings`, `assets`, `folders`, and a `message`. Omitted settings merge with the stored values before validation. |
| `/homepage-sections` | GET | `manage_options` | None | Fresh deep-scan results: `sections`, active `widgets`, the active theme `name`, and a `message`. Nothing is persisted. |
| `/assets` | POST | `manage_options` | `{ "asset": { "id", "label", "url", "size?", "tags?", "attachment_id?" } }` | Saved `asset`, full editor `assets` list, `folders`, and a `message`. |
| `/assets/{id}` | DELETE | `manage_options` | Asset id in path | Updated `assets` and a `message`. |
| `/folders` | POST | `manage_options` | `{ "folder": { "name", "tags", "id?" } }` | Saved `folder`, full `folders` list, and a `message`. The id is derived from the name. |
| `/folders/{id}` | DELETE | `manage_options` | Folder id in path | Updated `folders` and a `message`. The assets and their tags are unchanged. |
| `/media-modal` | GET | `manage_options` | None | `{ "html": "..." }` markup for the WordPress media picker, loaded on demand. |
| `/preview/{post_id}` | GET | Edit target post | Optional `timeline` object for unsaved preview | `stage`, `expired`, `remaining`, `endsAt`, `html`, and human-readable `summary`. |

`DELETE /assets/{id}` returns a not-found error when the asset id is unknown. Invalid asset/folder writes return a `WP_Error` with HTTP 400; unknown deletes return HTTP 404; permission failures use WordPress’s authorization response code.

## Browser request examples

Fetch settings:

```js
const state = await wp.apiFetch( {
  path: '/titlesparks/v1/settings',
} );
```

Create/update a tag-based folder:

```js
const result = await wp.apiFetch( {
  path: '/titlesparks/v1/folders',
  method: 'POST',
  data: { folder: { name: 'Breaking news', tags: [ 'breaking', 'news' ] } },
} );
```

Add an existing Media Library attachment. The server resolves its URL and title:

```js
const result = await wp.apiFetch( {
  path: '/titlesparks/v1/assets',
  method: 'POST',
  data: { asset: { attachment_id: 123, tags: [ 'news' ] } },
} );
```

Preview an unsaved timeline for a post the user can edit:

```js
const preview = await wp.apiFetch( {
  path: '/titlesparks/v1/preview/123',
  method: 'GET',
  data: { timeline: draftTimeline },
} );
```

The exact `apiFetch` query encoding depends on the WordPress version and request method; follow the neighboring project call sites when adding a route.

## Response ownership and state updates

Mutation responses include the current affected list rather than requiring the client to reconcile an optimistic local guess. The dashboard keeps state/actions in its library hook and applies returned state after mutations. Preserve that convention for new routes.

For storage shapes and migration rules see [data model](data-model.md). For an implementation checklist see [adding a feature](adding-a-feature.md).
