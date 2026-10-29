import { describe, expect, it } from "bun:test";
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Modal } from "../mocks/obsidian";
import { loadPlugin, sleep } from "../fakes/plugin-harness";

/** Opens the standalone calendar view (the day planner shows its own calendar by default). */
async function calendarIn(harness: Awaited<ReturnType<typeof loadPlugin>>) {
	harness.plugin.runCommand("open-calendar");
	await act(() => sleep(0));
	const leaf = harness.app.workspace.getLeavesOfType("sbos-calendar")[0];
	if (!leaf?.view) {
		throw new Error("Calendar view is not open");
	}
	document.body.append(leaf.view.containerEl);
	await act(() => sleep(0));
	return within(leaf.view.contentEl);
}

describe("calendar module", () => {
	it("opens the day's note from the sidebar calendar", async () => {
		const harness = await loadPlugin({ today: "2026-10-29" });
		const calendar = await calendarIn(harness);
		await act(async () => {
			fireEvent.click(calendar.getByRole("button", { name: "Friday, October 30, 2026" }));
			await sleep(0);
		});
		expect(harness.app.workspace.getActiveFile()?.path).toBe("2026-10-30.md");
		expect(
			calendar.getByRole("button", { name: "Friday, October 30, 2026, has note" }),
		).toBeInTheDocument();
	});

	it("asks before creating when confirmation is on", async () => {
		const harness = await loadPlugin({ today: "2026-10-29" });
		await harness.container.settings
			.section("periodic")
			.update((settings) => ({ ...settings, confirmBeforeCreate: true }));
		const calendar = await calendarIn(harness);

		await act(async () => {
			fireEvent.click(calendar.getByRole("button", { name: "Friday, October 30, 2026" }));
			await sleep(0);
		});
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await act(() => sleep(0));
		expect(harness.app.vault.getAbstractFileByPath("2026-10-30.md")).toBeNull();

		await act(async () => {
			fireEvent.click(calendar.getByRole("button", { name: "Friday, October 30, 2026" }));
			await sleep(0);
		});
		expect(
			screen.getByText("2026-10-30 does not exist yet. Create the daily note?"),
		).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Create" }));
		await act(() => sleep(0));
		expect(harness.app.vault.getAbstractFileByPath("2026-10-30.md")).not.toBeNull();
	});

	it("jumps to a picked month", async () => {
		const harness = await loadPlugin({ today: "2026-10-29" });
		const calendar = await calendarIn(harness);
		act(() => {
			harness.plugin.runCommand("jump-to-date");
		});
		const year = screen.getByRole("textbox", { name: "Year" });
		await userEvent.clear(year);
		await userEvent.type(year, "2020");
		await userEvent.click(screen.getByRole("button", { name: "February 2020" }));
		expect(calendar.getByRole("grid", { name: "February 2020" })).toBeInTheDocument();
		expect(Modal.open).toHaveLength(0);
	});

	it("reveals the active periodic note", async () => {
		const harness = await loadPlugin({
			files: { "2025-03-14.md": "", "notes.md": "" },
			today: "2026-10-29",
		});
		const calendar = await calendarIn(harness);
		expect(harness.plugin.runCommand("reveal-active-note")).toBe(false);
		await harness.container.workspace.open("notes.md");
		expect(harness.plugin.runCommand("reveal-active-note")).toBe(false);
		await harness.container.workspace.open("2025-03-14.md");
		act(() => {
			harness.plugin.runCommand("reveal-active-note");
		});
		expect(calendar.getByRole("grid", { name: "March 2025" })).toBeInTheDocument();
		const day = calendar.getByRole("button", { name: "Friday, March 14, 2025, has note" });
		expect(day).toHaveClass("is-active");
	});

	it("opens the calendar on demand after it was closed", async () => {
		const harness = await loadPlugin();
		harness.app.workspace.detachLeavesOfType("sbos-calendar");
		harness.plugin.runCommand("open-calendar");
		await sleep(0);
		expect(harness.app.workspace.getLeavesOfType("sbos-calendar")).toHaveLength(1);
	});
});

describe("CalendarView", () => {
	it("describes itself to the workspace", async () => {
		const harness = await loadPlugin();
		await calendarIn(harness);
		const view = harness.app.workspace.getLeavesOfType("sbos-calendar")[0]?.view;
		expect(view?.getViewType()).toBe("sbos-calendar");
		expect(view?.getDisplayText()).toBe("Calendar");
		expect(view?.getIcon()).toBe("calendar-days");
	});
});
