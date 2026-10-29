import { Store, type ReadableStore } from "../../../shared/kernel";
import {
	evaluateDependencies,
	REQUIRED_PLUGINS,
	type DependencyReport,
	type RequiredPlugin,
} from "../domain/dependencies";
import type { PluginRegistry } from "./ports";

/**
 * Holds the latest dependency report. Features are registered only once the report is ready;
 * `recheck` lets the user retry after installing or enabling a plugin without reloading.
 */
export class DependencyGate {
	readonly #store: Store<DependencyReport>;

	constructor(
		private readonly registry: PluginRegistry,
		private readonly required: readonly RequiredPlugin[] = REQUIRED_PLUGINS,
	) {
		this.#store = new Store(this.evaluate());
	}

	get report(): ReadableStore<DependencyReport> {
		return this.#store;
	}

	recheck(): DependencyReport {
		const report = this.evaluate();
		this.#store.set(report);
		return report;
	}

	private evaluate(): DependencyReport {
		return evaluateDependencies(this.required, (id) => this.registry.describe(id));
	}
}
