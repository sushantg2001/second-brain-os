import type { App } from "obsidian";

import type { InstalledPlugin, PluginRegistry } from "../../features/setup";

/** The undocumented `app.plugins` manager. Only the fields read here are typed. */
interface PluginManager {
	readonly manifests: Readonly<Record<string, { readonly version?: string } | undefined>>;
	readonly enabledPlugins: ReadonlySet<string>;
	readonly plugins: Readonly<Record<string, unknown>>;
}

function getPluginManager(app: App): PluginManager | null {
	const manager = (app as App & { plugins?: PluginManager }).plugins;
	return manager ?? null;
}

export class ObsidianPluginRegistry implements PluginRegistry {
	constructor(private readonly app: App) {}

	describe(id: string): InstalledPlugin {
		const manager = getPluginManager(this.app);
		const manifest = manager?.manifests[id];
		if (!manager || !manifest) {
			return { installed: false, enabled: false, version: null };
		}
		return {
			installed: true,
			// Enabled in config is not enough: the plugin must also have loaded.
			enabled: manager.enabledPlugins.has(id) && manager.plugins[id] !== undefined,
			version: manifest.version ?? null,
		};
	}
}
