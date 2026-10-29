# Feature list

Each feature has an ID used in issues, branches and PR titles (`feat(planner): …`). Priority: **M** = must have for 2.0, **S** = should have, **C** = could have. Phase is the delivery order in [the roadmap](#roadmap).

## Setup (`setup`), phase 0, done

| ID    | Feature                                                                                                           | Pri |
| ----- | ----------------------------------------------------------------------------------------------------------------- | --- |
| SET-1 | Check that Tasks and Templater are installed, enabled and at the minimum version (Dataview is optional, ADR 0002) | M   |
| SET-2 | "Required plugins" view with the state of each one and a recheck button; opens on load when something is missing  | M   |
| SET-3 | Features register only after the check passes, without needing a reload                                           | M   |
| SET-4 | Settings schema with versioned migrations; unreadable settings are never overwritten                              | M   |

## Periodic notes (`periodic`), phase 1, done

| ID    | Feature                                                                                                         | Pri |
| ----- | --------------------------------------------------------------------------------------------------------------- | --- |
| PER-1 | Daily, weekly, monthly, quarterly and yearly notes, each with its own on/off, format, folder and template       | M   |
| PER-2 | Commands per period: open current, create without opening, previous and next, jump to the closest existing note | M   |
| PER-3 | Templates rendered through Templater, with `{{title}}`, `{{date[:fmt]}}` and `{{time[:fmt]}}` as a fallback     | M   |
| PER-4 | Public API compatible with Periodic Notes (`getPeriodicNote`, `createPeriodicNote`, `getGranularities`)         | M   |
| PER-5 | Import settings from an installed Periodic Notes or Calendar plugin                                             | S   |
| PER-6 | Review templates per period (weekly, monthly, quarterly, yearly) that embed rollups and lint findings           | S   |

## Calendar (`calendar`), phase 1, done

| ID    | Feature                                                                                    | Pri |
| ----- | ------------------------------------------------------------------------------------------ | --- |
| CAL-1 | Month calendar in the sidebar with a dot on days that have a note, and today highlighted   | M   |
| CAL-2 | Click to open or create; Ctrl/Cmd-click to open in a split; optional confirm before create | M   |
| CAL-3 | Week number column that opens the weekly note; month and year titles open their notes      | M   |
| CAL-4 | Jump-to-date picker (type a year, pick a month)                                            | M   |
| CAL-5 | Reveal the active note's date in the calendar                                              | S   |
| CAL-6 | Per-day badges: time planned and time clocked                                              | S   |
| CAL-7 | Keyboard navigation of the grid                                                            | M   |

## Planner (`planner`), phase 2, done (PLN-9 and PLN-10 later)

| ID     | Feature                                                                                                                                                          | Pri |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| PLN-1  | Timeline view of a day built from time-blocked tasks (`- [ ] 09:00 - 10:30 Write spec`) in the daily note and tasks scheduled for that day anywhere in the vault | M   |
| PLN-2  | Current-time line and auto-scroll to now                                                                                                                         | M   |
| PLN-3  | Drag to move, resize or create blocks; each change rewrites the task line atomically                                                                             | M   |
| PLN-4  | Keyboard and command equivalents for every drag action                                                                                                           | M   |
| PLN-5  | Unscheduled tasks list for the day; drag onto the timeline to schedule                                                                                           | M   |
| PLN-6  | Multi-day view (3, 5 or 7 days)                                                                                                                                  | S   |
| PLN-7  | Status bar: current block, time left, next block                                                                                                                 | S   |
| PLN-8  | Notification when a block starts or ends                                                                                                                         | S   |
| PLN-9  | Read-only remote calendars (ICS URLs) shown as blocks                                                                                                            | C   |
| PLN-10 | Rollover of unfinished blocks to the next daily note                                                                                                             | S   |

## Clocks (`clocks`), phase 3, done

| ID    | Feature                                                                     | Pri |
| ----- | --------------------------------------------------------------------------- | --- |
| CLK-1 | Start and stop a clock on a task; writes a `[clock::start--end]` child item | M   |
| CLK-2 | At most one running clock; starting another stops the first                 | M   |
| CLK-3 | Running clock in the status bar and on the timeline                         | M   |
| CLK-4 | Recover a clock that was left running after a restart                       | M   |
| CLK-5 | Planned versus clocked comparison per day and per project                   | S   |

## PPV (`ppv`), phase 4, done

| ID    | Feature                                                                                                  | Pri |
| ----- | -------------------------------------------------------------------------------------------------------- | --- |
| PPV-1 | Note types `pillar`, `goal`, `project` and `resource` defined by front matter, with configurable folders | M   |
| PPV-2 | "New pillar, goal or project" commands with templates and a parent picker                                | M   |
| PPV-3 | Project status workflow (`backlog`, `active`, `paused`, `done`, `dropped`) with commands and archiving   | M   |
| PPV-4 | Dashboard view: pillars, then goals, then active projects, with next actions                             | M   |
| PPV-5 | Capture to inbox (quick task or note into today's note or an inbox note)                                 | M   |
| PPV-6 | Task stage cycle (todo, doing, waiting, done) mapped onto Tasks statuses                                 | S   |
| PPV-7 | `sbos` code block that renders a filtered list or board of projects or tasks inside any note             | S   |
| PPV-8 | First-run wizard that creates folders, templates and an example pillar without overwriting anything      | S   |

## Rollups (`rollups`), phase 5

| ID    | Feature                                                                           | Pri |
| ----- | --------------------------------------------------------------------------------- | --- |
| ROL-1 | Per project: tasks done and total, percentage, clocked time, last activity        | M   |
| ROL-2 | Per goal and pillar: aggregated across child projects                             | M   |
| ROL-3 | Per period: tasks completed, time clocked by pillar, projects moved (for reviews) | M   |
| ROL-4 | Optional write-back of `progress` into front matter, off by default               | C   |

## Lint (`lint`), phase 6

| ID    | Feature                                                                                                                                                                          | Pri |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| LNT-1 | Rules: orphan project or goal, broken parent link, active project with no next action, overdue project, malformed time block, overlapping blocks, open clock older than 12 hours | M   |
| LNT-2 | Findings view grouped by rule, with click-to-open                                                                                                                                | M   |
| LNT-3 | Quick fixes where safe (close clock, set parent), always previewed first                                                                                                         | S   |
| LNT-4 | Per-rule on, off and severity settings                                                                                                                                           | S   |

## Platform (`app`), all phases

| ID    | Feature                                                      | Pri |
| ----- | ------------------------------------------------------------ | --- |
| PLT-1 | Works on desktop and mobile; touch drag on the timeline      | M   |
| PLT-2 | One settings tab with a section per feature                  | M   |
| PLT-3 | Public `api` object with a semver promise                    | M   |
| PLT-4 | Load in under 50 ms of plugin work; index after layout ready | M   |
| PLT-5 | Translations through a message catalogue (English first)     | C   |

## Roadmap

| Phase | Scope                                                                         | Release       | Status                       |
| ----- | ----------------------------------------------------------------------------- | ------------- | ---------------------------- |
| 0     | Skeleton: React and Bun build, layers, settings, setup gate, CI               | —             | done                         |
| 1     | Periodic and calendar, ported from 1.x with parity tests                      | 2.0.0-alpha.1 | done (PER-5 and PER-6 later) |
| 2     | Planner timeline (PLN-1 to PLN-8)                                             | alpha.2       | done                         |
| 3     | Clocks                                                                        | alpha.3       | done                         |
| 4     | PPV model, commands, dashboard and capture                                    | beta.1        | done                         |
| 5     | Rollups and review templates                                                  | beta.2        | planned                      |
| 6     | Lint                                                                          | rc.1          | planned                      |
| 7     | S items, performance and accessibility pass, docs, community store submission | 2.0.0         | planned                      |
