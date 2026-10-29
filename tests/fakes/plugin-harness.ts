import type { Plugin as ObsidianPlugin } from "obsidian";

import { createContainer, type Container } from "../../src/app/container";
import { startPlugin } from "../../src/app/lifecycle";
import { Plugin, type App } from "../mocks/obsidian";
import { createTestApp, type TestAppOptions } from "./fake-obsidian-app";
import { READY_PLUGINS } from "./fake-plugin-registry";
import { FixedClock } from "./fixed-clock";

export interface PluginHarness {
	readonly app: App;
	readonly plugin: Plugin;
	readonly container: Container;
	readonly clock: FixedClock;
}

export const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

/** Loads the plugin into an in-memory app with every dependency ready and the layout finished. */
export async function loadPlugin(
	options: TestAppOptions & { data?: unknown; today?: string; minutes?: number } = {},
): Promise<PluginHarness> {
	const app = await createTestApp({ plugins: READY_PLUGINS, ...options });
	const plugin = new Plugin(app);
	plugin.data = options.data ?? null;
	const clock = new FixedClock(options.today, options.minutes);
	const obsidianPlugin = plugin as unknown as ObsidianPlugin;
	const container = createContainer(obsidianPlugin, { clock });
	await startPlugin(obsidianPlugin, container);
	app.workspace.finishLayout();
	await sleep(0);
	return { app, plugin, container, clock };
}
