import type { InstalledPlugin, PluginRegistry } from "../../src/features/setup";

export interface FakePlugin {
	readonly id: string;
	readonly version: string;
	readonly enabled: boolean;
}

export class FakePluginRegistry implements PluginRegistry {
	readonly #plugins = new Map<string, FakePlugin>();

	constructor(plugins: readonly FakePlugin[] = []) {
		for (const plugin of plugins) {
			this.set(plugin);
		}
	}

	set(plugin: FakePlugin): void {
		this.#plugins.set(plugin.id, plugin);
	}

	remove(id: string): void {
		this.#plugins.delete(id);
	}

	describe(id: string): InstalledPlugin {
		const plugin = this.#plugins.get(id);
		return plugin
			? { installed: true, enabled: plugin.enabled, version: plugin.version }
			: { installed: false, enabled: false, version: null };
	}
}

export const READY_PLUGINS: readonly FakePlugin[] = [
	{ id: "datacore", version: "0.1.29", enabled: true },
	{ id: "obsidian-tasks-plugin", version: "8.6.0", enabled: true },
	{ id: "templater-obsidian", version: "2.26.0", enabled: true },
];
