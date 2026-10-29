## Summary

<!-- What does this change do and why? Title format: type(scope): summary -->

Closes #

Feature IDs: <!-- e.g. PLN-3 -->

## How it was tested

<!-- Tests added, and what you checked in a real vault. Add a screenshot or GIF for UI changes. -->

## Definition of Done

- [ ] `make check` passes locally
- [ ] Tests cover each acceptance criterion; a bug fix has a test that failed first
- [ ] Checked in a real vault on desktop; on mobile or mobile emulation for UI or editing changes
- [ ] Writes go through `NoteRepository.process` and keep unparsed content intact
- [ ] Settings change bumps `SETTINGS_VERSION` with a tested migration (or no settings change)
- [ ] Keyboard path, labels, and theme variables for new UI (light and dark checked)
- [ ] README, `docs/features.md` and an ADR updated where needed
