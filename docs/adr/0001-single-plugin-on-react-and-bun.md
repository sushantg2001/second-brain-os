# 1. One plugin, layered slices, React and Bun

Status: accepted, 2026-10-29

## Context

Version 1.x combined Calendar and Periodic Notes. Version 2.0 adds a day planner (after Day Planner) and the Pillars, Pipelines & Vaults system (after LifeOS). Running them as separate plugins means three task parsers, three settings tabs, and no shared model: a scheduled block could not roll up into a project.

## Decision

- Ship one plugin, `second-brain-os`, with one domain model shared by every feature.
- Organise code as feature slices with `domain`, `application` and `ui` layers, plus ports implemented in `infrastructure`. ESLint enforces the dependency rules.
- Depend on Dataview (index), Tasks (task syntax and statuses) and Templater (templates) instead of rebuilding them. A setup gate blocks features until they are present.
- Use React 19 for views, and Bun for install, build and tests. `make` is the single entry point for local work and CI.

## Consequences

- Users must install three community plugins first. The setup view explains which ones and why.
- The plugin id changes from `calendar-periodic-notes` to `second-brain-os`, so 1.x users install it as a new plugin. A settings import (PER-5) eases the move.
- React adds about 200 KB to the bundle. The 400 KB budget in `check-bundle` keeps growth visible.
- Pure domain code makes most behaviour unit-testable without Obsidian.
