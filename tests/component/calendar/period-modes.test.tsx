import { describe, expect, it } from "bun:test";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderCalendar } from "../../fakes/calendar-harness";

const ALL_ON = {
	notes: { month: { enabled: true }, quarter: { enabled: true }, year: { enabled: true } },
};

const tab = (name: string) => screen.getByRole("tab", { name });

describe("Calendar period tabs", () => {
	it("offers a tab per kind of note, starting on days", async () => {
		await renderCalendar();
		const tabs = within(screen.getByRole("tablist", { name: "Kind of note" })).getAllByRole(
			"tab",
		);
		expect(tabs.map((item) => item.textContent)).toEqual([
			"Day",
			"Week",
			"Month",
			"Quarter",
			"Year",
		]);
		expect(tab("Day")).toHaveAttribute("aria-selected", "true");
		expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
	});

	it("has no tabs inside the day planner", async () => {
		await renderCalendar({ embedded: true });
		expect(screen.queryByRole("tablist")).toBeNull();
		expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
	});

	it("opens quarterly notes from the quarter tab", async () => {
		const user = userEvent.setup();
		const { calls } = await renderCalendar({ settings: ALL_ON });
		await user.click(tab("Quarter"));
		expect(tab("Quarter")).toHaveAttribute("aria-selected", "true");
		const quarters = within(screen.getByRole("group", { name: "Pick a quarter" })).getAllByRole(
			"button",
		);
		expect(quarters.map((button) => button.textContent)).toEqual([
			"Q1Jan – Mar",
			"Q2Apr – Jun",
			"Q3Jul – Sep",
			"Q4Oct – Dec",
		]);
		expect(screen.getByRole("button", { name: "Q4 2026" })).toHaveAttribute(
			"aria-current",
			"date",
		);
		await user.click(screen.getByRole("button", { name: "Q2 2026" }));
		fireEvent.click(screen.getByRole("button", { name: "Q3 2026" }), { ctrlKey: true });
		expect(calls).toEqual([
			{ granularity: "quarter", date: "2026-04-01", split: false },
			{ granularity: "quarter", date: "2026-07-01", split: true },
		]);
	});

	it("marks quarters that have a note, and the one that is open", async () => {
		const user = userEvent.setup();
		await renderCalendar({
			settings: ALL_ON,
			files: { "2026-Q3.md": "", "2026-Q4.md": "" },
			activePath: "2026-Q4.md",
		});
		await user.click(tab("Quarter"));
		expect(screen.getByRole("button", { name: "Q3 2026, has note" })).toHaveClass("has-note");
		expect(screen.getByRole("button", { name: "Q4 2026, has note" })).toHaveClass("is-active");
		expect(screen.getByRole("button", { name: "Q1 2026" })).not.toHaveClass("has-note");
	});

	it("moves by year in the quarter and month tabs, and by decade in the year tab", async () => {
		const user = userEvent.setup();
		await renderCalendar({ settings: ALL_ON });
		await user.click(tab("Quarter"));
		await user.click(screen.getByRole("button", { name: "Next year" }));
		expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("2027");
		expect(screen.getByRole("button", { name: "Q1 2027" })).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Today" }));
		expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("2026");
		await user.click(tab("Year"));
		expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("2020 – 2029");
		await user.click(screen.getByRole("button", { name: "Previous decade" }));
		expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("2010 – 2019");
	});

	it("lists the months of the year and the years of the decade", async () => {
		const user = userEvent.setup();
		const { calls } = await renderCalendar({ settings: ALL_ON });
		await user.click(tab("Month"));
		const months = within(screen.getByRole("group", { name: "Pick a month" })).getAllByRole(
			"button",
		);
		expect(months).toHaveLength(12);
		await user.click(screen.getByRole("button", { name: "Mar" }));
		await user.click(tab("Year"));
		const years = within(screen.getByRole("group", { name: "Pick a year" })).getAllByRole(
			"button",
		);
		expect(years.map((button) => button.textContent)).toEqual([
			"2019",
			"2020",
			"2021",
			"2022",
			"2023",
			"2024",
			"2025",
			"2026",
			"2027",
			"2028",
			"2029",
			"2030",
		]);
		await user.click(screen.getByRole("button", { name: "2024" }));
		expect(calls).toEqual([
			{ granularity: "month", date: "2026-03-01", split: false },
			{ granularity: "year", date: "2024-01-01", split: false },
		]);
	});

	it("offers to turn on notes that are off", async () => {
		const user = userEvent.setup();
		const { enabled, calls } = await renderCalendar();
		await user.click(tab("Quarter"));
		expect(screen.getByText("Quarterly notes are off.")).toBeInTheDocument();
		expect(screen.queryByRole("group", { name: "Pick a quarter" })).toBeNull();
		await user.click(screen.getByRole("button", { name: "Turn on quarterly notes" }));
		expect(enabled).toEqual(["quarter"]);
		expect(calls).toEqual([]);
	});

	it("opens the note for the current period on a double click", async () => {
		const user = userEvent.setup();
		const { calls } = await renderCalendar({ settings: ALL_ON });
		await user.dblClick(tab("Quarter"));
		expect(tab("Quarter")).toHaveAttribute("aria-selected", "true");
		expect(calls).toEqual([{ granularity: "quarter", date: "2026-10-29", split: false }]);
	});

	it("does not open anything on a double click when those notes are off", async () => {
		const user = userEvent.setup();
		const { calls } = await renderCalendar();
		await user.dblClick(tab("Year"));
		expect(calls).toEqual([]);
		expect(screen.getByText("Yearly notes are off.")).toBeInTheDocument();
	});

	it("picks whole weeks in the week tab, with week numbers on", async () => {
		const user = userEvent.setup();
		const { calls } = await renderCalendar({ settings: { weekStart: "monday" } });
		await user.click(tab("Week"));
		expect(screen.getByRole("button", { name: "Open week 44 note" })).toBeInTheDocument();
		await user.click(
			screen.getByRole("button", { name: "Week 44, Thursday, October 29, 2026" }),
		);
		expect(calls).toEqual([{ granularity: "week", date: "2026-10-29", split: false }]);
	});

	it("shows a quarter tag next to the year when quarterly notes are on", async () => {
		const user = userEvent.setup();
		const { calls } = await renderCalendar({ settings: ALL_ON, files: { "2026-Q4.md": "" } });
		const chip = screen.getByRole("button", { name: "Open Q4 2026 note" });
		expect(chip).toHaveTextContent("Q4");
		expect(chip).toHaveClass("has-note");
		await user.click(chip);
		expect(calls).toEqual([{ granularity: "quarter", date: "2026-10-01", split: false }]);
	});

	it("leaves the quarter tag out when quarterly notes are off", async () => {
		await renderCalendar();
		expect(screen.queryByRole("button", { name: /^Open Q\d/ })).toBeNull();
	});
});
