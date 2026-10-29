import { moment, type App, type Plugin } from "obsidian";

import { Clocks } from "../features/clocks";
import { PeriodicNotes } from "../features/periodic";
import { Planner } from "../features/planner";
import { DependencyGate } from "../features/setup";
import { TaskActions, TaskIndex } from "../features/tasks";
import {
	MomentDateFormatter,
	NoticeNotifier,
	ObsidianPluginRegistry,
	ObsidianWorkspace,
	SystemClock,
	VaultNoteStore,
} from "../infrastructure/obsidian";
import { SettingsRepository } from "../infrastructure/settings";
import { TasksPluginToggler } from "../infrastructure/tasks";
import { TemplaterEngine } from "../infrastructure/templater";
import {
	NowTicker,
	type Clock,
	type DateFormatter,
	type NoteStore,
	type Notifier,
	type Workspace,
} from "../shared/kernel";

/** Every long-lived service, built once per plugin load. The only place adapters meet ports. */
export interface Container {
	readonly app: App;
	readonly settings: SettingsRepository;
	readonly dependencyGate: DependencyGate;
	readonly notes: NoteStore;
	readonly workspace: Workspace;
	readonly dates: DateFormatter;
	readonly clock: Clock;
	/** Current date and minute, ticked by the app every half minute. */
	readonly now: NowTicker;
	readonly notifier: Notifier;
	readonly periodic: PeriodicNotes;
	readonly tasks: TaskIndex;
	readonly taskActions: TaskActions;
	readonly planner: Planner;
	readonly clocks: Clocks;
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
	const periodic = new PeriodicNotes({
		settings: settings.section("periodic").store,
		notes,
		dates,
		workspace,
		templates: new TemplaterEngine(app),
		clock,
	});
	const tasks = new TaskIndex(notes);
	const taskActions = new TaskActions(notes, clock, new TasksPluginToggler(app));
	const now = new NowTicker(clock);
	return {
		app,
		settings,
		dependencyGate: new DependencyGate(new ObsidianPluginRegistry(app)),
		notes,
		workspace,
		dates,
		clock,
		now,
		notifier: new NoticeNotifier(),
		periodic,
		tasks,
		taskActions,
		planner: new Planner({
			tasks,
			actions: taskActions,
			periodic,
			notes,
			settings: settings.section("planner").store,
			clock,
		}),
		clocks: new Clocks({ tasks, notes, now }),
	};
}
