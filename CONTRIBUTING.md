# Contributing

Thanks for your interest in improving Calendar & Periodic Notes. This guide covers everything you need to get set up and land a change.

## Prerequisites

- [Bun](https://bun.sh) (used for dependencies, scripts, and tests)
- An Obsidian vault for manual testing

## Getting started

```bash
git clone https://github.com/sushantg2001/calendar-periodic-notes.git
cd calendar-periodic-notes
bun install
```

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Watch build — rebuilds `main.js` on save |
| `bun run build` | Typecheck and produce a production `main.js` |
| `bun run test` | Run the unit and component suites once |
| `bun run test:watch` | Run tests in watch mode |
| `bun run lint` | Lint with ESLint and the Obsidian rules |

## Testing in a vault

Symlink the repo into a vault's plugin folder, then run the watch build:

```bash
ln -s "$(pwd)" /path/to/Vault/.obsidian/plugins/calendar-periodic-notes
bun run dev
```

Reload Obsidian (or use the community Hot Reload plugin) to pick up changes.

## Making a change

1. Fork the repository and create a branch off `main`.
2. Keep changes focused. Split unrelated work into separate pull requests.
3. Add or update tests for the behaviour you change. Tests live in `tests/` and run against a mocked Obsidian API (`tests/mocks/obsidian.ts`).
4. Before pushing, make sure the full check passes:

   ```bash
   bun run lint && bun run test && bun run build
   ```

5. Open a pull request against `main`. CI runs lint, tests, and the build on every pull request.

## Code style

- TypeScript in strict mode. Keep `main.ts` limited to lifecycle wiring and delegate features to modules.
- Match the surrounding style: tabs for indentation, sentence case for UI copy, no unnecessary comments.
- Prefer small, single-responsibility modules over large files.

## Commit messages

Use short, imperative subjects (for example, `Add quarterly note template support`). Group related changes into a single commit where it makes sense.

## Reporting bugs and requesting features

Open an issue using the templates. Include your Obsidian version, the plugin version, and steps to reproduce for bugs.
