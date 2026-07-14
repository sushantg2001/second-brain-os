import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, getFormat, mergeSettings } from "../../src/settings";

describe("mergeSettings", () => {
	it("returns defaults for empty data", () => {
		expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
	});

	it("keeps stored top-level values", () => {
		const merged = mergeSettings({ weekStart: "monday" });
		expect(merged.weekStart).toBe("monday");
		expect(merged.confirmBeforeCreate).toBe(true);
	});

	it("merges partial per-granularity configs with defaults", () => {
		const merged = mergeSettings({
			notes: { week: { enabled: true, folder: "weekly" } },
		});
		expect(merged.notes.week.enabled).toBe(true);
		expect(merged.notes.week.folder).toBe("weekly");
		expect(merged.notes.week.format).toBe("");
		expect(merged.notes.day.enabled).toBe(true);
		expect(merged.notes.year).toEqual(DEFAULT_SETTINGS.notes.year);
	});

	it("does not mutate the defaults", () => {
		const merged = mergeSettings({ notes: { day: { folder: "journal" } } });
		merged.notes.day.folder = "changed";
		expect(DEFAULT_SETTINGS.notes.day.folder).toBe("");
	});
});

describe("getFormat", () => {
	it("falls back to the default format per granularity", () => {
		expect(getFormat(DEFAULT_SETTINGS, "day")).toBe("YYYY-MM-DD");
		expect(getFormat(DEFAULT_SETTINGS, "week")).toBe("gggg-[W]ww");
		expect(getFormat(DEFAULT_SETTINGS, "quarter")).toBe("YYYY-[Q]Q");
	});

	it("prefers the configured format", () => {
		const settings = mergeSettings({
			notes: { day: { format: "DD-MM-YYYY" } },
		});
		expect(getFormat(settings, "day")).toBe("DD-MM-YYYY");
	});
});
