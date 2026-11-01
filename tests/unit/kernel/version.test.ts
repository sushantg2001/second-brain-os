import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import { compareVersions, isAtLeast, parseVersion, type Version } from "../../../src/shared/kernel";

function parsed(text: string): Version {
	const version = parseVersion(text);
	if (!version) {
		throw new Error(`fixture ${text} does not parse`);
	}
	return version;
}

const versionArbitrary: fc.Arbitrary<Version> = fc.record({
	major: fc.nat(20),
	minor: fc.nat(20),
	patch: fc.nat(20),
	prerelease: fc.oneof(
		fc.constant([]),
		fc.array(fc.oneof(fc.constantFrom("alpha", "beta", "rc"), fc.nat(5).map(String)), {
			minLength: 1,
			maxLength: 3,
		}),
	),
});

describe("parseVersion", () => {
	it("parses core and prerelease parts", () => {
		expect(parseVersion("1.2.3-beta.4+build.5")).toEqual({
			major: 1,
			minor: 2,
			patch: 3,
			prerelease: ["beta", "4"],
		});
	});

	it.each(["v1.0.0", "1.0", "01.0.0", "1.0.0-", "", "1.0.0.0", "latest"])(
		"rejects %p",
		(text) => {
			expect(parseVersion(text)).toBeNull();
		},
	);
});

describe("compareVersions", () => {
	it("orders the SemVer specification example list", () => {
		const ordered = [
			"1.0.0-alpha",
			"1.0.0-alpha.1",
			"1.0.0-alpha.beta",
			"1.0.0-beta",
			"1.0.0-beta.2",
			"1.0.0-beta.11",
			"1.0.0-rc.1",
			"1.0.0",
			"1.0.1",
			"1.1.0",
			"2.0.0",
		];
		for (let i = 0; i < ordered.length - 1; i++) {
			const left = parsed(ordered[i] ?? "");
			const right = parsed(ordered[i + 1] ?? "");
			expect(compareVersions(left, right)).toBeLessThan(0);
			expect(compareVersions(right, left)).toBeGreaterThan(0);
		}
	});

	it("is reflexive", () => {
		fc.assert(fc.property(versionArbitrary, (v) => compareVersions(v, v) === 0));
	});

	it("is antisymmetric", () => {
		fc.assert(
			fc.property(
				versionArbitrary,
				versionArbitrary,
				(a, b) => Math.sign(compareVersions(a, b)) === -Math.sign(compareVersions(b, a)),
			),
		);
	});

	it("is transitive", () => {
		fc.assert(
			fc.property(versionArbitrary, versionArbitrary, versionArbitrary, (a, b, c) => {
				const [x, y, z] = [a, b, c].sort(compareVersions);
				return (
					x !== undefined &&
					y !== undefined &&
					z !== undefined &&
					compareVersions(x, z) <= 0 &&
					compareVersions(x, y) <= 0 &&
					compareVersions(y, z) <= 0
				);
			}),
		);
	});
});

describe("isAtLeast", () => {
	it.each([
		["0.5.68", "0.5.64", true],
		["0.5.64", "0.5.64", true],
		["0.5.63", "0.5.64", false],
		["2.0.0-beta.1", "2.0.0", false],
		["garbage", "1.0.0", false],
		["1.0.0", "garbage", false],
	])("%p >= %p is %p", (actual, minimum, expected) => {
		expect(isAtLeast(actual, minimum)).toBe(expected);
	});
});
