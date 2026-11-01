import { describe, expect, it } from "bun:test";

import { DEFAULT_PERIODIC_SETTINGS, importForeignSettings } from "../../../src/features/periodic";

describe("importForeignSettings", () => {
	it("reads Periodic Notes sections and Calendar options", () => {
		const { settings, imported } = importForeignSettings(DEFAULT_PERIODIC_SETTINGS, {
			periodicNotes: {
				daily: {
					enabled: true,
					format: "DD-MM-YYYY",
					folder: "Journal",
					template: "T/Day",
				},
				monthly: { enabled: true, format: "YYYY-MM" },
				weekly: "nonsense",
			},
			calendar: {
				weekStart: "monday",
				shouldConfirmBeforeCreate: true,
				showWeeklyNote: true,
			},
		});
		expect(settings.notes.day).toEqual({
			enabled: true,
			format: "DD-MM-YYYY",
			folder: "Journal",
			template: "T/Day",
		});
		expect(settings.notes.month).toEqual({
			enabled: true,
			format: "YYYY-MM",
			folder: "",
			template: "",
		});
		expect(settings.notes.week).toEqual(DEFAULT_PERIODIC_SETTINGS.notes.week);
		expect(settings).toMatchObject({
			weekStart: "monday",
			confirmBeforeCreate: true,
			showWeekNumbers: true,
		});
		expect(imported).toEqual([
			"daily notes",
			"monthly notes",
			"week start",
			"confirm before create",
			"week numbers",
		]);
	});

	it("reads this plugin's 1.x settings", () => {
		const { settings, imported } = importForeignSettings(DEFAULT_PERIODIC_SETTINGS, {
			periodicNotes: {
				notes: { year: { enabled: true, format: "YYYY", folder: "Years", template: "" } },
				weekStart: "sunday",
				confirmBeforeCreate: false,
				showWeekNumbers: true,
			},
		});
		expect(settings.notes.year.folder).toBe("Years");
		expect(settings.weekStart).toBe("sunday");
		expect(imported).toEqual([
			"yearly notes",
			"week start",
			"confirm before create",
			"week numbers",
		]);
	});

	it("ignores missing and invalid values", () => {
		const result = importForeignSettings(DEFAULT_PERIODIC_SETTINGS, {
			periodicNotes: [1, 2],
			calendar: { weekStart: "someday", shouldConfirmBeforeCreate: "yes" },
		});
		expect(result).toEqual({ settings: DEFAULT_PERIODIC_SETTINGS, imported: [] });
		expect(importForeignSettings(DEFAULT_PERIODIC_SETTINGS, {}).imported).toEqual([]);
	});
});
