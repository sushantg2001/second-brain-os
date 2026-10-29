import type { InstalledPlugin } from "../domain/dependencies";

/** Reports what the host knows about another plugin. Implemented by an infrastructure adapter. */
export interface PluginRegistry {
	describe(id: string): InstalledPlugin;
}
