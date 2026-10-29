# Contributing

Thanks for helping with Second Brain OS. The full process is in [docs/sdlc.md](docs/sdlc.md). This page is the short version.

## Setup

You need [Bun](https://bun.sh) (the version in `.bun-version`), `make` and an Obsidian vault with Dataview, Tasks and Templater installed.

```bash
git clone https://github.com/sushantg2001/second-brain-os.git
cd second-brain-os
make install
make dev                     # watch build into dist/
make link VAULT=/path/to/vault
```

Install the Hot Reload community plugin in that vault to pick up rebuilds automatically.

## Before you start

Pick an issue labelled `ready`, or open one with the templates. The [Definition of Ready](docs/definition-of-ready-and-done.md#definition-of-ready) lists what an issue needs before work starts.

## Making a change

1. Branch off `main`: `<type>/<feature-id>-<slug>`, for example `feat/pln-3-drag-blocks`.
2. Follow the layers in [docs/architecture.md](docs/architecture.md). Lint fails on imports that cross them the wrong way.
3. Add tests at the levels in [docs/testing.md](docs/testing.md). A bug fix starts with a failing test.
4. Run `make check`. It runs the same gates as CI.
5. Open a pull request with a Conventional Commits title (`feat(planner): …`) and complete the checklist, which is the [Definition of Done](docs/definition-of-ready-and-done.md#definition-of-done).

## Code style

- TypeScript strict mode. Prettier formats (`make format`). ESLint has zero tolerance for warnings.
- Domain code is pure: no `obsidian`, no React. Side effects go through ports.
- Sentence case for UI text. Obsidian CSS variables only. Class names start with `sbos-`.
- Comments explain why, not what.

## Reporting bugs

Use the bug template, and include your Obsidian, plugin, Dataview, Tasks and Templater versions and your platform.
