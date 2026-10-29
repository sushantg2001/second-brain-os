import { describe, expect, it } from "bun:test";

import { nextVersion } from "../../../scripts/version";

describe("nextVersion", () => {
	it("bumps each part and resets lower parts", () => {
		expect(nextVersion("1.2.3", "patch")).toBe("1.2.4");
		expect(nextVersion("1.2.3", "minor")).toBe("1.3.0");
		expect(nextVersion("1.2.3", "major")).toBe("2.0.0");
	});

	it("accepts an explicit version", () => {
		expect(nextVersion("1.2.3", "4.0.0")).toBe("4.0.0");
		expect(nextVersion("1.2.3", "2.0.0-alpha.1")).toBe("2.0.0-alpha.1");
	});

	it("rejects anything else", () => {
		expect(() => nextVersion("1.2.3", "next")).toThrow();
		expect(() => nextVersion("v1", "patch")).toThrow();
	});
});
