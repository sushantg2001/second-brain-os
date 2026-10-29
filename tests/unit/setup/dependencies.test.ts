import { describe, expect, it } from "bun:test";

import {
	evaluateDependencies,
	evaluateDependency,
	REQUIRED_PLUGINS,
	type RequiredPlugin,
} from "../../../src/features/setup";

const dataview: RequiredPlugin = {
	id: "dataview",
	name: "Dataview",
	minVersion: "0.5.64",
	purpose: "Index",
};

describe("evaluateDependency", () => {
	it("is missing when not installed", () => {
		expect(
			evaluateDependency(dataview, { installed: false, enabled: false, version: null }).state,
		).toBe("missing");
	});

	it("is disabled when installed but not enabled", () => {
		expect(
			evaluateDependency(dataview, { installed: true, enabled: false, version: "0.5.68" })
				.state,
		).toBe("disabled");
	});

	it("is outdated below the minimum version", () => {
		expect(
			evaluateDependency(dataview, { installed: true, enabled: true, version: "0.5.63" })
				.state,
		).toBe("outdated");
	});

	it("is outdated when the version is unknown", () => {
		expect(
			evaluateDependency(dataview, { installed: true, enabled: true, version: null }).state,
		).toBe("outdated");
	});

	it("is ready at or above the minimum version", () => {
		expect(
			evaluateDependency(dataview, { installed: true, enabled: true, version: "0.5.64" }),
		).toEqual({ plugin: dataview, state: "ready", version: "0.5.64" });
	});
});

describe("evaluateDependencies", () => {
	it("is ready only when every plugin is ready", () => {
		const report = evaluateDependencies(REQUIRED_PLUGINS, (id) =>
			id === "templater-obsidian"
				? { installed: false, enabled: false, version: null }
				: { installed: true, enabled: true, version: "99.0.0" },
		);

		expect(report.ready).toBe(false);
		expect(report.statuses.map((status) => status.state)).toEqual(["ready", "missing"]);
	});

	it("requires Tasks and Templater", () => {
		expect(REQUIRED_PLUGINS.map((plugin) => plugin.id)).toEqual([
			"obsidian-tasks-plugin",
			"templater-obsidian",
		]);
	});
});
