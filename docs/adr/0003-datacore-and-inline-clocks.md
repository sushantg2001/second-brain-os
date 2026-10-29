# 3. Datacore instead of Dataview, clocks as inline fields

Status: accepted, 2026-10-29. Changes part of ADR 0002.

## Context

- Datacore is the successor to Dataview, by the same author. People building new query dashboards use it.
- Day Planner 0.29.0 moved its time tracker from Dataview-style inline properties to a fenced yaml block under the task. We tried that format and decided against it.

## Decision

- Datacore is a required plugin, and Dataview is not. Everything the plugin writes is front matter, inline fields or Tasks emoji fields, which Datacore indexes.
- Clocks stay as inline fields in list items under the task:

    ```markdown
    - [ ] Write the spec
        - [clock::2026-10-29T09:05--2026-10-29T09:50]
    ```

## Consequences

- Clocked time is queryable with Datacore (and Dataview) like any other field.
- Day Planner 0.29 and later does not read these entries, so its own time tracker does not show them.
- Users who rely on Dataview for other plugins keep it installed themselves.
