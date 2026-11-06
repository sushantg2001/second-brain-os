import { describe, expect, it } from "bun:test";

import { createPeriodicHarness } from "../../fakes/periodic-harness";

describe("PeriodicNotes.dateOf with nested folder formats", () => {
	it("maps a weekly note back to its week start despite a month folder", async () => {
		const { periodic } = await createPeriodicHarness({
			settings: {
				weekStart: "monday",
				notes: { week: { format: "YYYY/MMMM/WW/GGGG-[W]WW" } },
			},
		});
		expect(periodic.dateOf("week", "2026/September/40/2026-W40.md")).toBe("2026-09-28");
		expect(periodic.identify("2026/September/40/2026-W40.md")).toEqual({
			granularity: "week",
			date: "2026-09-28",
		});
	});

	it("resolves the ISO week 1 that starts in the previous year", async () => {
		const { periodic } = await createPeriodicHarness({
			settings: {
				weekStart: "monday",
				notes: { week: { format: "YYYY/MMMM/WW/GGGG-[W]WW" } },
			},
		});
		// ISO week 1 of 2026 starts on Monday 2025-12-29.
		expect(periodic.pathFor("week", "2025-12-29")).toBe("2025/December/01/2026-W01.md");
		expect(periodic.dateOf("week", "2025/December/01/2026-W01.md")).toBe("2025-12-29");
		expect(periodic.dateOf("week", "2026/January/01/2026-W01.md")).toBe("2025-12-29");
	});

	it("round-trips every week of a year through pathFor and dateOf", async () => {
		const { periodic } = await createPeriodicHarness({
			settings: {
				weekStart: "monday",
				notes: { week: { format: "YYYY/MMMM/WW/GGGG-[W]WW" } },
			},
		});
		for (let day = 0; day < 366; day += 1) {
			const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
			const start = periodic.periodOf("week", date);
			expect(periodic.dateOf("week", periodic.pathFor("week", date))).toBe(start);
		}
	});

	it("keeps the folder check for nested weekly notes", async () => {
		const { periodic } = await createPeriodicHarness({
			settings: {
				weekStart: "monday",
				notes: { week: { folder: "Weekly", format: "YYYY/MMMM/WW/GGGG-[W]WW" } },
			},
		});
		expect(periodic.dateOf("week", "Weekly/2026/September/40/2026-W40.md")).toBe("2026-09-28");
		expect(periodic.dateOf("week", "Other/2026/September/40/2026-W40.md")).toBeNull();
		expect(periodic.dateOf("week", "2026/September/40/2026-W40.md")).toBeNull();
	});

	it("rejects names that do not match the last format segment", async () => {
		const { periodic } = await createPeriodicHarness({
			settings: {
				weekStart: "monday",
				notes: { week: { format: "YYYY/MMMM/WW/GGGG-[W]WW" } },
			},
		});
		expect(periodic.dateOf("week", "2026/September/40/notes.md")).toBeNull();
		expect(periodic.dateOf("week", "2026-W40.md")).toBeNull();
	});

	it("still resolves daily, monthly, quarterly and yearly nested formats", async () => {
		const { periodic } = await createPeriodicHarness({
			settings: {
				weekStart: "monday",
				notes: {
					day: { format: "YYYY/MMMM/WW/YYYY-MM-DD" },
					month: { enabled: true, format: "YYYY/MMMM/YYYY-MM" },
					quarter: { enabled: true, format: "YYYY/YYYY-[Q]Q" },
					year: { enabled: true, format: "YYYY/YYYY" },
				},
			},
		});
		expect(periodic.dateOf("day", "2026/September/40/2026-09-29.md")).toBe("2026-09-29");
		expect(periodic.dateOf("month", "2026/September/2026-09.md")).toBe("2026-09-01");
		expect(periodic.dateOf("quarter", "2026/2026-Q3.md")).toBe("2026-07-01");
		expect(periodic.dateOf("year", "2026/2026.md")).toBe("2026-01-01");
	});
});
