# 2. Own task index, Dataview not required

Status: accepted, 2026-10-29. Changes part of ADR 0001.

## Context

ADR 0001 planned to read notes through Dataview. The planner needs the exact line of every task (to rewrite a time block), the raw text (to check the line is unchanged before writing), nested list items (for clocks) and Day Planner's time syntax. Dataview's task objects are built for queries: they do not keep the raw line, and their shape changes between versions.

## Decision

- The `tasks` feature parses notes itself (`parseTasks`) and keeps a `TaskIndex` current from vault events. Front matter and links still come from Obsidian's metadata cache.
- Dataview is no longer a required plugin. People can still use it in their own notes and templates.
- Tasks stays required: its API toggles tasks (including recurrence) and its status symbols are the task states. Templater stays required for templates.

## Consequences

- One less plugin to install, and no dependency on Dataview's internal shapes.
- The first index build reads every note that might hold tasks. It runs after the layout is ready, and a quick regular-expression check skips notes without tasks.
- The parser is ours to maintain. It has unit and property tests, including round trips.
