# 3. Datacore instead of Dataview, Day Planner yaml clocks

Status: accepted, 2026-10-29. Changes part of ADR 0002.

## Context

- Datacore is the successor to Dataview, by the same author. People building new query dashboards use it.
- Day Planner 0.29.0 moved its time tracker from Dataview-style inline properties (`[clock::…]`) to a fenced yaml block on the line after a task, and stopped reading the old style.

## Decision

- Datacore is a required plugin, and Dataview is not. Everything the plugin writes is front matter, inline fields or Tasks emoji fields, which Datacore indexes.
- Clocks are written the way Day Planner 0.29 writes them:

    ````markdown
    - [ ] Write the spec
        ```yaml
        planner:
            log:
                - start: 2026-10-29 09:05:00
                  end: 2026-10-29 09:50:00
        ```
    ````

    Other keys in the block and untouched entries are kept as they are.

- Older `[clock::start--end]` items are still read and can be stopped, so no time is lost. A command moves them into the yaml block.
- YAML goes through a `YamlCodec` port backed by Obsidian's `parseYaml` and `stringifyYaml`, so domain code stays pure.

## Consequences

- Notes stay compatible with Day Planner 0.29+ in both directions.
- The task parser reads one more structure: a yaml fence directly under a task.
- Users who relied on Dataview for other plugins keep it installed themselves.
