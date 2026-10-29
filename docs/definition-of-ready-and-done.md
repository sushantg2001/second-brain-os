# Definition of Ready and Definition of Done

## Definition of Ready

An issue can be picked up when all of these are true. The feature request template asks for each one, and an issue that meets them gets the `ready` label.

1. **Linked to the feature list.** It names a feature ID from [features.md](features.md), or adds a new row to it.
2. **User outcome stated.** "As a … I want … so that …", or a bug's expected versus actual behaviour.
3. **Acceptance criteria** written as Given/When/Then, including at least one edge case (empty vault, missing note, mobile, other locale or week start).
4. **Note format agreed.** Any Markdown or front matter the change reads or writes is shown as an example. Formats are a public contract.
5. **Design known.** Which feature slice and layer it touches, any new port, and any settings field (with migration). If it changes [architecture.md](architecture.md), an ADR is drafted.
6. **Dependencies clear.** Blocked-by issues are closed, and any required Dataview, Tasks or Templater API has been checked.
7. **Small.** Fits in one pull request of roughly 400 changed lines or less, not counting tests and fixtures. Split it otherwise.
8. **Test approach named.** Which levels from [testing.md](testing.md) will cover it.

## Definition of Done

A pull request merges only when all of these are true. Items 1 to 4 are automated in CI (`make check`), and the rest are on the PR template checklist.

1. **Gates pass:** `make check`, which runs format check, ESLint with layer rules and zero warnings, strict typecheck, tests with coverage thresholds, production build, and the bundle size and load check.
2. **Tests added** at the levels the issue named. Every acceptance criterion maps to at least one test. A bug fix starts with a failing test.
3. **Coverage does not drop.** Thresholds in `bunfig.toml` only go up.
4. **Security checks pass:** dependency review and CodeQL report no new high-severity findings.
5. **Acceptance criteria demonstrated** in a real vault on desktop. For UI or editing changes, also on mobile, or with the mobile emulator (`app.emulateMobile(true)`). A screenshot or GIF goes in the PR.
6. **No data loss paths.** Writes go through `NoteRepository.process`, never overwrite unparsed user content, and are covered by a fixture test.
7. **Settings migrated.** A schema change bumps `SETTINGS_VERSION` and adds a migration with a test.
8. **Accessible.** Keyboard path for every new action, labels on icon buttons, and theme variables only (checked in light and dark).
9. **Docs updated:** README for user-facing behaviour and settings, `features.md` status, and an ADR if the architecture changed.
10. **Reviewed:** one approving review, all conversations resolved, and a Conventional Commits PR title.

A **release** is done when its tag passes the release workflow, the draft release has been smoke-tested by installing its artifacts into a clean vault, and it is published.
