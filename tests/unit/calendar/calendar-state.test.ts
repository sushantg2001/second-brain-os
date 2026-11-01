import { describe, expect, it } from "bun:test";

import { CalendarState } from "../../../src/features/calendar";

describe("CalendarState", () => {
	it("starts on today's month", () => {
		const state = new CalendarState("2026-10-29");
		expect(state.snapshot.get()).toEqual({ month: "2026-10-01", focused: "2026-10-29" });
	});

	it("follows focus across month boundaries", () => {
		const state = new CalendarState("2026-10-29");
		state.moveFocus(7);
		expect(state.snapshot.get()).toEqual({ month: "2026-11-01", focused: "2026-11-05" });
		state.moveFocus(-6);
		expect(state.snapshot.get().month).toBe("2026-10-01");
	});

	it("moves by months and clamps the day", () => {
		const state = new CalendarState("2026-01-31");
		state.moveMonths(1);
		expect(state.snapshot.get()).toEqual({ month: "2026-02-01", focused: "2026-02-28" });
		state.moveMonths(-12);
		expect(state.snapshot.get().focused).toBe("2025-02-28");
	});

	it("shows a picked month, keeping the day where possible", () => {
		const state = new CalendarState("2026-10-31");
		state.showMonth(2024, 2);
		expect(state.snapshot.get()).toEqual({ month: "2024-02-01", focused: "2024-02-29" });
		state.showMonth(2030, 7);
		expect(state.snapshot.get().focused).toBe("2030-07-29");
	});
});
