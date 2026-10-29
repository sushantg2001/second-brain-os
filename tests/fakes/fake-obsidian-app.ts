import type { App as ObsidianApp } from "obsidian";

import { App, type PluginManagerState } from "../mocks/obsidian";

import type { FakePlugin } from "./fake-plugin-registry";

export function createPluginManager(plugins: readonly FakePlugin[] = []): PluginManagerState {
	const manager: PluginManagerState = { manifests: {}, enabledPlugins: new Set(), plugins: {} };
	for (const plugin of plugins) {
		manager.manifests[plugin.id] = { version: plugin.version };
		if (plugin.enabled) {
			manager.enabledPlugins.add(plugin.id);
			manager.plugins[plugin.id] = {};
		}
	}
	return manager;
}

export interface TestAppOptions {
	/** Vault files by path. Folders are created as needed. */
	readonly files?: Readonly<Record<string, string>>;
	readonly plugins?: readonly FakePlugin[];
}

/** An in-memory Obsidian app seeded with notes. */
export async function createTestApp(options: TestAppOptions = {}): Promise<App> {
	const app = new App();
	app.plugins = createPluginManager(options.plugins);
	for (const [path, content] of Object.entries(options.files ?? {})) {
		const parts = path.split("/").slice(0, -1);
		for (let index = 1; index <= parts.length; index++) {
			const folder = parts.slice(0, index).join("/");
			if (!app.vault.getAbstractFileByPath(folder)) {
				await app.vault.createFolder(folder);
			}
		}
		await app.vault.create(path, content);
	}
	return app;
}

/** The mock app typed as the real one, for passing into adapters. */
export function asObsidianApp(app: App): ObsidianApp {
	return app as unknown as ObsidianApp;
}
