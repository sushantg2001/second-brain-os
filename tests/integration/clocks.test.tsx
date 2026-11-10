import { describe, expect, it } from "bun:test";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { clockStatusText, taskAtLine } from "../../src/features/clocks";
import type { TimelineView } from "../../src/features/planner";
import { parseTasks } from "../../src/features/tasks";
import { Notice } from "../mocks/obsidian";
import { loadPlugin, sleep } from "../fakes/plugin-harness";

const NOTE = ["- [ ] 09:00 - 10:00 Write spec", "\t- context", "- [ ] Review", ""].join("\n");

async function setup(
	files: Record<string, string> = { "2026-10-29.md": NOTE },
	minutes = 9 * 60 + 5,
) {
	const harness = await loadPlugin({ files, today: "2026-10-29", minutes });
	await act(() => sleep(10));
	const content = (path = "2026-10-29.md") => harness.app.vault.contentOf(path);
	const at = async (time: number) => {
		harness.clock.minutes = time;
		harness.container.now.tick();
		await act(() => sleep(0));
	};
	const clockStatus = () =>
		harness.plugin.statusBarItems.find((item) => item.classList.contains("sbos-status--clock"));
	return { ...harness, content, at, clockStatus };
}

describe("clocks", () => {
	it("starts a clock on the line under the task, without a bullet, and stops it", async () => {
		const { plugin, content, at, clockStatus } = await setup();
		expect(plugin.runCommand("stop-clock")).toBe(false);
		expect(plugin.runEditorCommand("start-clock", "2026-10-29.md", 1)).toBe(true);
		await act(() => sleep(10));
		expect(content()).toBe(
			[
				"- [ ] 09:00 - 10:00 Write spec",
				"\t[clock::2026-10-29T09:05:00--]",
				"\t- context",
				"- [ ] Review",
				"",
			].join("\n"),
		);
		await at(9 * 60 + 50);
		expect(clockStatus()?.textContent).toBe("⏱ Write spec · 45m");
		expect(plugin.runCommand("stop-clock")).toBe(true);
		await act(() => sleep(10));
		expect(content()).toContain("\t[clock::2026-10-29T09:05:00--2026-10-29T09:50:00]");
		expect(clockStatus()?.hidden).toBe(true);
	});

	it("keeps one clock running: starting another stops the first", async () => {
		const { plugin, content, at, container } = await setup();
		plugin.runEditorCommand("start-clock", "2026-10-29.md", 0);
		await act(() => sleep(10));
		await at(9 * 60 + 30);
		plugin.runEditorCommand("start-clock", "2026-10-29.md", 3);
		await act(() => sleep(10));
		expect(content()).toBe(
			[
				"- [ ] 09:00 - 10:00 Write spec",
				"\t[clock::2026-10-29T09:05:00--2026-10-29T09:30:00]",
				"\t- context",
				"- [ ] Review",
				"\t[clock::2026-10-29T09:30:00--]",
				"",
			].join("\n"),
		);
		expect(container.clocks.running.get()).toHaveLength(1);
		await at(10 * 60);
		expect(container.clocks.minutesOn("2026-10-29")).toBe(25 + 30);
		plugin.runEditorCommand("start-clock", "2026-10-29.md", 3);
		await act(() => sleep(10));
		expect(container.clocks.running.get()).toHaveLength(0);
	});

	it("does nothing on lines that are not tasks", async () => {
		const { plugin } = await setup({ "a.md": "Just text\n- [ ] Task" });
		expect(plugin.runEditorCommand("start-clock", "a.md", 0)).toBe(false);
		expect(plugin.runEditorCommand("start-clock", "missing.md", 0)).toBe(false);
	});

	it("reminds about clocks left running and opens the task", async () => {
		Notice.messages.length = 0;
		const { plugin, app } = await setup({
			"Projects/Site.md": "# Site\n- [ ] Build\n  - [clock::2026-10-28T16:00--]\n",
		});
		expect(Notice.messages).toContain(
			'A clock is still running on "Build" since 2026-10-28 16:00.',
		);
		plugin.runCommand("open-running-task");
		await sleep(0);
		const leaf = app.workspace.leaves.find(
			(candidate) => candidate.file?.path === "Projects/Site.md",
		);
		expect(leaf?.openState).toMatchObject({ eState: { line: 1 } });
		expect(plugin.runCommand("open-running-task")).toBe(true);
	});

	it("can be started and stopped from the timeline, which shows clocked time", async () => {
		const harness = await setup();
		const view = harness.app.workspace.getLeavesOfType("sbos-timeline")[0]
			?.view as unknown as TimelineView;
		document.body.append(view.containerEl);
		await act(() => sleep(0));
		const ui = within(view.contentEl);
		await userEvent.click(ui.getByRole("button", { name: "Start clock on Write spec" }));
		await act(() => sleep(10));
		expect(harness.content()).toContain("\t[clock::2026-10-29T09:05:00--]");
		await harness.at(9 * 60 + 35);
		expect(ui.getByText("Planned 1h · Clocked 30m")).toBeInTheDocument();
		expect(view.contentEl.querySelector(".sbos-clock.is-running")).not.toBeNull();
		await userEvent.click(ui.getByRole("button", { name: "Stop clock on Write spec" }));
		await act(() => sleep(10));
		expect(harness.content()).toContain("\t[clock::2026-10-29T09:05:00--2026-10-29T09:35:00]");
	});

	it("shows clocked time on the calendar", async () => {
		const harness = await setup({
			"2026-10-29.md": "- [ ] Write\n\t- [clock::2026-10-29T09:00--2026-10-29T10:30]\n",
		});
		harness.plugin.runCommand("open-calendar");
		await act(() => sleep(0));
		const leaf = harness.app.workspace.getLeavesOfType("sbos-calendar")[0];
		document.body.append(leaf?.view?.containerEl ?? document.createElement("div"));
		await act(() => sleep(0));
		expect(
			screen.getByRole("button", {
				name: "Thursday, October 29, 2026, has note, 1h 30m clocked",
			}),
		).toBeInTheDocument();
	});
});

const DAY = "2026-10-29.md";

describe("clock lines without a bullet", () => {
	it("writes the clock before the sub tasks, with a tab and seconds", async () => {
		const { plugin, content } = await setup({ [DAY]: "- [ ] Main\n\t- [ ] Sub\n" });
		plugin.runEditorCommand("start-clock", DAY, 0);
		await act(() => sleep(10));
		expect(content()).toBe("- [ ] Main\n\t[clock::2026-10-29T09:05:00--]\n\t- [ ] Sub\n");
	});

	it("indents under a nested task by one tab more than the task", async () => {
		const { plugin, content } = await setup({ [DAY]: "- [ ] Main\n\t- [ ] Sub\n" });
		plugin.runEditorCommand("start-clock", DAY, 1);
		await act(() => sleep(10));
		expect(content()).toBe("- [ ] Main\n\t- [ ] Sub\n\t\t[clock::2026-10-29T09:05:00--]\n");
	});

	it("appends after the clock lines already under the task", async () => {
		const note = "- [ ] A\n\t[clock::2026-10-28T08:00:00--2026-10-28T08:10:00]\n\t- [ ] Sub\n";
		const { plugin, content } = await setup({ [DAY]: note });
		plugin.runEditorCommand("start-clock", DAY, 0);
		await act(() => sleep(10));
		expect(content()).toBe(
			[
				"- [ ] A",
				"\t[clock::2026-10-28T08:00:00--2026-10-28T08:10:00]",
				"\t[clock::2026-10-29T09:05:00--]",
				"\t- [ ] Sub",
				"",
			].join("\n"),
		);
	});

	it("keeps older bullet clocks and puts the new one directly under the task", async () => {
		const note = "- [ ] A\n\t- [clock::2026-10-28T08:00--2026-10-28T08:10]\n";
		const { plugin, content } = await setup({ [DAY]: note });
		plugin.runEditorCommand("start-clock", DAY, 0);
		await act(() => sleep(10));
		expect(content()).toBe(
			"- [ ] A\n\t[clock::2026-10-29T09:05:00--]\n\t- [clock::2026-10-28T08:00--2026-10-28T08:10]\n",
		);
	});

	it("adds no blank line at the end of a note without a final newline", async () => {
		const { plugin, content } = await setup({ [DAY]: "- [ ] A" });
		plugin.runEditorCommand("start-clock", DAY, 0);
		await act(() => sleep(10));
		expect(content()).toBe("- [ ] A\n\t[clock::2026-10-29T09:05:00--]");
	});

	it("keeps Windows line endings", async () => {
		const { plugin, content } = await setup({ [DAY]: "- [ ] A\r\n- [ ] B\r\n" });
		plugin.runEditorCommand("start-clock", DAY, 0);
		await act(() => sleep(10));
		expect(content()).toBe("- [ ] A\r\n\t[clock::2026-10-29T09:05:00--]\r\n- [ ] B\r\n");
	});

	it("stops an older running bullet clock in place, to the minute", async () => {
		const { plugin, content } = await setup({
			[DAY]: "- [ ] A\n\t- [clock::2026-10-29T08:00--]\n",
		});
		expect(plugin.runCommand("stop-clock")).toBe(true);
		await act(() => sleep(10));
		expect(content()).toBe("- [ ] A\n\t- [clock::2026-10-29T08:00--2026-10-29T09:05]\n");
	});

	it("reports a running clock on a sub task once, and only for that task", async () => {
		const { plugin, content, container } = await setup({
			[DAY]: "- [ ] Main\n\t- [ ] Sub\n\t\t[clock::2026-10-29T08:00:00--]\n",
		});
		const running = container.clocks.running.get();
		expect(running).toHaveLength(1);
		expect(running[0]?.task.text).toBe("Sub");
		expect(container.clocks.isRunning({ path: DAY, line: 1 })).toBe(true);
		expect(container.clocks.isRunning({ path: DAY, line: 0 })).toBe(false);
		plugin.runCommand("stop-clock");
		await act(() => sleep(10));
		expect(content()).toBe(
			"- [ ] Main\n\t- [ ] Sub\n\t\t[clock::2026-10-29T08:00:00--2026-10-29T09:05:00]\n",
		);
	});

	it("counts clocks in both formats once each", async () => {
		const { container } = await setup({
			[DAY]: [
				"- [ ] A",
				"\t[clock::2026-10-29T08:00:00--2026-10-29T08:30:00]",
				"\t- [clock::2026-10-29T09:00--2026-10-29T09:20]",
			].join("\n"),
		});
		expect(container.clocks.minutesOn("2026-10-29")).toBe(50);
	});
});

describe("clocks on nested tasks", () => {
	const ranges = (
		container: Awaited<ReturnType<typeof setup>>["container"],
		date = "2026-10-29",
	) =>
		container.clocks
			.rangesOn(date)
			.map((range) => [range.title, range.depth, range.start, range.end]);

	it("draws the parent around sub tasks with a gap between them", async () => {
		const { container } = await setup({
			[DAY]: [
				"- [ ] Main",
				"\t- [ ] Write spec",
				"\t\t[clock::2026-10-29T09:05:00--2026-10-29T09:50:00]",
				"\t- [ ] Review PR",
				"\t\t[clock::2026-10-29T10:05:00--2026-10-29T11:40:00]",
			].join("\n"),
		});
		expect(ranges(container)).toEqual([
			["Main", 0, 545, 590],
			["Write spec", 1, 545, 590],
			["Main", 0, 605, 700],
			["Review PR", 1, 605, 700],
		]);
		const keys = container.clocks.rangesOn("2026-10-29").map((range) => range.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("joins the parent's bar when sub task clocks touch", async () => {
		const { container } = await setup({
			[DAY]: [
				"- [ ] Main",
				"\t- [ ] Write",
				"\t\t[clock::2026-10-29T09:00:00--2026-10-29T09:30:00]",
				"\t- [ ] Review",
				"\t\t[clock::2026-10-29T09:30:00--2026-10-29T10:00:00]",
			].join("\n"),
		});
		expect(ranges(container)).toEqual([
			["Main", 0, 540, 600],
			["Write", 1, 540, 570],
			["Review", 1, 570, 600],
		]);
	});

	it("merges the parent's own clock with its sub tasks'", async () => {
		const { container } = await setup({
			[DAY]: [
				"- [ ] Main",
				"\t[clock::2026-10-29T09:00:00--2026-10-29T10:00:00]",
				"\t- [ ] Sub",
				"\t\t[clock::2026-10-29T09:10:00--2026-10-29T09:40:00]",
			].join("\n"),
		});
		expect(ranges(container)).toEqual([
			["Main", 0, 540, 600],
			["Sub", 1, 550, 580],
		]);
	});

	it("nests three levels", async () => {
		const { container } = await setup({
			[DAY]: [
				"- [ ] Top",
				"\t- [ ] Mid",
				"\t\t- [ ] Leaf",
				"\t\t\t[clock::2026-10-29T09:00:00--2026-10-29T09:30:00]",
			].join("\n"),
		});
		expect(ranges(container)).toEqual([
			["Top", 0, 540, 570],
			["Mid", 1, 540, 570],
			["Leaf", 2, 540, 570],
		]);
	});

	it("joins the parent's range when sub task clocks are only seconds apart", async () => {
		const { container } = await setup({
			[DAY]: [
				"- [ ] Main",
				"\t- [ ] One",
				"\t\t[clock::2026-10-29T10:00:00--2026-10-29T10:30:40]",
				"\t- [ ] Two",
				"\t\t[clock::2026-10-29T10:30:47--2026-10-29T11:16:53]",
			].join("\n"),
		});
		const parents = container.clocks
			.rangesOn("2026-10-29")
			.filter((range) => range.depth === 0);
		expect(parents).toHaveLength(1);
		expect(parents[0]?.start).toBe(600);
		expect(parents[0]?.end).toBeCloseTo(11 * 60 + 16 + 53 / 60, 5);
	});

	it("links each range to the range above it that holds it", async () => {
		const { container } = await setup({
			[DAY]: [
				"- [ ] Main",
				"\t- [ ] Write spec",
				"\t\t[clock::2026-10-29T09:05:00--2026-10-29T09:50:00]",
				"\t- [ ] Review PR",
				"\t\t[clock::2026-10-29T10:05:00--2026-10-29T11:40:00]",
			].join("\n"),
		});
		const found = container.clocks.rangesOn("2026-10-29");
		const [firstMain, firstSub, secondMain, secondSub] = found;
		expect([firstMain?.parentKey, firstMain?.leaf]).toEqual([null, false]);
		expect([secondMain?.parentKey, secondMain?.leaf]).toEqual([null, false]);
		expect(firstSub?.parentKey).toBe(firstMain?.key);
		expect(secondSub?.parentKey).toBe(secondMain?.key);
		expect([firstSub?.leaf, secondSub?.leaf]).toEqual([true, true]);
		expect([firstSub?.path, firstSub?.line]).toEqual([DAY, 1]);
	});

	it("marks the parent's bar as running while a sub task's clock runs", async () => {
		const { container } = await setup({
			[DAY]: "- [ ] Main\n\t- [ ] Sub\n\t\t[clock::2026-10-29T09:00:00--]\n",
		});
		const [parent, child] = container.clocks.rangesOn("2026-10-29");
		expect([parent?.title, parent?.running, parent?.end]).toEqual(["Main", true, 545]);
		expect([child?.title, child?.running]).toEqual(["Sub", true]);
	});

	it("draws no bar for a parent without clocked time", async () => {
		const { container } = await setup({ [DAY]: "- [ ] Main\n\t- [ ] Sub\n" });
		expect(container.clocks.rangesOn("2026-10-29")).toEqual([]);
	});

	it("splits the youtube example at midnight, to the second", async () => {
		const { container } = await setup({
			[DAY]: [
				"- [x] youtube  [completion:: 2026-10-26]",
				"\t      [clock::2026-10-26T21:06:26--2026-10-27T00:00:44]",
				"\t      [clock::2026-10-27T00:35:32--2026-10-27T01:42:36]",
			].join("\n"),
		});
		const day26 = container.clocks.rangesOn("2026-10-26");
		expect(day26).toHaveLength(1);
		expect(day26[0]?.start).toBeCloseTo(21 * 60 + 6 + 26 / 60, 5);
		expect(day26[0]?.end).toBe(1440);
		const day27 = container.clocks.rangesOn("2026-10-27");
		expect(day27.map((range) => range.start)).toEqual([0, 35 + 32 / 60]);
		expect(day27[0]?.end).toBeCloseTo(44 / 60, 5);
		expect(container.clocks.minutesOn("2026-10-26")).toBeCloseTo(173 + 34 / 60, 5);
	});

	it("counts a clock on a sub task once", async () => {
		const { container } = await setup({
			[DAY]: "- [ ] Main\n\t- [ ] Sub\n\t\t[clock::2026-10-29T09:10:00--2026-10-29T09:40:00]\n",
		});
		expect(container.clocks.minutesOn("2026-10-29")).toBe(30);
		expect(container.clocks.minutesByDate().get("2026-10-29")).toBe(30);
		const main = container.tasks.tasksIn(DAY)[0];
		expect(main && container.clocks.minutesFor(main)).toBe(30);
	});

	it("counts overlapping clocks on a parent and its sub task separately", async () => {
		const { container } = await setup({
			[DAY]: [
				"- [ ] Main",
				"\t[clock::2026-10-29T09:00:00--2026-10-29T10:00:00]",
				"\t- [ ] Sub",
				"\t\t[clock::2026-10-29T09:10:00--2026-10-29T09:40:00]",
			].join("\n"),
		});
		expect(container.clocks.minutesOn("2026-10-29")).toBe(90);
		const main = container.tasks.tasksIn(DAY)[0];
		expect(main && container.clocks.minutesFor(main)).toBe(90);
	});
});

describe("clock helpers", () => {
	it("finds the task for a line, including nested lines", () => {
		const tasks = parseTasks("a.md", "- [ ] A\n\t- note\n- [ ] B\n\ntext");
		expect(taskAtLine(tasks, 1)?.text).toBe("A");
		expect(taskAtLine(tasks, 2)?.text).toBe("B");
		expect(taskAtLine(tasks, 4)).toBeNull();
	});

	it("has empty status text without a running clock", async () => {
		const { container } = await setup({});
		expect(clockStatusText(container.clocks, { date: "2026-10-29", minutes: 0 })).toBe("");
	});
});
