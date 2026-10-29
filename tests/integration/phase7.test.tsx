import { describe, expect, it } from "bun:test";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { importPeriodicSettings } from "../../src/app/settings-tab";
import { MomentDateFormatter } from "../../src/infrastructure/obsidian";
import { moment, Notice } from "../mocks/obsidian";
import { loadPlugin, sleep } from "../fakes/plugin-harness";

describe("settings import", () => {
	it("imports from loaded Periodic Notes and Calendar plugins", async () => {
		Notice.messages.length = 0;
		const harness = await loadPlugin();
		harness.app.plugins.plugins["periodic-notes"] = {
			settings: { daily: { enabled: true, folder: "Journal" } },
		};
		harness.app.plugins.plugins.calendar = { options: { weekStart: "monday" } };
		const tab = harness.plugin.settingTabs[0];
		if (!tab) {
			throw new Error("No settings tab");
		}
		document.body.append(tab.containerEl);
		tab.display();
		await userEvent.click(within(tab.containerEl).getByRole("button", { name: "Import" }));
		await act(() => sleep(0));
		expect(harness.container.settings.section("periodic").store.get()).toMatchObject({
			weekStart: "monday",
			notes: { day: { folder: "Journal" } },
		});
		expect(Notice.messages).toContain("Imported daily notes, week start.");
	});

	it("explains when there is nothing to import", async () => {
		const harness = await loadPlugin();
		expect(await importPeriodicSettings(harness.container)).toBe(
			"Nothing to import. Enable the periodic notes or calendar plugin first.",
		);
	});
});

describe("carry over", () => {
	it("moves unfinished tasks from the last daily note to today", async () => {
		Notice.messages.length = 0;
		const harness = await loadPlugin({
			today: "2026-10-29",
			files: {
				"2026-10-26.md": "- [ ] Too old",
				"2026-10-28.md": "- [ ] 09:00 - 10:00 Write spec\n- [x] Done\n- [ ] Call bank",
				"2026-10-29.md": "# Today",
			},
		});
		await act(() => sleep(10));
		harness.plugin.runCommand("carry-over-tasks");
		await act(() => sleep(20));
		expect(harness.app.vault.contentOf("2026-10-29.md")).toBe(
			"# Today\n\n## Day planner\n- [ ] Write spec\n- [ ] Call bank\n",
		);
		expect(harness.app.vault.contentOf("2026-10-28.md")).toBe("- [x] Done");
		expect(Notice.messages.at(-1)).toBe("Carried 2 tasks over from 2026-10-28.md.");
		harness.plugin.runCommand("carry-over-tasks");
		await act(() => sleep(20));
		expect(Notice.messages.at(-1)).toBe("No unfinished tasks to carry over.");
	});

	it("explains when there is no earlier daily note", async () => {
		Notice.messages.length = 0;
		const harness = await loadPlugin({ today: "2026-10-29" });
		harness.plugin.runCommand("carry-over-tasks");
		await act(() => sleep(10));
		expect(Notice.messages.at(-1)).toBe("No unfinished tasks to carry over.");
	});

	it("keeps both copies and says so when the old note changed meanwhile", async () => {
		const harness = await loadPlugin({
			today: "2026-10-29",
			files: { "2026-10-28.md": "- [ ] Keep me" },
		});
		await act(() => sleep(10));
		const { notes } = harness.container;
		const originalProcess = notes.process.bind(notes);
		notes.process = async (path, edit) =>
			path === "2026-10-28.md"
				? originalProcess(path, (text) => edit(text.replace("Keep me", "Kept me")))
				: originalProcess(path, edit);
		const result = await harness.container.planner.carryOver();
		expect(!result.ok && result.error.message).toBe(
			"Copied 1 tasks to today, but 2026-10-28.md changed, so they are still there too.",
		);
		// The user's edit wins; the task stays in the old note and is also in today's.
		expect(harness.app.vault.contentOf("2026-10-28.md")).toBe("- [ ] Kept me");
		expect(harness.app.vault.contentOf("2026-10-29.md")).toContain("- [ ] Keep me");
	});
});

describe("calendar at midnight", () => {
	it("moves today when the clock passes midnight", async () => {
		const harness = await loadPlugin({ today: "2026-10-29", minutes: 23 * 60 + 59 });
		harness.plugin.runCommand("open-calendar");
		await act(() => sleep(0));
		const leaf = harness.app.workspace.getLeavesOfType("sbos-calendar")[0];
		document.body.append(leaf?.view?.containerEl ?? document.createElement("div"));
		await act(() => sleep(0));
		expect(screen.getByRole("button", { name: "Thursday, October 29, 2026" })).toHaveAttribute(
			"aria-current",
			"date",
		);
		harness.clock.date = "2026-10-30";
		harness.clock.minutes = 0;
		act(() => harness.container.now.tick());
		expect(screen.getByRole("button", { name: "Friday, October 30, 2026" })).toHaveAttribute(
			"aria-current",
			"date",
		);
	});
});

describe("adapter details", () => {
	it("formats the current time and parses strictly", () => {
		const dates = new MomentDateFormatter(moment);
		expect(dates.formatNow("YYYY")).toBe(String(new Date().getFullYear()));
		expect(dates.parse("2026-13-01", "YYYY-MM-DD")).toBeNull();
		expect(dates.weekdayShort(0)).toBe("Sun");
		expect(dates.weekdayShort(9)).toBe("");
	});

	it("orders several running clocks and stops them all", async () => {
		const harness = await loadPlugin({
			today: "2026-10-29",
			minutes: 12 * 60,
			files: {
				"a.md": "- [ ] A\n\t- [clock::2026-10-29T08:00--]\n- [ ] B\n\t- [clock::2026-10-28T08:00--]\n- [ ] C\n\t- [clock::2026-10-29T07:00--]",
			},
		});
		await act(() => sleep(10));
		const { clocks } = harness.container;
		expect(clocks.running.get().map((running) => running.task.text)).toEqual(["B", "C", "A"]);
		expect(clocks.active()?.task.text).toBe("A");
		expect(clocks.rangesOn("2026-10-29").map((range) => [range.title, range.running])).toEqual([
			["B", true],
			["C", true],
			["A", true],
		]);
		expect((await clocks.stop()).ok).toBe(true);
		expect(clocks.running.get()).toHaveLength(0);
	});

	it("reports clock edits on changed or missing lines", async () => {
		const harness = await loadPlugin({
			today: "2026-10-29",
			files: { "a.md": "- [ ] A\n- plain" },
		});
		await act(() => sleep(10));
		const { clocks } = harness.container;
		const plain = await clocks.start({ path: "a.md", line: 1, raw: "- plain" });
		expect(!plain.ok && plain.error.message).toBe("That line is not a task.");
		const gone = await clocks.start({ path: "a.md", line: 0, raw: "- [ ] Z" });
		expect(!gone.ok && gone.error.message).toBe(
			"The note changed since it was read. Try again.",
		);
		await clocks.start({ path: "a.md", line: 0, raw: "- [ ] A" });
		await act(() => sleep(10));
		const file = harness.app.vault.getFileByPath("a.md");
		if (!file) {
			throw new Error("missing");
		}
		const running = clocks.running.get()[0];
		await harness.app.vault.process(file, (text) => text.replace("[clock::", "[clock:: "));
		if (running) {
			const stale = await harness.container.linter.closeClock({
				kind: "close-clock",
				path: "a.md",
				line: running.clock.line,
				raw: running.clock.raw,
			});
			expect(stale.ok).toBe(false);
		}
	});
});

describe("small paths", () => {
	it("shows the required plugins on demand", async () => {
		const harness = await loadPlugin();
		harness.plugin.runCommand("show-required-plugins");
		await act(() => sleep(0));
		expect(harness.app.workspace.getLeavesOfType("sbos-setup")).toHaveLength(1);
	});

	it("ignores opening a missing note and stops reporting after unsubscribing", async () => {
		const harness = await loadPlugin({ files: { "a.md": "" } });
		const { workspace } = harness.container;
		await workspace.open("missing.md");
		expect(harness.app.workspace.getActiveFile()).toBeNull();
		const seen: (string | null)[] = [];
		const stop = workspace.onActiveChange((path) => seen.push(path));
		await workspace.open("a.md");
		stop();
		harness.app.workspace.setActiveFile(null);
		expect(seen).toEqual(["a.md"]);
	});

	it("edits the start time of a new block", async () => {
		const harness = await loadPlugin({ today: "2026-10-29", minutes: 8 * 60 });
		act(() => {
			harness.plugin.runCommand("add-time-block");
		});
		const start = screen.getByLabelText("Start");
		await userEvent.clear(start);
		await userEvent.type(start, "07:30");
		await userEvent.type(screen.getByRole("textbox", { name: "Title" }), "Early");
		await userEvent.click(screen.getByRole("button", { name: "Add block" }));
		await act(() => sleep(10));
		expect(harness.app.vault.contentOf("2026-10-29.md")).toContain("- [ ] 07:30 - 08:30 Early");
	});
});
