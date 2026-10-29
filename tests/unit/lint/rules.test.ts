import { describe, expect, it } from "bun:test";

import {
	applySettings,
	DEFAULT_LINT_SETTINGS,
	lint,
	type LintInput,
	type RuleId,
	type Severity,
} from "../../../src/features/lint";
import { buildDayPlan } from "../../../src/features/planner";
import type { PpvNote } from "../../../src/features/ppv";
import { parseTasks } from "../../../src/features/tasks";
import { clockBlock, yaml } from "../../fakes/yaml";

function note(partial: Partial<PpvNote> & Pick<PpvNote, "path" | "type">): PpvNote {
	return {
		title: partial.path.replace(/\.md$/, ""),
		status: "active",
		parent: null,
		parentLink: null,
		due: null,
		start: null,
		completed: null,
		kind: null,
		...partial,
	};
}

function input(overrides: Partial<LintInput> = {}): LintInput {
	return {
		notes: new Map(),
		tasks: [],
		projectTasks: () => [],
		plans: [],
		today: "2026-10-29",
		now: { date: "2026-10-29", minutes: 12 * 60 },
		...overrides,
	};
}

describe("structure rules", () => {
	const notes = [
		note({ path: "Health.md", type: "pillar" }),
		note({ path: "Book.md", type: "resource" }),
		note({ path: "Lost goal.md", type: "goal" }),
		note({ path: "Lost project.md", type: "project" }),
		note({ path: "Old project.md", type: "project", status: "done" }),
		note({ path: "Broken.md", type: "goal", parentLink: "[[Nope]]" }),
		note({ path: "Wrong.md", type: "project", parent: "Book.md", parentLink: "[[Book]]" }),
		note({ path: "Fine goal.md", type: "goal", parent: "Health.md" }),
	];
	const findings = lint(input({ notes: new Map(notes.map((item) => [item.path, item])) }));

	it("reports missing, broken and wrong parents", () => {
		const structural = findings.filter((item) => item.rule !== "no-next-action");
		expect(structural.map((item) => [item.rule, item.path])).toEqual([
			["broken-parent", "Broken.md"],
			["orphan-goal", "Lost goal.md"],
			["orphan-project", "Lost project.md"],
			["wrong-parent", "Wrong.md"],
		]);
		expect(findings.find((item) => item.rule === "wrong-parent")?.message).toBe(
			"Wrong is linked to [[Book]], which is a resource.",
		);
		expect(findings.find((item) => item.rule === "orphan-goal")?.fix).toEqual({
			kind: "set-parent",
			path: "Lost goal.md",
			type: "goal",
		});
	});

	it("reports a parent that is not a PPV note", () => {
		const stray = note({
			path: "S.md",
			type: "goal",
			parent: "Random.md",
			parentLink: "[[Random]]",
		});
		expect(lint(input({ notes: new Map([[stray.path, stray]]) }))[0]?.message).toBe(
			"S is linked to [[Random]], which is not a pillar, goal or project.",
		);
	});
});

describe("project rules", () => {
	it("reports overdue projects and active projects with nothing to do", () => {
		const overdue = note({
			path: "Late.md",
			type: "project",
			parent: "x",
			due: "2026-10-01",
			status: "paused",
		});
		const idle = note({ path: "Idle.md", type: "project", parent: "x" });
		const busy = note({ path: "Busy.md", type: "project", parent: "x", due: "2026-10-29" });
		const pillar = note({ path: "x", type: "pillar" });
		const tasks = parseTasks("Busy.md", "- [ ] Do it\n- [ ] ");
		const findings = lint(
			input({
				notes: new Map([overdue, idle, busy, pillar].map((item) => [item.path, item])),
				projectTasks: (path) =>
					path === "Busy.md" ? tasks : parseTasks(path, "- [x] Done\n- [ ] "),
			}),
		);
		expect(findings.map((item) => [item.rule, item.path])).toEqual([
			["no-next-action", "Idle.md"],
			["overdue-project", "Late.md"],
		]);
	});
});

describe("task rules", () => {
	it("reports malformed blocks and clocks running too long", () => {
		const tasks = parseTasks(
			"a.md",
			[
				"- [ ] 10:00 - 09:00 Backwards",
				"- [ ] Long",
				clockBlock({ start: "2026-10-28 09:00:00" }),
				"- [ ] Short",
				"\t- [clock::2026-10-29T08:00--]",
				"- [ ] Old style",
				"\t- [clock::2026-10-27T08:00--]",
			].join("\n"),
			(text) => yaml.parse(text),
		);
		const findings = lint(input({ tasks }));
		expect(findings.map((item) => [item.rule, item.line, item.severity])).toEqual([
			["malformed-time-block", 0, "error"],
			["stale-clock", 2, "warning"],
			["stale-clock", 10, "warning"],
		]);
		expect(findings[1]?.fix).toEqual({
			kind: "close-clock",
			path: "a.md",
			line: 1,
			raw: "- [ ] Long",
		});
	});

	it("reports overlapping open blocks per day", () => {
		const tasks = parseTasks(
			"2026-10-29.md",
			"- [ ] 09:00 - 10:00 A\n- [ ] 09:30 - 10:30 B\n- [x] 11:00 - 12:00 C\n- [x] 11:30 - 12:30 D",
		);
		const plan = buildDayPlan("2026-10-29", "2026-10-29.md", tasks, 30);
		const findings = lint(input({ plans: [{ path: "2026-10-29.md", plan }] }));
		expect(findings).toEqual([
			{
				rule: "overlapping-blocks",
				severity: "info",
				path: "2026-10-29.md",
				line: 0,
				message: "2 blocks overlap on 2026-10-29: A, B.",
				fix: null,
			},
		]);
	});
});

describe("lint settings", () => {
	it("turns rules off and overrides severity", () => {
		const findings: { rule: RuleId; severity: Severity }[] = [
			{ rule: "orphan-goal", severity: "warning" },
			{ rule: "stale-clock", severity: "warning" },
		];
		const settings = {
			...DEFAULT_LINT_SETTINGS,
			"orphan-goal": { enabled: false, severity: "warning" as const },
			"stale-clock": { enabled: true, severity: "error" as const },
		};
		expect(applySettings(findings, settings)).toEqual([
			{ rule: "stale-clock", severity: "error" },
		]);
	});
});
