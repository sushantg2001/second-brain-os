# User guide

Second Brain OS works on plain Markdown. This guide shows the note formats it reads and writes, then every command and setting. Command names below are as they appear in the command palette, after "Second Brain OS:".

## Getting started

1. Install and enable **Datacore**, **Tasks** and **Templater** from Community plugins. Until all three are ready, the plugin shows a "Required plugins" view instead of its features. Dataview is not needed.
2. Optional: in Settings → Second Brain OS → Calendar, choose **Import** to copy formats, folders and templates from Periodic Notes or Calendar.
3. Run **Set up PPV folders** to create the PPV folders and an example pillar. It never overwrites anything.
4. Run **Create review templates** to add weekly to yearly review templates.

## Periodic notes and calendar

Daily, weekly, monthly, quarterly and yearly notes each have their own on/off switch, file name format ([moment.js](https://momentjs.com/docs/#/displaying/format/)), folder and template. A format can contain `/` to nest folders, such as `YYYY/MM/YYYY-MM-DD`.

Templates can use Templater, and also these placeholders: `{{title}}`, `{{date}}`, `{{date:FORMAT}}`, `{{time}}`, `{{time:FORMAT}}`.

| Command                                                               | What it does                                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Open today's daily note (and this week's, month's, quarter's, year's) | Opens the note, creating it from the template if needed                      |
| Create today's daily note (and the others)                            | Creates the note without opening it                                          |
| Jump forwards / backwards to closest daily note (and the others)      | Opens the nearest existing note after or before the active one               |
| Open calendar                                                         | Opens the calendar on its own. It also sits above the day planner's timeline |
| Jump to date                                                          | Type a year, pick a month                                                    |
| Reveal active note in calendar                                        | Shows the month of the open periodic note                                    |

In the calendar:

- A dot marks days with a note. Badges show planned (`2h`) and clocked (`⏱1h`) time.
- Click a day to open it. Ctrl/Cmd-click opens it in a split.
- Arrow keys move between days, Home and End go to the start and end of the week, Page Up and Page Down change month (add Shift for a year), and Enter opens the day.
- Week numbers, when turned on, open weekly notes. The month and year in the title open monthly and yearly notes when those are enabled.

## Day planner

A task with a time at the start of its text is a **time block**. Hours and minutes can be separated by `:` or `.`:

```markdown
- [ ] 09:00 - 10:30 Write the spec
- [ ] 14:00 Gym (uses the default duration)
- [ ] 1:00pm - 2:15pm Lunch (12-hour times work too)
```

The day planner sits in the right sidebar with the month calendar above its timeline. Both always show the same day: pick a day in the calendar to see its plan (its daily note opens too), or move the timeline and the calendar follows. Click the date above the timeline, or a day header in the multi-day view, to open that day's note. **Hide calendar** collapses it; the choice is remembered.

The timeline shows blocks from the day's daily note, plus tasks anywhere with a scheduled date of today (`⏳ 2026-10-29` or `[scheduled:: 2026-10-29]`). Open tasks without a time are listed under **Unscheduled**.

| Action                       | Mouse or touch                   | Keyboard                                     |
| ---------------------------- | -------------------------------- | -------------------------------------------- |
| Move a block                 | Drag it                          | Focus the block, then Up or Down             |
| Resize a block               | Drag its bottom edge             | Shift+Up or Shift+Down                       |
| Remove the time              |                                  | Delete or Backspace                          |
| Create a block               | Drag on empty time, then name it | **Add time block to today**                  |
| Schedule an unscheduled task | Drag it onto the timeline        | Its calendar button picks the next free slot |
| Complete a task              | Its checkbox                     | Space on the checkbox                        |
| Open the task in its note    | Click the block                  | Enter                                        |

New blocks go under the **Day planner** heading of the daily note, which is created if needed. Every change rewrites only that task's line. If the note changed in the meantime, nothing is written and you are asked to try again.

Other commands: **Open day planner** (sidebar), **Open multi-day planner** (a tab with 2 to 7 days), and **Carry unfinished tasks over to today**. That command moves open tasks, with their nested lines, from the last daily note to today's, and drops their old times.

The status bar shows the current block and the time left in it, or the next block. Turn on **Notify when a block starts** to get a notice at each block's start.

## Time tracking

Clocks use Day Planner's format (0.29 and later): a fenced yaml block on the line right after the task. An entry without `end` is still running.

````markdown
- [ ] Write the spec
    ```yaml
    planner:
        log:
            - start: 2026-10-29 09:05:00
              end: 2026-10-29 09:50:00
            - start: 2026-10-29 14:00:00
    ```
````

Other keys in the block are kept. Older `[clock::2026-10-29T09:05--2026-10-29T09:50]` list items under a task are still read, counted and can be stopped. **Convert old clock entries to YAML** moves them into the yaml block.

| Command                                 | What it does                                                  |
| --------------------------------------- | ------------------------------------------------------------- |
| Start or stop clock on the current task | Uses the task at the cursor. Starting a clock stops any other |
| Stop clock                              | Stops the running clock                                       |
| Open task with running clock            | Jumps to it                                                   |
| Convert old clock entries to YAML       | Moves `[clock::]` items into each task's yaml block           |

You can also start and stop clocks from the play and stop buttons on timeline blocks. Clocked time shows as a bar beside the blocks and in the status bar. When Obsidian starts, it reminds you about clocks left running. An entry that runs past midnight counts on both days.

## Pillars, pipelines and vaults

Everything below is front matter and inline fields, so Datacore can query it: for example `@page and type = "project" and status = "active"`.

PPV notes are typed by front matter. A note directly inside a type's folder gets that type even without `type`.

```markdown
---
type: project # pillar | goal | project | resource
status: active # backlog | active | paused | done | dropped (projects)
goal: "[[Run a marathon]]" # or pillar: "[[Health]]"
start: 2026-10-01
due: 2026-12-01
---
```

Goals link to a pillar with `pillar:`. Projects link to a goal with `goal:`, or straight to a pillar with `pillar:`. A task belongs to a project if it is in the project's note or links to it, as in `- [ ] Stretch [[Training plan]]`.

| Command                                | What it does                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Open PPV dashboard                     | Pillars, then goals, then projects, with progress, clocked time and the next action                      |
| New pillar / goal / project / resource | Creates the note in its folder, linked to a parent you pick (the active note when it fits)               |
| Set project status                     | On a project note. Done or dropped projects move to the archive folder when that is on, and links follow |
| Capture to inbox                       | Adds a task or note to today's note or an inbox note, under the capture heading. Ctrl/Cmd+Enter submits  |
| Cycle task stage                       | Moves the task at the cursor from to do, to in progress (`[/]`), to waiting (`[>]`)                      |
| Set up PPV folders                     | Creates missing folders and, in an empty system, an example pillar                                       |
| Write progress to project notes        | Writes `progress: 67` (percent of tasks closed) into project front matter                                |

Put a list of projects or tasks in any note with an `sbos` code block:

````markdown
```sbos
view: tasks          # projects (default) or tasks
status: active, paused   # or all
pillar: Health       # or goal: …
limit: 10
```
````

## Reviews

Put a review block in a weekly, monthly, quarterly or yearly note, or a daily one:

````markdown
```sbos-review

```
````

It shows the tasks completed in that period (from `✅` dates), time clocked per pillar, projects started and finished, and open vault check findings. **Insert review into this periodic note** adds the block. **Create review templates** adds review templates and uses them for weekly to yearly notes that have no template yet.

## Vault check

**Check vault structure** opens a list of problems, grouped by rule. Click one to open the note at the right line.

| Rule                                 | Quick fix          |
| ------------------------------------ | ------------------ |
| Goal without a pillar                | Link to a parent   |
| Project without a goal or pillar     | Link to a parent   |
| Parent link does not resolve         |                    |
| Parent is the wrong kind of note     |                    |
| Active project without a next action |                    |
| Open project past its due date       |                    |
| Time block ends before it starts     |                    |
| Overlapping time blocks              |                    |
| Clock running for more than 12 hours | Stop the clock now |

Quick fixes show the exact change before they apply it. Each rule can be turned off or given another severity in settings.

## Settings

| Section                       | Settings                                                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calendar                      | Import settings, start week on, confirm before creating notes, show week numbers                                                                                                              |
| Daily to yearly notes         | Enabled, format, folder, template                                                                                                                                                             |
| Day planner                   | Show the calendar in the day planner, day starts and ends at, snap to minutes, default duration, hour height, days in multi-day view, heading for new blocks, status bar, start notifications |
| Pillars, pipelines and vaults | Folder and template per type, archive folder, archive finished projects, capture to, inbox note, capture heading                                                                              |
| Vault check                   | Per rule: on or off, and severity                                                                                                                                                             |

## Public API

Other plugins and scripts can use `app.plugins.getPlugin("second-brain-os").api`, which keeps the Periodic Notes API:

```js
api.getGranularities(); // enabled granularities, such as ["day", "week"]
api.getPeriodicNote("day", window.moment()); // TFile or null
await api.createPeriodicNote("week", true, window.moment("2026-10-29")); // create and open
```
