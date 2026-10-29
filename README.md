# Second Brain OS

[![CI](https://github.com/sushantg2001/second-brain-os/actions/workflows/ci.yml/badge.svg)](https://github.com/sushantg2001/second-brain-os/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

One Obsidian plugin for a whole personal knowledge system:

- **Day planner**: a timeline of time-blocked tasks with the month calendar above it, drag to plan your day, and clocks to track time in Day Planner's yaml format.
- **Calendar and periodic notes**: daily, weekly, monthly, quarterly and yearly notes, with a month calendar to move between them.
- **Pillars, Pipelines & Vaults (PPV)**: pillars, goals and projects as linked notes, with progress rollups, reviews and a lint that keeps the structure healthy.

Everything is plain Markdown, so your notes stay readable without the plugin. Clocks, reviews and a vault check tie the three together: time you track rolls up into projects and pillars, and periodic reviews summarise it.

The [user guide](docs/user-guide.md) shows every note format, command and setting.

> **Status:** 2.0 is feature-complete and waiting for its first release. See the [changelog](CHANGELOG.md). Version 1.x was "Calendar & Periodic Notes"; settings can be imported.

## Requirements

Obsidian 1.7.2 or later, plus these community plugins, which the plugin checks for on start:

| Plugin           | Why                                  |
| ---------------- | ------------------------------------ |
| Datacore 0.1.0+  | Queries over notes, tasks and fields |
| Tasks 7.0.0+     | Task syntax and statuses             |
| Templater 2.0.0+ | Note templates                       |

## Documentation

| Document                                                             | Contents                                                  |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| [User guide](docs/user-guide.md)                                     | Note formats, commands and settings                       |
| [Changelog](CHANGELOG.md)                                            | What changed in each release                              |
| [Architecture](docs/architecture.md)                                 | Layers, domain model, ports and adapters, key decisions   |
| [Features](docs/features.md)                                         | Full feature list with IDs, priorities and the roadmap    |
| [Definition of Ready and Done](docs/definition-of-ready-and-done.md) | When work can start and when it is finished               |
| [Testing strategy](docs/testing.md)                                  | Test levels, fixtures, coverage and the release checklist |
| [Development lifecycle](docs/sdlc.md)                                | Branching, CI workflows, releases                         |

## Development

Requires [Bun](https://bun.sh) (version in `.bun-version`) and `make`.

```bash
make install                 # dependencies
make dev                     # watch build into dist/
make link VAULT=~/DevVault   # load dist/ in a vault
make check                   # every CI gate
make help                    # all targets
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## Credits

Builds on ideas from [Day Planner](https://github.com/ivan-lednev/obsidian-day-planner) by Ivan Lednev, [Calendar](https://github.com/liamcain/obsidian-calendar-plugin) and [Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes) by Liam Cain, [LifeOS](https://github.com/quanru/obsidian-lifeos) by quanru, and August Bradley's Pillars, Pipelines & Vaults method.

## License

MIT
