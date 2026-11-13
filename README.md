# Second Brain OS

[![Release](https://img.shields.io/github/v/release/sushantg2001/second-brain-os)](https://github.com/sushantg2001/second-brain-os/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A day planner, a calendar with daily to yearly notes, and the Pillars, Pipelines & Vaults (PPV) system, in one Obsidian plugin. Your notes stay plain Markdown, so they read fine without it.

- **Day planner**: a timeline of your day. Give a task a time and it becomes a block you can drag and resize. Sub tasks sit inside their block, tasks without a time wait in an Unscheduled list, and clocked time shows as named blocks beside your plan.
- **Calendar and periodic notes**: daily, weekly, monthly, quarterly and yearly notes, each with its own folder, name format and template, and a calendar with Day, Week, Month, Quarter and Year tabs to move between them.
- **Pillars, Pipelines & Vaults**: pillars, goals and projects as linked notes, a dashboard with progress and clocked time, quick capture, reviews that summarise a period, and a vault check that finds broken links between them.

Time you track rolls up into projects and pillars, and your periodic reviews summarise it.

## Requirements

Obsidian 1.7.2 or later, and these community plugins. Second Brain OS checks for them on start and shows a "Required plugins" screen until all three are enabled.

| Plugin           | Why                                                          |
| ---------------- | ------------------------------------------------------------ |
| Datacore 0.1.0+  | Lets you query the notes, tasks and clocks the plugin writes |
| Tasks 7.0.0+     | Task statuses and toggling, including recurring tasks        |
| Templater 2.0.0+ | Renders note templates                                       |

## Installation

Second Brain OS is installed from its [GitHub releases](https://github.com/sushantg2001/second-brain-os/releases).

**With BRAT**: install [BRAT](https://github.com/TfTHacker/obsidian42-brat), open its settings, choose **Add beta plugin** and enter `sushantg2001/second-brain-os`. BRAT keeps it up to date.

**By hand**: download `main.js`, `manifest.json` and `styles.css` from the latest release into `<your vault>/.obsidian/plugins/second-brain-os/`, then reload Obsidian and enable **Second Brain OS** under Settings → Community plugins.

## Getting started

1. Enable Datacore, Tasks, Templater and Second Brain OS.
2. Optional: under Settings → Second Brain OS → Calendar, choose **Import settings** to copy formats, folders and templates from Periodic Notes or Calendar.
3. Run **Second Brain OS: Set up PPV folders** to create the PPV folders and an example pillar. It never overwrites anything.
4. Run **Second Brain OS: Create review templates** to add weekly to yearly review templates.
5. Run **Second Brain OS: Open day planner** to open the timeline in the right sidebar.

Every command below is in the command palette under "Second Brain OS:".

## Periodic notes and the calendar

Daily, weekly, monthly, quarterly and yearly notes each have their own switch, name format ([moment.js](https://momentjs.com/docs/#/displaying/format/)), folder and template. A format can contain `/` to nest folders, such as `YYYY/MM/YYYY-MM-DD`. Templates can use Templater and the placeholders `{{title}}`, `{{date}}`, `{{date:FORMAT}}`, `{{time}}` and `{{time:FORMAT}}`.

**Open calendar** puts the calendar in the right sidebar. A dot under a day marks a note, and another marks planned or clocked time; hover a day to see how much. Click a day to open its note, or Ctrl/Cmd-click to open it in a split. Arrow keys move between days, Page Up and Page Down change month, and Enter opens the day. The tabs switch between day, week, month, quarter and year notes, and a tab for notes you have turned off offers to turn them on.

## Day planner

A task with a time at the start of its text is a **time block**. Hours and minutes can be separated by `:` or `.`, and 12-hour times work:

```markdown
- [ ] 09:00 - 10:30 Write the spec
- [ ] 14:00 Gym
- [ ] 1:00pm - 2:15pm Lunch
```

A block with only a start time uses the default duration. The timeline shows blocks from the day's daily note, plus tasks anywhere with a scheduled date of that day (`⏳ 2026-10-29` or `[scheduled:: 2026-10-29]`). Open tasks without a time are listed under **Unscheduled**, and the tasks nested under a block are listed inside it.

| To                   | Do this                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| Move a block         | Drag it, or focus it and press Up or Down                              |
| Resize a block       | Drag its bottom edge, or press Shift+Up or Shift+Down                  |
| Remove its time      | Focus it and press Delete                                              |
| Create a block       | Drag on empty time and name it, or run **Add time block to today**     |
| Schedule a task      | Drag it from Unscheduled onto the timeline, or use its calendar button |
| Complete a task      | Tick its checkbox                                                      |
| Open the task's note | Click the block                                                        |

New blocks go under the **Day planner** heading of the daily note, which is created if needed. Each change rewrites only that task's line, and if the note changed in the meantime nothing is written and you are asked to try again.

**Open multi-day planner** shows 2 to 7 days in a tab. **Carry unfinished tasks over to today** moves open tasks, with their nested lines, from the last daily note to today's and drops their old times. The status bar shows the current block and the time left in it.

## Time tracking

A clock is an inline field on a line under the task. A clock without an end is still running.

```markdown
- [ ] Write the spec
      [clock::2026-10-29T09:05:00--2026-10-29T09:50:00]
      [clock::2026-10-29T14:00:00--]
```

Start and stop clocks with **Start or stop clock on the current task**, or with the play and stop buttons on a block. Starting a clock stops any other. Clocked time shows as named blocks beside the planned ones, with the clocked blocks of a task's sub tasks next to it, and a clock that runs past midnight counts on both days. When Obsidian starts it reminds you about clocks left running.

## Pillars, pipelines and vaults

Pillars, goals and projects are notes with front matter:

```markdown
---
type: project # pillar | goal | project | resource
status: active # backlog | active | paused | done | dropped (projects)
goal: "[[Run a marathon]]" # or pillar: "[[Health]]"
start: 2026-10-01
due: 2026-12-01
---
```

Goals link to a pillar with `pillar:`. Projects link to a goal with `goal:`, or straight to a pillar. A task belongs to a project if it is in the project's note or links to it, as in `- [ ] Stretch [[Training plan]]`. Because it is all front matter and inline fields, you can also query it with Datacore.

- **Open PPV dashboard** lists pillars, goals and projects with progress, clocked time and the next action.
- **New pillar**, **goal**, **project** and **resource** create a note in its folder, linked to a parent you pick.
- **Set project status** changes a project's status. Finished projects can move to an archive folder, and links follow.
- **Capture to inbox** adds a task or note to today's note or an inbox note.
- **Cycle task stage** moves the task at the cursor from to do, to in progress, to waiting.
- **Write progress to project notes** writes `progress: 67` (percent of tasks closed) into each project's front matter.

Put a list of projects or tasks in any note with an `sbos` code block:

````markdown
```sbos
view: tasks # projects (default) or tasks
status: active, paused # or all
pillar: Health # or goal: …
limit: 10
```
````

## Reviews

Put a review in a daily, weekly, monthly, quarterly or yearly note with an empty `sbos-review` code block, or run **Insert review into this periodic note**:

````markdown
```sbos-review

```
````

It shows the tasks completed in the period (from their `✅` dates), time clocked per pillar, projects started and finished, and open vault check findings.

## Vault check

**Check vault structure** lists problems grouped by rule, and clicking one opens the note at the right line. It finds goals and projects with no parent, parent links that do not resolve or point at the wrong kind of note, active projects with no next action, open projects past their due date, time blocks that end before they start, overlapping time blocks, and clocks running for more than 12 hours. Some findings offer a quick fix that shows the exact change before it applies.

## Settings

Under Settings → Second Brain OS: calendar options (start of the week, week numbers, confirmation before creating notes), each periodic note's format, folder and template, the day planner (day start and end, snapping, default duration, hour height, days in the multi-day view, the heading for new blocks, month calendar or week strip, the status bar and start notifications), PPV folders and templates, archiving and capture, and each vault check rule's switch and severity.

## Commands

| Command                                                              | What it does                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------- |
| Open today's daily note (and the week's, month's, quarter's, year's) | Opens it, creating it from the template if needed           |
| Create today's daily note (and the others)                           | Creates it without opening it                               |
| Jump forwards / backwards to closest daily note (and the others)     | Opens the nearest existing note after or before this one    |
| Open calendar, Jump to date, Reveal active note in calendar          | Calendar navigation                                         |
| Open day planner, Open multi-day planner                             | Opens the timeline in the sidebar, or several days in a tab |
| Add time block to today, Carry unfinished tasks over to today        | Planning                                                    |
| Start or stop clock on the current task, Stop clock                  | Time tracking                                               |
| Open task with running clock                                         | Jumps to the task you are clocking                          |
| Open PPV dashboard, New pillar / goal / project / resource           | PPV overview and new notes                                  |
| Set project status, Cycle task stage, Capture to inbox               | Working on projects and tasks                               |
| Set up PPV folders, Write progress to project notes                  | PPV set up and upkeep                                       |
| Insert review into this periodic note, Create review templates       | Reviews                                                     |
| Check vault structure                                                | Opens the vault check                                       |
| Show required plugins                                                | Opens the "Required plugins" screen                         |

## Help

Found a bug or have an idea? [Open an issue](https://github.com/sushantg2001/second-brain-os/issues/new/choose) with your plugin version and platform. See the [changelog](CHANGELOG.md) for what changed in each release.

## Credits

Builds on ideas from [Day Planner](https://github.com/ivan-lednev/obsidian-day-planner) by Ivan Lednev, [Calendar](https://github.com/liamcain/obsidian-calendar-plugin) and [Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes) by Liam Cain, [LifeOS](https://github.com/quanru/obsidian-lifeos) by quanru, and August Bradley's Pillars, Pipelines & Vaults method.

## License

MIT
