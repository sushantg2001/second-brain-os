import type { Plugin } from "obsidian";

import { DependencyGate } from "../features/setup";
import { ObsidianPluginRegistry } from "../infrastructure/obsidian";
import { SettingsRepository } from "../infrastructure/settings";

/** Every long-lived service, built once per plugin load. The only place adapters meet ports. */
export interface Container {
	readonly settings: SettingsRepository;
	readonly dependencyGate: DependencyGate;
}

export function createContainer(plugin: Plugin): Container {
	return {
		settings: new SettingsRepository({
			load: () => plugin.loadData(),
			save: (data) => plugin.saveData(data),
		}),
		dependencyGate: new DependencyGate(new ObsidianPluginRegistry(plugin.app)),
	};
}
