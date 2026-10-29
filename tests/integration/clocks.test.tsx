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
	it("starts a clock under the task's existing children and stops it", async () => {
		const { plugin, content, at, clockStatus } = await setup();
		expect(plugin.runCommand("stop-clock")).toBe(false);
		expect(plugin.runEditorCommand("start-clock", "2026-10-29.md", 1)).toBe(true);
		await act(() => sleep(10));
		expect(content()).toBe(
			[
				"- [ ] 09:00 - 10:00 Write spec",
				"\t- context",
				"\t- [clock::2026-10-29T09:05--]",
				"- [ ] Review",
				"",
			].join("\n"),
		);
		await at(9 * 60 + 50);
		expect(clockStatus()?.textContent).toBe("⏱ Write spec · 45m");
		expect(plugin.runCommand("stop-clock")).toBe(true);
		await act(() => sleep(10));
		expect(content()).toContain("\t- [clock::2026-10-29T09:05--2026-10-29T09:50]");
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
				"\t- context",
				"\t- [clock::2026-10-29T09:05--2026-10-29T09:30]",
				"- [ ] Review",
				"\t- [clock::2026-10-29T09:30--]",
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
		expect(harness.content()).toContain("\t- [clock::2026-10-29T09:05--]");
		await harness.at(9 * 60 + 35);
		expect(ui.getByText("Planned 1h · Clocked 30m")).toBeInTheDocument();
		expect(view.contentEl.querySelector(".sbos-clocked.is-running")).not.toBeNull();
		await userEvent.click(ui.getByRole("button", { name: "Stop clock on Write spec" }));
		await act(() => sleep(10));
		expect(harness.content()).toContain("\t- [clock::2026-10-29T09:05--2026-10-29T09:35]");
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
