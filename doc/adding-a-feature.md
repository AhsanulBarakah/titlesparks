# Adding a feature

The order below is not a style guide: each step depends on the one before it, and
doing them out of order is how half-validated data ends up in the database. The
folder feature described in [`assets-and-folders.md`](assets-and-folders.md) was
built in exactly this order and is a decent worked example.

## 1. Decide what is stored, and where

- **Site-wide** → a key in the settings row (`Settings::defaults()`), read and
  written through a small facade class if it is a list (`Asset_Library`,
  `Asset_Folders` are two).
- **Per post** → a key in the timeline (`includes/class-ts-post-meta.php`).
- **Nothing at all** → better, if the value can be computed. Folder membership is
  computed for this reason.

Add the key to `Settings::defaults()` *and* to `Security::settings()`. Merging on
read means existing installs pick it up with no migration.

## 2. Define the sanitizer

Add to `includes/class-ts-security.php` (or the trait, if it is generic):

```php
public static function thing( $value ) {
    // return the one shape the rest of the plugin may assume
}
```

Rules that are not negotiable:

- unusable input is **dropped, not repaired**;
- the returned array always has every key, so callers never need `isset()`;
- field-level pieces are reused (a list of things calls the one-thing sanitizer);
- a limit constant is declared here and mirrored in
  `blocks/shared/constants.js`, with a comment naming its counterpart.

Then mirror it in JS, and pin both with a test — see
[`testing-and-tooling.md`](testing-and-tooling.md#what-each-test-file-is-for).

## 3. Expose it over REST

Add the route in `Rest_Controller::register_routes()` with a
`permission_callback` (`can_write_settings` for anything that changes state),
validate the payload with the sanitizers from step 2, and return the **whole**
affected state plus a `message`. See
[the routes table](assets-and-folders.md#rest-routes).

If the feature also has to survive a page load without a request, add it to the
bootstrap in `Settings_Page::localize()`.

## 4. Put the state in the hook

`blocks/admin/useLibrary.js` owns the dashboard's data: add the action there
(`saveThing`, `deleteThing`) so components stay presentational, and let
`applyResponse()` fold the response's `settings` / `assets` / `folders` back into
state. Nothing else in the admin talks to `apiFetch`.

## 5. Build the UI

- Reuse `blocks/shared/ui.js` (Button, Card, Field, Modal, Tabs, Pagination,
  TagField, …) before adding anything. If a control is genuinely new, add it
  there with a docblock saying what it is for, and keep it presentational.
- Render inside the app root: the admin page's mount node carries `titlesparks-app`, and
  the sidebar wraps its panel in one. Classes outside that root are generated but
  never applied — see [house rule 1](architecture.md#house-rules).
- Use only the utilities the missing base layer supports (no `ring`, `translate`,
  `blur`, gradient stops).
- Write class names as complete literals.
- Every string goes through `__()` / `_n()` / `sprintf()`.
- Any control that is only an icon needs an accessible name (`IconButton` takes
  `label` and renders both `aria-label` and `title`).

## 6. Test it

- **Pure logic** → a unit test in `blocks/shared/__tests__/`. This is where the
  edge cases live (caps, duplicates, empty input, clamping).
- **A component with rules** → render it with `createRoot` + `act` in
  `blocks/admin/__tests__/` and assert what an author would see. Mock the
  `@titlesparks/shared/*` aliases exactly as the neighbouring test files do; jest
  has no webpack alias.
- **A PHP sanitizer** → there is no PHP test runner in this repo. Exercise it
  through a throwaway script against a real install
  ([how](testing-and-tooling.md#checking-against-a-real-install)), and leave the
  behaviour pinned by the JS mirror's test.

## 7. Document it

- A new stored key → [`data-model.md`](data-model.md).
- A new route → [`rest-api.md`](rest-api.md) (and [`assets-and-folders.md`](assets-and-folders.md) if it changes library behavior).
- A new action or filter → [`hooks-and-filters.md`](hooks-and-filters.md).
- A change to capabilities or stored data → [`security-and-privacy.md`](security-and-privacy.md) and [`data-model.md`](data-model.md).
- A new user workflow → [`user-guide.md`](user-guide.md) or [`settings-reference.md`](settings-reference.md).
- Add any new page to the [documentation index](README.md).
- A new invariant (something a future change could break) → the
  [house rules](architecture.md#house-rules), with the test that guards it.

## 8. Verify before you call it done

```bash
npm run build        # must exit 0
npm run test:unit    # must exit 0
npm run lint:js      # compare against the baseline, do not add new errors
```

Then check the actual behaviour in a browser — a build that compiles is not a
feature that works. The procedure, including the two traps that only show up
against a real WordPress install, is in
[`testing-and-tooling.md`](testing-and-tooling.md#checking-against-a-real-install).

## Checklist

- [ ] Stored shape added to defaults **and** `Security::settings()`
- [ ] Sanitizer returns the full shape, drops what is unusable, caps what is not
- [ ] JS mirror written, and a test pins it to the PHP behaviour
- [ ] Route has a permission callback and returns the whole new state
- [ ] State lives in `useLibrary`, components stay presentational
- [ ] UI renders inside `titlesparks-app`, utilities written as `titlesparks:…`, literal class names
- [ ] Strings translated
- [ ] Tests: pure logic + component behaviour
- [ ] Docs updated, including any new invariant and its guard
- [ ] `build`, `test:unit`, `lint:js` and a live check all done
