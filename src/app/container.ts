import { moment, type App, type Plugin } from "obsidian";

import { PeriodicNotes } from "../features/periodic";
import { DependencyGate } from "../features/setup";
import {
	MomentDateFormatter,
	NoticeNotifier,
	ObsidianPluginRegistry,
	ObsidianWorkspace,
	SystemClock,
	VaultNoteStore,
} from "../infrastructure/obsidian";
import { SettingsRepository } from "../infrastructure/settings";
import { TemplaterEngine } from "../infrastructure/templater";
import type { Clock, DateFormatter, NoteStore, Notifier, Workspace } from "../shared/kernel";

/** Every long-lived service, built once per plugin load. The only place adapters meet ports. */
export interface Container {
	readonly app: App;
	readonly settings: SettingsRepository;
	readonly dependencyGate: DependencyGate;
	readonly notes: NoteStore;
	readonly workspace: Workspace;
	readonly dates: DateFormatter;
	readonly clock: Clock;
	readonly notifier: Notifier;
	readonly periodic: PeriodicNotes;
}

export interface ContainerOverrides {
	readonly clock?: Clock;
}

export function createContainer(plugin: Plugin, overrides: ContainerOverrides = {}): Container {
	const { app } = plugin;
	const settings = new SettingsRepository({
		load: () => plugin.loadData(),
		save: (data) => plugin.saveData(data),
	});
	const notes = new VaultNoteStore(app);
	const workspace = new ObsidianWorkspace(app);
	const dates = new MomentDateFormatter(moment);
	const clock = overrides.clock ?? new SystemClock();
	return {
		app,
		settings,
		dependencyGate: new DependencyGate(new ObsidianPluginRegistry(app)),
		notes,
		workspace,
		dates,
		clock,
		notifier: new NoticeNotifier(),
		periodic: new PeriodicNotes({
			settings: settings.section("periodic").store,
			notes,
			dates,
			workspace,
			templates: new TemplaterEngine(app),
			clock,
		}),
	};
}
