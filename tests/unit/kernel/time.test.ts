import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import {
	clampMinutes,
	formatDuration,
	formatTime,
	parseTime,
	snapMinutes,
} from "../../../src/shared/kernel";

describe("wall-clock times", () => {
	it("parses 24-hour and 12-hour times", () => {
		expect(parseTime("9:30")).toBe(570);
		expect(parseTime("09:05")).toBe(545);
		expect(parseTime("21:00")).toBe(1260);
		expect(parseTime("24:00")).toBe(1440);
		expect(parseTime("12:15 am")).toBe(15);
		expect(parseTime("12:15 PM")).toBe(735);
		expect(parseTime("1:00pm")).toBe(780);
	});

	it("rejects invalid times", () => {
		for (const text of ["25:00", "24:01", "9:60", "13:00 pm", "0:30 am", "9", "nine"]) {
			expect(parseTime(text)).toBeNull();
		}
	});

	it("round-trips formatting", () => {
		fc.assert(
			fc.property(fc.integer({ min: 0, max: 1440 }), (minutes) => {
				expect(parseTime(formatTime(minutes))).toBe(minutes);
			}),
		);
	});

	it("formats durations", () => {
		expect(formatDuration(45)).toBe("45m");
		expect(formatDuration(120)).toBe("2h");
		expect(formatDuration(90)).toBe("1h 30m");
		expect(formatDuration(-5)).toBe("0m");
	});

	it("clamps and snaps", () => {
		expect(clampMinutes(-10)).toBe(0);
		expect(clampMinutes(2000)).toBe(1440);
		expect(snapMinutes(67, 15)).toBe(60);
		expect(snapMinutes(68, 15)).toBe(75);
	});
});
