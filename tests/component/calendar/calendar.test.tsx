import { describe, expect, it } from "bun:test";
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderCalendar } from "../../fakes/calendar-harness";

describe("Calendar", () => {
	it("shows the current month with weekday headers starting on the chosen day", async () => {
		await renderCalendar({ settings: { weekStart: "monday" } });
		const grid = screen.getByRole("grid", { name: "October 2026" });
		const headers = within(grid)
			.getAllByRole("columnheader")
			.map((header) => header.textContent);
		expect(headers).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
		expect(within(grid).getAllByRole("row")).toHaveLength(6);
	});

	it("marks today, days with notes and the active note", async () => {
		await renderCalendar({
			files: { "2026-10-20.md": "" },
			activePath: "2026-10-20.md",
		});
		const today = screen.getByRole("button", { name: "Thursday, October 29, 2026" });
		expect(today).toHaveAttribute("aria-current", "date");
		expect(today).toHaveAttribute("tabindex", "0");
		const withNote = screen.getByRole("button", {
			name: "Tuesday, October 20, 2026, has note",
		});
		expect(withNote).toHaveClass("has-note");
		expect(withNote).toHaveClass("is-active");
		expect(withNote.closest("td")).toHaveAttribute("aria-selected", "true");
	});

	it("updates dots when notes are created", async () => {
		const { periodic } = await renderCalendar();
		await act(async () => {
			await periodic.ensure("day", "2026-10-05");
		});
		expect(
			screen.getByRole("button", { name: "Monday, October 5, 2026, has note" }),
		).toBeInTheDocument();
	});

	it("opens the clicked day, in a split with Ctrl or Cmd", async () => {
		const { calls } = await renderCalendar();
		fireEvent.click(screen.getByRole("button", { name: "Friday, October 9, 2026" }));
		fireEvent.click(screen.getByRole("button", { name: "Saturday, October 10, 2026" }), {
			metaKey: true,
		});
		expect(calls).toEqual([
			{ granularity: "day", date: "2026-10-09", split: false },
			{ granularity: "day", date: "2026-10-10", split: true },
		]);
	});

	it("navigates months with the buttons and returns to today", async () => {
		const user = userEvent.setup();
		await renderCalendar();
		await user.click(screen.getByRole("button", { name: "Next month" }));
		expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Previous month" }));
		await user.click(screen.getByRole("button", { name: "Previous month" }));
		expect(screen.getByRole("grid", { name: "September 2026" })).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Today" }));
		expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
	});

	it("moves focus with the keyboard", async () => {
		const user = userEvent.setup();
		await renderCalendar({ settings: { weekStart: "monday" } });
		await user.click(screen.getByRole("button", { name: "Thursday, October 29, 2026" }));
		await user.keyboard("{ArrowRight}");
		expect(document.activeElement).toHaveAccessibleName("Friday, October 30, 2026");
		await user.keyboard("{ArrowDown}");
		expect(document.activeElement).toHaveAccessibleName("Friday, November 6, 2026");
		expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument();
		await user.keyboard("{Home}");
		expect(document.activeElement).toHaveAccessibleName("Monday, November 2, 2026");
		await user.keyboard("{End}");
		expect(document.activeElement).toHaveAccessibleName("Sunday, November 8, 2026");
		await user.keyboard("{ArrowUp}{ArrowLeft}");
		expect(document.activeElement).toHaveAccessibleName("Saturday, October 31, 2026");
		await user.keyboard("{PageUp}");
		expect(document.activeElement).toHaveAccessibleName("Wednesday, September 30, 2026");
		await user.keyboard("{Shift>}{PageDown}{/Shift}");
		expect(screen.getByRole("grid", { name: "September 2027" })).toBeInTheDocument();
	});

	it("shows week numbers that open weekly notes", async () => {
		const { calls } = await renderCalendar({
			settings: { weekStart: "monday", showWeekNumbers: true },
		});
		fireEvent.click(screen.getByRole("button", { name: "Open week 44 note" }));
		expect(calls).toEqual([{ granularity: "week", date: "2026-10-26", split: false }]);
	});

	it("shows week numbers as text when weekly notes are off", async () => {
		await renderCalendar({
			settings: { showWeekNumbers: true, notes: { week: { enabled: false } } },
		});
		expect(screen.queryByRole("button", { name: /^Open week/ })).toBeNull();
		expect(screen.getAllByRole("rowheader").length).toBeGreaterThan(3);
	});

	it("opens month and year notes from the title when they are enabled", async () => {
		const { calls } = await renderCalendar({
			settings: { notes: { month: { enabled: true }, year: { enabled: true } } },
		});
		fireEvent.click(screen.getByRole("button", { name: "Open October 2026 note" }));
		fireEvent.click(screen.getByRole("button", { name: "Open 2026 note" }));
		expect(calls.map((call) => call.granularity)).toEqual(["month", "year"]);
	});

	it("opens the jump-to-date picker", async () => {
		const harness = await renderCalendar();
		fireEvent.click(screen.getByRole("button", { name: "Jump to date" }));
		expect(harness.jumps()).toBe(1);
	});

	it("shows badges from other features", async () => {
		const { badges } = await renderCalendar();
		act(() => badges.set(new Map([["2026-10-29", [{ text: "2h", label: "2h planned" }]]])));
		const day = screen.getByRole("button", { name: "Thursday, October 29, 2026, 2h planned" });
		expect(day).toHaveTextContent("292h");
	});
});
