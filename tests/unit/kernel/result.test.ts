import { describe, expect, it } from "bun:test";

import { err, ok } from "../../../src/shared/kernel";

describe("Result", () => {
	it("wraps a success value", () => {
		expect(ok(3)).toEqual({ ok: true, value: 3 });
	});

	it("wraps a failure", () => {
		const error = new Error("nope");
		expect(err(error)).toEqual({ ok: false, error });
	});
});
