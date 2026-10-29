import type { App } from "obsidian";

import type { TaskToggler } from "../../features/tasks";

/** The Tasks plugin's public API (apiV1). */
interface TasksApi {
	executeToggleTaskDoneCommand?: (line: string, path: string) => string;
}

export class TasksPluginToggler implements TaskToggler {
	constructor(private readonly app: App) {}

	toggle(raw: string, path: string): string | null {
		const plugins = (this.app as App & { plugins?: { plugins?: Record<string, unknown> } })
			.plugins?.plugins;
		const api = (plugins?.["obsidian-tasks-plugin"] as { apiV1?: TasksApi } | undefined)?.apiV1;
		if (!api?.executeToggleTaskDoneCommand) {
			return null;
		}
		try {
			return api.executeToggleTaskDoneCommand(raw, path);
		} catch {
			return null;
		}
	}
}
