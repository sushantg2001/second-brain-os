import { beforeEach, describe, expect, it, vi } from "vitest";
import { moment } from "obsidian";
import type { Moment } from "moment";

import { Calendar } from "../../src/ui/calendar";

describe("Calendar", () => {
	let containerEl: HTMLElement;
	let callbacks: {
		hasDailyNote: ReturnType<typeof vi.fn>;
		hasWeeklyNote: ReturnType<typeof vi.fn>;
		onClickDay: ReturnType<typeof vi.fn>;
		onClickWeek: ReturnType<typeof vi.fn>;
		onTitleClick: ReturnType<typeof vi.fn>;
	};

	function createCalendar(options = { weekStart: "monday" as const, showWeekNumbers: false }) {
		const calendar = new Calendar(
			containerEl,
			options,
			callbacks,
		);
		calendar.setToday(moment("2024-01-15"));
		calendar.setDisplayedMonth(moment("2024-01-15"));
		return calendar;
	}

	function dayButton(day: string): HTMLButtonElement {
		const button = [...containerEl.querySelectorAll<HTMLButtonElement>(".cpn-day button")].find(
			(el) => el.childNodes[0]?.textContent === day && !el.classList.contains("cpn-adjacent-month"),
		);
		expect(button, `day cell ${day}`).toBeDefined();
		return button as HTMLButtonElement;
	}

	beforeEach(() => {
		containerEl = document.createElement("div");
		document.body.appendChild(containerEl);
		callbacks = {
			hasDailyNote: vi.fn().mockReturnValue(false),
			hasWeeklyNote: vi.fn().mockReturnValue(false),
			onClickDay: vi.fn(),
			onClickWeek: vi.fn(),
			onTitleClick: vi.fn(),
		};
	});

	it("renders the month title", () => {
		createCalendar();
		expect(containerEl.querySelector(".cpn-title")?.textContent).toBe("January 2024");
	});

	it("renders seven weekday headers without week numbers", () => {
		createCalendar();
		const headers = containerEl.querySelectorAll("th");
		expect(headers).toHaveLength(7);
		expect(headers[0]?.textContent).toBe("Mon");
	});

	it("renders a week number column when enabled", () => {
		createCalendar({ weekStart: "monday", showWeekNumbers: true });
		expect(containerEl.querySelectorAll("th")).toHaveLength(8);
		expect(containerEl.querySelectorAll(".cpn-weeknum").length).toBeGreaterThan(0);
	});

	it("marks today", () => {
		createCalendar();
		expect(dayButton("15").classList.contains("cpn-today")).toBe(true);
		expect(dayButton("14").classList.contains("cpn-today")).toBe(false);
	});

	it("dims days from adjacent months", () => {
		createCalendar();
		const adjacent = containerEl.querySelectorAll(".cpn-adjacent-month");
		expect(adjacent.length).toBeGreaterThan(0);
	});

	it("shows a dot for days with a note", () => {
		callbacks.hasDailyNote.mockImplementation((date: Moment) =>
			date.isSame(moment("2024-01-10"), "day"),
		);
		createCalendar();
		expect(dayButton("10").querySelector(".cpn-dot")).not.toBeNull();
		expect(dayButton("11").querySelector(".cpn-dot")).toBeNull();
	});

	it("invokes onClickDay with the clicked date", () => {
		createCalendar();
		dayButton("20").click();
		expect(callbacks.onClickDay).toHaveBeenCalledOnce();
		const [date, inNewSplit] = callbacks.onClickDay.mock.calls[0] as [Moment, boolean];
		expect(date.format("YYYY-MM-DD")).toBe("2024-01-20");
		expect(inNewSplit).toBe(false);
	});

	it("requests a new split on ctrl-click", () => {
		createCalendar();
		dayButton("20").dispatchEvent(
			new MouseEvent("click", { ctrlKey: true, bubbles: true }),
		);
		const [, inNewSplit] = callbacks.onClickDay.mock.calls[0] as [Moment, boolean];
		expect(inNewSplit).toBe(true);
	});

	it("invokes onClickWeek from the week number column", () => {
		createCalendar({ weekStart: "monday", showWeekNumbers: true });
		const weekButton = containerEl.querySelector<HTMLButtonElement>(".cpn-weeknum button");
		weekButton?.click();
		expect(callbacks.onClickWeek).toHaveBeenCalledOnce();
		const [date] = callbacks.onClickWeek.mock.calls[0] as [Moment];
		expect(date.format("YYYY-MM-DD")).toBe("2024-01-01");
	});

	it("navigates between months", () => {
		const calendar = createCalendar();
		const [prev, today, next] = containerEl.querySelectorAll<HTMLButtonElement>(".cpn-nav button");

		next?.click();
		expect(containerEl.querySelector(".cpn-title")?.textContent).toBe("February 2024");
		expect(calendar.getDisplayedMonth().format("YYYY-MM")).toBe("2024-02");

		prev?.click();
		prev?.click();
		expect(containerEl.querySelector(".cpn-title")?.textContent).toBe("December 2023");

		today?.click();
		expect(containerEl.querySelector(".cpn-title")?.textContent).toBe("January 2024");
	});

	it("invokes onTitleClick with the displayed month", () => {
		createCalendar();
		containerEl.querySelector<HTMLButtonElement>(".cpn-title")?.click();
		expect(callbacks.onTitleClick).toHaveBeenCalledOnce();
		const [displayed] = callbacks.onTitleClick.mock.calls[0] as [Moment];
		expect(displayed.format("YYYY-MM")).toBe("2024-01");
	});

	it("highlights the selected date", () => {
		const calendar = createCalendar();
		calendar.setSelectedDate(moment("2024-01-08"));
		expect(dayButton("8").classList.contains("cpn-selected")).toBe(true);
		calendar.setSelectedDate(null);
		expect(dayButton("8").classList.contains("cpn-selected")).toBe(false);
	});
});
