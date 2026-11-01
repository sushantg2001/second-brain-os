import { describe, expect, it } from "bun:test";
import { act, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { TimelineView } from "../../src/features/planner";
import { loadPlugin, sleep } from "../fakes/plugin-harness";

async function setup(files: Record<string, string> = {}, today = "2026-10-29") {
	const harness = await loadPlugin({ files, today, minutes: 9 * 60 });
	await act(() => sleep(10));
	const view = harness.app.workspace.getLeavesOfType("sbos-timeline")[0]
		?.view as unknown as TimelineView;
	document.body.append(view.containerEl);
	await act(() => sleep(0));
	return { ...harness, view, ui: within(view.contentEl) };
}

describe("calendar inside the day planner", () => {
	it("shows the month above the timeline on the same day", async () => {
		const { ui } = await setup({ "2026-10-29.md": "- [ ] 10:00 - 11:00 Plan" });
		expect(ui.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
		expect(
			ui.getByRole("button", { name: "Open daily note for Thursday, October 29" }),
		).toBeInTheDocument();
		expect(
			ui.getByRole("button", { name: "Thursday, October 29, 2026, has note, 1h planned" }),
		).toHaveAttribute("tabindex", "0");
		expect(ui.getAllByRole("button", { name: "Today" })).toHaveLength(1);
	});

	it("shows a day's plan and opens its note when the day is picked in the calendar", async () => {
		const { ui, app } = await setup({ "2026-10-20.md": "- [ ] 09:00 - 09:30 Earlier" });
		await act(async () => {
			fireEvent.click(ui.getByRole("button", { name: /^Tuesday, October 20, 2026/ }));
			await sleep(0);
		});
		expect(
			ui.getByRole("button", { name: "Open daily note for Tuesday, October 20" }),
		).toBeInTheDocument();
		expect(ui.getByRole("button", { name: "09:00 to 09:30, Earlier" })).toBeInTheDocument();
		expect(app.workspace.getActiveFile()?.path).toBe("2026-10-20.md");
	});

	it("moves the calendar when the timeline moves", async () => {
		const { ui } = await setup({}, "2026-10-31");
		await userEvent.click(ui.getByRole("button", { name: "Next day" }));
		expect(ui.getByRole("grid", { name: "November 2026" })).toBeInTheDocument();
		expect(ui.getByRole("button", { name: "Sunday, November 1, 2026" })).toHaveAttribute(
			"tabindex",
			"0",
		);
		await userEvent.click(ui.getByRole("button", { name: "Today" }));
		expect(ui.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
	});

	it("follows keyboard moves in the calendar", async () => {
		const { ui } = await setup();
		ui.getByRole("button", { name: "Thursday, October 29, 2026" }).focus();
		await userEvent.keyboard("{ArrowDown}");
		expect(
			ui.getByRole("button", { name: "Open daily note for Thursday, November 5" }),
		).toBeInTheDocument();
	});

	it("opens the daily note from the timeline title", async () => {
		const { ui, app } = await setup();
		await userEvent.click(
			ui.getByRole("button", { name: "Open daily note for Thursday, October 29" }),
		);
		await act(() => sleep(10));
		expect(app.workspace.getActiveFile()?.path).toBe("2026-10-29.md");
	});

	it("hides and shows the calendar, and remembers it", async () => {
		const { ui, container } = await setup();
		await userEvent.click(ui.getByRole("button", { name: "Hide calendar" }));
		await act(() => sleep(0));
		expect(ui.queryByRole("grid")).toBeNull();
		expect(container.settings.section("planner").store.get().showCalendar).toBe(false);
		expect(ui.getByRole("button", { name: "Show calendar" })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
		await userEvent.click(ui.getByRole("button", { name: "Show calendar" }));
		await act(() => sleep(0));
		expect(ui.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
	});

	it("keeps the multi-day view free of the calendar, with day headers that open notes", async () => {
		const harness = await setup();
		harness.plugin.runCommand("open-multi-day-planner");
		await act(() => sleep(0));
		const multi = harness.app.workspace
			.getLeavesOfType("sbos-timeline")
			.map((leaf) => leaf.view as unknown as TimelineView)
			.find((view) => view.state.get().days === 3);
		document.body.append(multi?.containerEl ?? document.createElement("div"));
		await act(() => sleep(0));
		const ui = within(multi?.contentEl ?? document.body);
		expect(ui.queryByRole("grid")).toBeNull();
		await userEvent.click(
			ui.getByRole("button", { name: "Open daily note for Friday, October 30" }),
		);
		await act(() => sleep(10));
		expect(harness.app.workspace.getActiveFile()?.path).toBe("2026-10-30.md");
	});

	it("can be turned off in settings", async () => {
		const { plugin, container } = await setup();
		const tab = plugin.settingTabs[0];
		if (!tab) {
			throw new Error("No settings tab");
		}
		document.body.append(tab.containerEl);
		tab.display();
		fireEvent.click(
			within(tab.containerEl).getByRole("checkbox", {
				name: "Show the calendar in the day planner",
			}),
		);
		await act(() => sleep(0));
		expect(container.settings.section("planner").store.get().showCalendar).toBe(false);
	});
});
