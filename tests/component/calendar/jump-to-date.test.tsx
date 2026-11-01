import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { JumpToDate } from "../../../src/features/calendar";
import { dates } from "../../fakes/periodic-harness";

function setup() {
	const picks: [number, number][] = [];
	render(
		<JumpToDate
			dates={dates}
			initialYear={2026}
			currentMonth={10}
			onPick={(year, month) => picks.push([year, month])}
		/>,
	);
	return picks;
}

describe("JumpToDate", () => {
	it("picks a month in the typed year", async () => {
		const user = userEvent.setup();
		const picks = setup();
		const year = screen.getByRole("textbox", { name: "Year" });
		expect(year).toHaveFocus();
		await user.clear(year);
		await user.type(year, "1999");
		await user.click(screen.getByRole("button", { name: "March 1999" }));
		expect(picks).toEqual([[1999, 3]]);
	});

	it("keeps the current month on Enter", async () => {
		const user = userEvent.setup();
		const picks = setup();
		await user.type(
			screen.getByRole("textbox", { name: "Year" }),
			"{Backspace}{Backspace}30{Enter}",
		);
		expect(picks).toEqual([[2030, 10]]);
	});

	it("disables months for an invalid year", async () => {
		const user = userEvent.setup();
		const picks = setup();
		const year = screen.getByRole("textbox", { name: "Year" });
		await user.clear(year);
		await user.type(year, "20x6{Enter}");
		expect(year).toHaveAttribute("aria-invalid", "true");
		expect(screen.getByRole("button", { name: "March" })).toBeDisabled();
		expect(picks).toEqual([]);
	});
});
