# Second Brain OS

[![CI](https://github.com/sushantg2001/second-brain-os/actions/workflows/ci.yml/badge.svg)](https://github.com/sushantg2001/second-brain-os/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

One Obsidian plugin for a whole personal knowledge system:

- **Day planner**: a timeline of time-blocked tasks, drag to plan your day, and clocks to track time.
- **Calendar and periodic notes**: daily, weekly, monthly, quarterly and yearly notes, with a month calendar to move between them.
- **Pillars, Pipelines & Vaults (PPV)**: pillars, goals and projects as linked notes, with progress rollups, reviews and a lint that keeps the structure healthy.

Everything is plain Markdown, so your notes stay readable without the plugin.

> **Status:** 2.0 is in development. Periodic notes, the calendar, the day planner, time tracking and the PPV dashboard with rollups and period reviews work; lint is next. See the [roadmap](docs/features.md#roadmap). Version 1.x was "Calendar & Periodic Notes".

## Requirements

Obsidian 1.7.2 or later, plus these community plugins, which the plugin checks for on start:

| Plugin           | Why                      |
| ---------------- | ------------------------ |
| Tasks 7.0.0+     | Task syntax and statuses |
| Templater 2.0.0+ | Note templates           |

## Documentation

| Document                                                             | Contents                                                  |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
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
