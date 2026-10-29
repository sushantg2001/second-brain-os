import type { FakePlugin } from "./fake-plugin-registry";

/** The slice of Obsidian's private `app.plugins` manager the registry adapter reads. */
export interface FakePluginManager {
	manifests: Record<string, { version?: string }>;
	enabledPlugins: Set<string>;
	plugins: Record<string, unknown>;
}

export function createPluginManager(plugins: readonly FakePlugin[] = []): FakePluginManager {
	const manager: FakePluginManager = { manifests: {}, enabledPlugins: new Set(), plugins: {} };
	for (const plugin of plugins) {
		manager.manifests[plugin.id] = { version: plugin.version };
		if (plugin.enabled) {
			manager.enabledPlugins.add(plugin.id);
			manager.plugins[plugin.id] = {};
		}
	}
	return manager;
}

interface FakeLeaf {
	viewState: { type: string; active?: boolean } | null;
	setViewState(state: { type: string; active?: boolean }): Promise<void>;
}

function createLeaf(): FakeLeaf {
	return {
		viewState: null,
		setViewState(state) {
			this.viewState = state;
			return Promise.resolve();
		},
	};
}

/** A workspace that runs layout-ready callbacks when the test says the layout is ready. */
export class FakeWorkspace {
	readonly leaves: FakeLeaf[] = [];
	readonly revealed: FakeLeaf[] = [];
	#layoutReady = false;
	readonly #pending: (() => void)[] = [];

	onLayoutReady(callback: () => void): void {
		if (this.#layoutReady) {
			callback();
		} else {
			this.#pending.push(callback);
		}
	}

	finishLayout(): void {
		this.#layoutReady = true;
		for (const callback of this.#pending.splice(0)) {
			callback();
		}
	}

	getLeavesOfType(type: string): FakeLeaf[] {
		return this.leaves.filter((leaf) => leaf.viewState?.type === type);
	}

	getLeaf(): FakeLeaf {
		const leaf = createLeaf();
		this.leaves.push(leaf);
		return leaf;
	}

	revealLeaf(leaf: FakeLeaf): Promise<void> {
		this.revealed.push(leaf);
		return Promise.resolve();
	}
}

export interface FakeApp {
	plugins: FakePluginManager;
	workspace: FakeWorkspace;
}

export function createFakeApp(plugins: readonly FakePlugin[] = []): FakeApp {
	return { plugins: createPluginManager(plugins), workspace: new FakeWorkspace() };
}
