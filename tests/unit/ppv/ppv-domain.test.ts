import { describe, expect, it } from "bun:test";

import {
	ancestorTitles,
	buildTree,
	classify,
	defaultContent,
	DEFAULT_PPV_SETTINGS,
	nextStage,
	parseBlockQuery,
	readPpvNote,
	safeFileName,
	selectProjects,
	type PpvNote,
} from "../../../src/features/ppv";

const settings = DEFAULT_PPV_SETTINGS;
const resolve = (link: string) => `PPV/${link.replace(/^\[\[|\]\]$/g, "")}.md`;

function note(partial: Partial<PpvNote> & Pick<PpvNote, "path" | "type">): PpvNote {
	return {
		title: partial.path.split("/").pop()?.replace(/\.md$/, "") ?? "",
		status: "active",
		parent: null,
		parentLink: null,
		due: null,
		start: null,
		kind: null,
		...partial,
	};
}

describe("classify", () => {
	it("uses the type field first", () => {
		expect(classify("x.md", { type: "Project" }, settings)).toBe("project");
		expect(classify("PPV/Projects/x.md", { type: "recipe" }, settings)).toBeNull();
	});

	it("falls back to the type folder for notes directly inside it", () => {
		expect(classify("PPV/Pillars/Health.md", null, settings)).toBe("pillar");
		expect(classify("PPV/Pillars/sub/Health.md", null, settings)).toBeNull();
		expect(classify("Health.md", {}, settings)).toBeNull();
	});
});

describe("readPpvNote", () => {
	it("reads parent, status, dates and kind", () => {
		const project = readPpvNote(
			"PPV/Projects/Site.md",
			"Site",
			{
				type: "project",
				status: "Paused",
				goal: "[[Ship v2]]",
				pillar: "[[Work]]",
				due: "2026-12-01",
				start: new Date(Date.UTC(2026, 9, 1)),
			},
			settings,
			resolve,
		);
		expect(project).toEqual({
			path: "PPV/Projects/Site.md",
			title: "Site",
			type: "project",
			status: "paused",
			parent: "PPV/Ship v2.md",
			parentLink: "[[Ship v2]]",
			due: "2026-12-01",
			start: "2026-10-01",
			kind: null,
		});
	});

	it("defaults unknown statuses and goal kinds, and accepts list values", () => {
		const project = readPpvNote(
			"p.md",
			"p",
			{ type: "project", status: "someday", pillar: ["[[Work]]"] },
			settings,
			resolve,
		);
		expect(project?.status).toBe("active");
		expect(project?.parent).toBe("PPV/Work.md");
		const goal = readPpvNote("g.md", "g", { type: "goal", due: "nope" }, settings, () => null);
		expect(goal).toMatchObject({ kind: "outcome", due: null, parent: null });
		expect(readPpvNote("n.md", "n", null, settings, resolve)).toBeNull();
	});
});

describe("buildTree", () => {
	const notes = [
		note({ path: "Health.md", type: "pillar" }),
		note({ path: "Work.md", type: "pillar" }),
		note({ path: "Run.md", type: "goal", parent: "Health.md" }),
		note({ path: "Stray goal.md", type: "goal", parent: "Missing.md" }),
		note({ path: "Marathon.md", type: "project", parent: "Run.md" }),
		note({ path: "Gym.md", type: "project", parent: "Health.md" }),
		note({ path: "Orphan.md", type: "project" }),
		note({ path: "Under resource.md", type: "project", parent: "Book.md" }),
		note({ path: "Book.md", type: "resource" }),
	];
	const tree = buildTree(notes);

	it("nests goals and projects under pillars", () => {
		expect(tree.pillars.map((pillar) => pillar.note.title)).toEqual(["Health", "Work"]);
		const [health] = tree.pillars;
		expect(
			health?.goals.map((goal) => [
				goal.note.title,
				goal.projects.map((project) => project.title),
			]),
		).toEqual([["Run", ["Marathon"]]]);
		expect(health?.projects.map((project) => project.title)).toEqual(["Gym"]);
	});

	it("collects loose goals, loose projects and resources", () => {
		expect(tree.looseGoals.map((goal) => goal.note.title)).toEqual(["Stray goal"]);
		expect(tree.looseProjects.map((project) => project.title)).toEqual([
			"Orphan",
			"Under resource",
		]);
		expect(tree.resources.map((resource) => resource.title)).toEqual(["Book"]);
	});

	it("lists ancestors without looping", () => {
		const byPath = new Map(notes.map((item) => [item.path, item]));
		const lookup = (path: string) => byPath.get(path) ?? null;
		expect(ancestorTitles(byPath.get("Marathon.md") as PpvNote, lookup)).toEqual([
			"Run",
			"Health",
		]);
		const loopA = note({ path: "A.md", type: "goal", parent: "B.md" });
		const loopB = note({ path: "B.md", type: "goal", parent: "A.md" });
		const loop = new Map([
			["A.md", loopA],
			["B.md", loopB],
		]);
		expect(ancestorTitles(loopA, (path) => loop.get(path) ?? null)).toEqual(["B"]);
	});
});

describe("note content", () => {
	it("makes safe file names", () => {
		expect(safeFileName(' Plan: Q4 / "launch"#1 ')).toBe("Plan Q4 launch 1");
		expect(safeFileName("[[x]]")).toBe("x");
	});

	it("writes front matter per type", () => {
		expect(
			defaultContent({
				type: "project",
				title: "Site",
				parentTitle: "Ship v2",
				status: "backlog",
				today: "2026-10-29",
			}),
		).toBe(
			[
				"---",
				"type: project",
				"status: backlog",
				"start: 2026-10-29",
				"due: ",
				'goal: "[[Ship v2]]"',
				"---",
				"# Site",
				"",
				"## Outcome",
				"",
				"## Next actions",
				"- [ ] ",
				"",
			].join("\n"),
		);
		expect(
			defaultContent({
				type: "pillar",
				title: "Health",
				parentTitle: null,
				status: "active",
				today: "2026-10-29",
			}),
		).toContain("type: pillar\n---\n# Health");
		expect(
			defaultContent(
				{
					type: "project",
					title: "Gym",
					parentTitle: "Health",
					status: "active",
					today: "2026-10-29",
				},
				"pillar",
			),
		).toContain('pillar: "[[Health]]"');
		expect(
			defaultContent({
				type: "goal",
				title: 'Say "hi"',
				parentTitle: 'A "b"',
				status: "active",
				today: "x",
			}),
		).toContain('pillar: "[[A \\"b\\"]]"');
	});
});

describe("block queries", () => {
	it("parses keys with defaults", () => {
		expect(parseBlockQuery("")).toEqual({
			ok: true,
			value: { view: "projects", statuses: ["active"], under: null, limit: 50 },
		});
		expect(
			parseBlockQuery(
				"# comment\nview: tasks\nstatus: active, paused\npillar: [[Health]]\nlimit: 5",
			),
		).toEqual({
			ok: true,
			value: { view: "tasks", statuses: ["active", "paused"], under: "Health", limit: 5 },
		});
		const all = parseBlockQuery("status: all");
		expect(all.ok && all.value.statuses).toHaveLength(5);
	});

	it("explains mistakes", () => {
		const message = (source: string) => {
			const result = parseBlockQuery(source);
			return result.ok ? null : result.error.message;
		};
		expect(message("view: board")).toBe('Unknown view "board". Use projects or tasks.');
		expect(message("status: someday")).toBe('Unknown status "someday".');
		expect(message("limit: 0")).toBe("limit must be a whole number above 0.");
		expect(message("colour: red")).toBe('Unknown key "colour".');
		expect(message("just text")).toBe('Cannot read "just text". Use key: value.');
	});

	it("selects projects by status and ancestor, soonest due first", () => {
		const projects = [
			note({ path: "B.md", type: "project", due: "2026-12-01" }),
			note({ path: "A.md", type: "project" }),
			note({ path: "C.md", type: "project", due: "2026-11-01", status: "paused" }),
			note({ path: "D.md", type: "project", due: "2026-10-01" }),
			note({ path: "Goal.md", type: "goal" }),
		];
		const ancestors = (item: PpvNote) => (item.title === "D" ? ["Health"] : []);
		const query = {
			view: "projects" as const,
			statuses: ["active" as const, "paused" as const],
			under: null,
			limit: 3,
		};
		expect(selectProjects(projects, query, ancestors).map((item) => item.title)).toEqual([
			"D",
			"C",
			"B",
		]);
		expect(
			selectProjects(projects, { ...query, under: "health" }, ancestors).map(
				(item) => item.title,
			),
		).toEqual(["D"]);
	});
});

describe("stages", () => {
	it("cycles todo, in progress, waiting", () => {
		expect(nextStage("todo")).toBe("in-progress");
		expect(nextStage("in-progress")).toBe("waiting");
		expect(nextStage("waiting")).toBe("todo");
		expect(nextStage("done")).toBe("todo");
	});
});
