# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [semver](https://semver.org) for note formats, settings and the public API.

## [Unreleased] — 2.0.0

Second Brain OS replaces Calendar & Periodic Notes 1.x. It is a new plugin id (`second-brain-os`): install it alongside 1.x, use **Import** in settings, then disable 1.x.

### Added

- Day planner: a timeline of time-blocked tasks with drag, resize and create; keyboard equivalents; an unscheduled list; a multi-day view; a status bar; start notifications; carrying unfinished tasks over to today.
- Time tracking: clock entries under tasks, one running clock at a time, status bar, reminder about clocks left running, clocked time on the timeline and calendar.
- Pillars, pipelines and vaults: pillar, goal, project and resource notes; dashboard; new-note dialogs with parent links; project status workflow with archiving; capture to inbox; task stage cycling; `sbos` code block.
- Rollups and reviews: progress and clocked time per project, goal and pillar; period reviews in `sbos-review` blocks; review templates; optional `progress` in front matter.
- Vault check: nine rules with previewed quick fixes and per-rule settings.
- Settings import from Periodic Notes, Calendar and 1.x.
- Calendar badges for planned and clocked time, and full keyboard navigation.

### Changed

- Rebuilt on React and Bun with a layered architecture (see `docs/architecture.md`).
- Requires the Datacore, Tasks and Templater plugins. Dataview is not needed.
- Clocks use Day Planner 0.29's yaml block under the task. Older `[clock::]` items are still read; a command converts them.
- The month calendar sits above the day planner's timeline, on the same day.
- Time blocks accept `.` between hours and minutes.
- Settings are versioned and migrated. Unreadable settings are never overwritten.

### Fixed

- A task title starting with "am" or "pm" after a time is no longer read as part of the time.

## [1.0.0]

- Calendar view with periodic notes (daily to yearly), jump-to-date picker, and the Periodic Notes API.
