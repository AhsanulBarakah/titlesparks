# TitleSparks

Attach customizable animated GIFs, icons and images to post titles, and let each
one expire through a three-stage timeline.

- **Settings** — the master switch, the post types it runs on, and the defaults a
  new post starts from.
- **Asset Library** — a global library with tags and folders, search and type
  filters, and a paged grid.
- **Guide** — the rules the editor sidebar deliberately keeps out of the way.
- **Post editor** — a sidebar for the three stages, with a live preview beside
  the real title.

## Requirements

WordPress 6.6+, PHP 7.4+, and a build step (Node 20+) if you are working from
source.

## Development

```bash
npm install
npm run build        # or npm start for watch mode
npm run test:unit
```

`build-admin`, `build-block` and `build-frontend` are committed so the plugin can
be installed by uploading a zip; rebuild before shipping a change.

## Documentation

The complete documentation set lives in [`doc/`](README.md), including end-user instructions, settings and data references, REST API details, architecture, development, testing, troubleshooting, and release notes.

Start with the [documentation index](README.md) and choose the guide for your task.

## License

GPL-2.0-or-later.
