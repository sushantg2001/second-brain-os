import { describe, expect, it } from "bun:test";
import { act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { reviewTemplate } from "../../src/features/rollups";
import { Notice } from "../mocks/obsidian";
import { loadPlugin, sleep } from "../fakes/plugin-harness";

const VAULT = {
	"PPV/Pillars/Health.md": "---\ntype: pillar\n---\n",
	"PPV/Goals/Fitness.md": '---\ntype: goal\npillar: "[[Health]]"\n---\n',
	"PPV/Projects/Marathon.md": [
		"---",
		"type: project",
		'goal: "[[Fitness]]"',
		"start: 2026-10-27",
		"---",
		"- [x] Buy shoes ✅ 2026-10-27",
		"- [ ] Long run",
		"\t- [clock::2026-10-28T07:00--2026-10-28T08:30]",
	].join("\n"),
	"PPV/Projects/Garden.md":
		'---\ntype: project\npillar: "[[Health]]"\nstatus: done\ncompleted: 2026-10-30\n---\n- [x] Plant ✅ 2026-09-01',
	"2026-10-29.md":
		"- [x] Stretch [[Marathon]] ✅ 2026-10-29\n- [ ] Read\n\t- [clock::2026-10-29T21:00--2026-10-29T21:20]",
	"2026-W44.md": "# Week\n```sbos-review\n```",
};

async function setup(files: Record<string, string> = VAULT) {
	const harness = await loadPlugin({ files, today: "2026-10-29", minutes: 12 * 60 });
	await act(() => sleep(10));
	return harness;
}

describe("rollups", () => {
	it("rolls up projects, goals and pillars", async () => {
		const { container } = await setup();
		const { rollups, ppvIndex } = container;
		expect(rollups.project("PPV/Projects/Marathon.md")).toEqual({
			done: 2,
			total: 3,
			percent: 67,
			clockedMinutes: 90,
			lastActivity: "2026-10-29",
		});
		const goal = ppvIndex.get("PPV/Goals/Fitness.md");
		const pillar = ppvIndex.get("PPV/Pillars/Health.md");
		expect(goal && rollups.of(goal)).toMatchObject({ done: 2, total: 3 });
		expect(pillar && rollups.of(pillar)).toMatchObject({
			done: 3,
			total: 4,
			clockedMinutes: 90,
		});
		expect(
			rollups.projectOf(container.tasks.tasksIn("2026-10-29.md")[0] ?? (undefined as never)),
		).toBe("PPV/Projects/Marathon.md");
		expect(rollups.pillarOf("PPV/Projects/Marathon.md")?.title).toBe("Health");
		expect(rollups.pillarOf("2026-10-29.md")).toBeNull();
	});

	it("reviews a period", async () => {
		const { container } = await setup();
		const review = container.rollups.reviewForNote("2026-W44.md");
		expect(review?.range).toEqual({ from: "2026-10-25", to: "2026-10-31" });
		expect(review?.completed.map((task) => [task.title, task.done, task.project])).toEqual([
			["Buy shoes", "2026-10-27", "PPV/Projects/Marathon.md"],
			["Stretch [[Marathon]]", "2026-10-29", "PPV/Projects/Marathon.md"],
		]);
		expect([...(review?.clockedByPillar ?? [])]).toEqual([
			["Health", 90],
			["", 20],
		]);
		expect(review?.clockedTotal).toBe(110);
		expect(review?.projectsFinished.map((project) => project.title)).toEqual(["Garden"]);
		expect(review?.projectsStarted.map((project) => project.title)).toEqual(["Marathon"]);
		expect(container.rollups.reviewForNote("PPV/Projects/Marathon.md")).toBeNull();
	});

	it("writes progress into project notes", async () => {
		Notice.messages.length = 0;
		const { plugin, app } = await setup();
		plugin.runCommand("write-progress");
		await act(() => sleep(10));
		expect(app.vault.contentOf("PPV/Projects/Marathon.md")).toContain("progress: 67");
		expect(Notice.messages.at(-1)).toBe("Updated progress on 2 projects.");
		plugin.runCommand("write-progress");
		await act(() => sleep(10));
		expect(Notice.messages.at(-1)).toBe("Updated progress on 0 projects.");
	});
});

describe("review block", () => {
	async function render(harness: Awaited<ReturnType<typeof setup>>, sourcePath: string) {
		const handler = harness.plugin.codeBlockProcessors.get("sbos-review");
		const el = document.createElement("div");
		document.body.append(el);
		const children: { load(): void; unload(): void }[] = [];
		await act(async () => {
			await handler?.("", el, { sourcePath, addChild: (child) => children.push(child) });
			children[0]?.load();
			await sleep(0);
		});
		return { ui: within(el), el, child: children[0] };
	}

	it("shows the period's review and opens items", async () => {
		const harness = await setup();
		const { ui, child, el } = await render(harness, "2026-W44.md");
		expect(ui.getByText("2026-10-25 to 2026-10-31")).toBeInTheDocument();
		expect(ui.getByRole("heading", { name: "Completed (2)" })).toBeInTheDocument();
		expect(ui.getByRole("heading", { name: "Time by pillar (1h 50m)" })).toBeInTheDocument();
		expect(ui.getByRole("rowheader", { name: "Not linked to a pillar" })).toBeInTheDocument();
		expect(ui.getByText("Finished", { exact: false })).toHaveTextContent(
			"Finished Garden 2026-10-30",
		);
		await userEvent.click(ui.getByRole("button", { name: "Buy shoes" }));
		await act(() => sleep(0));
		expect(harness.app.workspace.leaves.at(-1)?.openState).toMatchObject({
			eState: { line: 5 },
		});
		await userEvent.click(ui.getByRole("button", { name: "Marathon" }));
		await act(() => sleep(0));
		expect(harness.app.workspace.getActiveFile()?.path).toBe("PPV/Projects/Marathon.md");
		act(() => child?.unload());
		expect(el).toBeEmptyDOMElement();
	});

	it("explains empty periods and misplaced blocks", async () => {
		const harness = await setup({ "2026-W40.md": "", "Notes.md": "" });
		const empty = await render(harness, "2026-W40.md");
		expect(empty.ui.getByText("Nothing completed in this period.")).toBeInTheDocument();
		expect(empty.ui.getByText("No time clocked in this period.")).toBeInTheDocument();
		expect(empty.ui.getByText("No projects started or finished.")).toBeInTheDocument();
		const misplaced = await render(harness, "Notes.md");
		expect(misplaced.ui.getByText(/Put this block in a daily/)).toBeInTheDocument();
	});
});

describe("review commands", () => {
	it("inserts a review block once into a periodic note", async () => {
		const { plugin, container, app } = await setup({
			"2026-10-29.md": "# Today",
			"Notes.md": "",
		});
		expect(plugin.runCommand("insert-review")).toBe(false);
		await container.workspace.open("Notes.md");
		expect(plugin.runCommand("insert-review")).toBe(false);
		await container.workspace.open("2026-10-29.md");
		plugin.runCommand("insert-review");
		await act(() => sleep(10));
		plugin.runCommand("insert-review");
		await act(() => sleep(10));
		expect(app.vault.contentOf("2026-10-29.md")).toBe(
			"# Today\n\n## Review\n```sbos-review\n```\n",
		);
	});

	it("creates review templates and assigns empty template settings", async () => {
		Notice.messages.length = 0;
		const { plugin, container, app } = await setup({ "Templates/Weekly review.md": "mine" });
		await container.settings.section("periodic").update((settings) => ({
			...settings,
			notes: {
				...settings.notes,
				month: { ...settings.notes.month, template: "Mine/Month" },
			},
		}));
		plugin.runCommand("create-review-templates");
		await act(() => sleep(10));
		expect(app.vault.contentOf("Templates/Weekly review.md")).toBe("mine");
		expect(app.vault.contentOf("Templates/Yearly review.md")).toBe(reviewTemplate("year"));
		const notes = container.settings.section("periodic").store.get().notes;
		expect([notes.week.template, notes.month.template, notes.quarter.template]).toEqual([
			"Templates/Weekly review.md",
			"Mine/Month",
			"Templates/Quarterly review.md",
		]);
		expect(Notice.messages.at(-1)).toBe("Created 3 review templates in Templates.");
		plugin.runCommand("create-review-templates");
		await act(() => sleep(10));
		expect(Notice.messages.at(-1)).toBe("Review templates already exist.");
	});
});
