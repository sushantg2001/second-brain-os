import { Notice, type Plugin } from "obsidian";

import { SetupView, VIEW_TYPE_SETUP } from "../features/setup";
import type { Container } from "./container";
import { FEATURES, type FeatureModule } from "./features";

async function revealSetupView(plugin: Plugin): Promise<void> {
	const { workspace } = plugin.app;
	const leaf = workspace.getLeavesOfType(VIEW_TYPE_SETUP)[0] ?? workspace.getLeaf("tab");
	await leaf.setViewState({ type: VIEW_TYPE_SETUP, active: true });
	await workspace.revealLeaf(leaf);
}

/**
 * Loads settings, registers the setup view, and registers features once Dataview, Tasks and
 * Templater are ready. Other plugins may load after this one, so the gate is first evaluated
 * when the layout is ready, and again whenever the user rechecks from the setup view.
 */
export async function startPlugin(
	plugin: Plugin,
	container: Container,
	features: readonly FeatureModule[] = FEATURES,
): Promise<void> {
	const loaded = await container.settings.load();
	if (!loaded.ok) {
		new Notice(
			`Second Brain OS could not read its settings: ${loaded.error.message} Defaults are in use and the stored file is left unchanged.`,
		);
	}

	plugin.registerView(VIEW_TYPE_SETUP, (leaf) => new SetupView(leaf, container.dependencyGate));
	plugin.addCommand({
		id: "show-required-plugins",
		name: "Show required plugins",
		callback: () => void revealSetupView(plugin),
	});

	let registered = false;
	const registerWhenReady = (): void => {
		if (registered || !container.dependencyGate.report.get().ready) {
			return;
		}
		registered = true;
		for (const feature of features) {
			feature.register(plugin, container);
		}
	};

	plugin.register(container.dependencyGate.report.subscribe(registerWhenReady));
	plugin.app.workspace.onLayoutReady(() => {
		const report = container.dependencyGate.recheck();
		registerWhenReady();
		if (!report.ready) {
			void revealSetupView(plugin);
		}
	});
}
