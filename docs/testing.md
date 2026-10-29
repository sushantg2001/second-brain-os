# Testing strategy

Most behaviour lives in pure code, so most tests are fast unit tests. The layers in [architecture.md](architecture.md) exist partly to make that true.

## Levels

| Level             | Location                                        | Runs against                                                                                   | What it proves                                                                                         | Share                         |
| ----------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------- |
| Unit              | `tests/unit/<area>/`                            | Pure `domain/`, `application/` and `shared/kernel` code with fakes for ports                   | Rules, parsing, date maths, edits, rollups, lint rules, migrations                                     | ~70%                          |
| Property          | Inside unit files, using `fast-check`           | Same                                                                                           | Invariants over many generated inputs                                                                  | part of unit                  |
| Component         | `tests/component/`                              | React components in happy-dom with Testing Library                                             | Rendering, interaction, accessibility roles, error boundaries                                          | ~20%                          |
| Integration       | `tests/integration/`                            | A feature's `register` with `FakeObsidianApp` and the fixture vault in `tests/fixtures/vault/` | Commands, views and adapters wired together; reads and writes against real Markdown                    | ~10%                          |
| Bundle smoke      | `scripts/check-bundle.ts` (`make check-bundle`) | The production `dist/main.js` in a VM                                                          | It loads as CommonJS, only requires what Obsidian provides, exports a Plugin, and fits the size budget | every build                   |
| Manual acceptance | Real vault, desktop and mobile                  | Obsidian                                                                                       | Feel, drag and drop, themes, plugin interplay                                                          | each PR with UI, each release |

Tests that run on Bun (`bun test`) share `tests/setup.ts`, which registers happy-dom, the jest-dom matchers and the `obsidian` module mock (`tests/mocks/obsidian.ts`).

## What to test where

- **Domain functions get unit tests, always.** Examples: `parseTimeBlock`, `moveTimeBlock`, `periodPath`, `nextPeriod`, `rollupProject`, each lint rule, each settings migration.
- **Property tests** for anything with dates or round trips:
    - `format(parse(line)) === line` for task lines with time blocks and clock entries.
    - Moving a block never changes the task text outside the time range.
    - For every date and week-start setting, `periodOf(date)` contains `date`, and `next(prev(p)) === p`.
    - Rollup totals equal the sum of their children.
- **Edits are pure functions** `(text) => text`, tested on strings. Integration tests then check one round trip through `NoteStore.process` against the in-memory vault.
- **Components** are queried by role and label, never by class name. Each view gets one test that it renders inside `ErrorBoundary` and recovers.
- **Adapters** (vault, Tasks, Templater) get contract tests: the same suite runs against the fake and, where it can, against a recorded response from the real plugin's API shape, so a fake can't drift from reality.
- **Regression:** every bug fix adds a test that fails before the fix.

## Fixtures

- Tests build small vaults inline with `createTestApp({ files })` (`tests/fakes/fake-obsidian-app.ts`), so each test shows the exact notes it uses. `tests/mocks/obsidian.ts` is an in-memory Obsidian: a vault that fires events, a metadata cache, a workspace, plugins, modals and settings controls.
- `tests/fakes/` has harnesses (`loadPlugin`, `createPeriodicHarness`, `FixedClock`) and fakes. Fakes are preferred over mocks. Use `mock.module` only for `obsidian`.

## Coverage

Bun reports line and function coverage. The threshold in `bunfig.toml` applies to every file in `src/`, and `scripts/` is excluded.

| Scope                         | Lines target |
| ----------------------------- | ------------ |
| `domain/` and `shared/kernel` | 95%          |
| `application/`                | 90%          |
| `ui/` and `infrastructure/`   | 80%          |

The thresholds in `bunfig.toml` are 90% of lines and 85% of functions in every file (the whole suite is at about 99% and 98%). They only go up. Lowering one needs an ADR.

## Manual acceptance checklist (release)

Use a clean vault with Tasks and Templater at their minimum versions, then again at their latest versions.

1. Fresh install: the setup view lists missing plugins. Enabling them unlocks features without a reload.
2. Periodic: create and open each period. Templates render. Week 53 and the year boundary work.
3. Calendar: dots, week numbers, jump to date, keyboard navigation.
4. Planner: drag, resize and create blocks; the note text matches; undo with Ctrl/Cmd-Z works on the note.
5. Clocks: start, stop, switch tasks, restart Obsidian while running.
6. PPV: create a pillar, goal and project, then check the dashboard and rollups.
7. Lint: findings for the broken fixture notes; quick fix preview.
8. Mobile: steps 2 to 5 on iOS or Android, or with `app.emulateMobile(true)`.
9. Light and dark theme, plus one community theme.

## Commands

```bash
make test            # every suite
make test-unit       # unit and property tests
make test-component  # component tests
make coverage        # with thresholds, writes coverage/lcov.info
make check-bundle    # production build and smoke test
make check           # everything CI runs
```
