# Calendar & Periodic Notes

[![CI](https://github.com/sushantg2001/calendar-periodic-notes/actions/workflows/ci.yml/badge.svg)](https://github.com/sushantg2001/calendar-periodic-notes/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An Obsidian plugin that combines a calendar view with periodic notes (daily, weekly, monthly, quarterly, and yearly) in a single plugin.

## Features

### Periodic notes

- Daily, weekly, monthly, quarterly, and yearly notes, each with its own filename format, folder, and template.
- Commands per enabled granularity:
  - **Open today's daily note** (and the equivalent for week/month/quarter/year)
  - **Create today's daily note** — creates the note without opening it
  - **Jump forwards/backwards to closest note** — navigate between existing notes relative to the active one
- Template placeholders: `{{title}}`, `{{date}}`, `{{date:FORMAT}}`, `{{time}}`, `{{time:FORMAT}}`.

### Calendar

- Month calendar in the right sidebar showing a dot on days that have a daily note.
- Click a day to open (or create) its daily note. Ctrl/Cmd-click opens it in a new split.
- Optional week number column; click a week number to open the weekly note.
- Click the month title (or run **Jump to date**) to open a two-step picker — type a year, pick a month — and jump anywhere instantly.
- **Reveal active note in calendar** command.
- Optional confirmation dialog before creating new notes.

## Settings

| Setting | Description |
| --- | --- |
| Start week on | First day of the calendar week (locale default or a fixed weekday) |
| Confirm before creating new note | Ask before creating a note from the calendar |
| Show week numbers | Adds the week number column |
| Per-granularity: Enabled / Format / Folder / Template | Configure each periodic note type. Formats use [moment.js syntax](https://momentjs.com/docs/#/displaying/format/) |

Default formats: `YYYY-MM-DD` (day), `gggg-[W]ww` (week), `YYYY-MM` (month), `YYYY-[Q]Q` (quarter), `YYYY` (year).

## API

Other plugins and userscripts can use the public API:

```js
const plugin = app.plugins.getPlugin("calendar-periodic-notes");

plugin.api.getGranularities(); // ["day", "week", ...] (enabled only)
await plugin.api.createPeriodicNote("day"); // create without opening
await plugin.api.createPeriodicNote("week", true, window.moment("2024-03-01")); // create and open
plugin.api.getPeriodicNote("day", window.moment()); // TFile | null
```

## Installation

Manual install: download `main.js`, `manifest.json`, and `styles.css` from the latest release into `<Vault>/.obsidian/plugins/calendar-periodic-notes/`, then enable the plugin in **Settings → Community plugins**.

## Development

```bash
bun install
bun run dev        # watch build
bun run build      # typecheck + production build
bun run test       # unit and component tests
bun run test:watch
bun run lint
```

Tests run with [Vitest](https://vitest.dev) against a mocked Obsidian API (`tests/mocks/obsidian.ts`). CI runs lint, tests, and the build on every push and pull request. Pushing a tag creates a draft GitHub release with the plugin artifacts; the release workflow can also be run manually from the **Actions** tab, supplying the tag to release.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, scripts, and the pull request process, and please follow the [Code of Conduct](CODE_OF_CONDUCT.md). Bug reports and feature requests go through the issue templates.

## Credits

Based on the ideas behind [obsidian-calendar-plugin](https://github.com/liamcain/obsidian-calendar-plugin) and [obsidian-periodic-notes](https://github.com/liamcain/obsidian-periodic-notes) by Liam Cain, including the jump-to-date picker ([calendar#411](https://github.com/liamcain/obsidian-calendar-plugin/pull/411)) and the create-note command and public API ([periodic-notes#182](https://github.com/liamcain/obsidian-periodic-notes/pull/182)).

## License

MIT
