import { isAtLeast } from "../../../shared/kernel";

export interface RequiredPlugin {
	readonly id: string;
	readonly name: string;
	readonly minVersion: string;
	readonly purpose: string;
}

export interface InstalledPlugin {
	readonly installed: boolean;
	readonly enabled: boolean;
	readonly version: string | null;
}

export type DependencyState = "ready" | "missing" | "disabled" | "outdated";

export interface DependencyStatus {
	readonly plugin: RequiredPlugin;
	readonly state: DependencyState;
	readonly version: string | null;
}

export interface DependencyReport {
	readonly ready: boolean;
	readonly statuses: readonly DependencyStatus[];
}

export const REQUIRED_PLUGINS: readonly RequiredPlugin[] = [
	{
		id: "dataview",
		name: "Dataview",
		minVersion: "0.5.64",
		purpose: "Indexes notes, list items, tasks and inline fields.",
	},
	{
		id: "obsidian-tasks-plugin",
		name: "Tasks",
		minVersion: "7.0.0",
		purpose: "Owns task status symbols and the stage cycle.",
	},
	{
		id: "templater-obsidian",
		name: "Templater",
		minVersion: "2.0.0",
		purpose: "Creates notes from templates.",
	},
];

export function evaluateDependency(
	plugin: RequiredPlugin,
	installed: InstalledPlugin,
): DependencyStatus {
	const { version } = installed;
	if (!installed.installed) {
		return { plugin, state: "missing", version };
	}
	if (!installed.enabled) {
		return { plugin, state: "disabled", version };
	}
	if (version === null || !isAtLeast(version, plugin.minVersion)) {
		return { plugin, state: "outdated", version };
	}
	return { plugin, state: "ready", version };
}

export function evaluateDependencies(
	required: readonly RequiredPlugin[],
	lookup: (id: string) => InstalledPlugin,
): DependencyReport {
	const statuses = required.map((plugin) => evaluateDependency(plugin, lookup(plugin.id)));
	return { ready: statuses.every((status) => status.state === "ready"), statuses };
}
