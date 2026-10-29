import { moment, type App, type Plugin } from "obsidian";

import { Clocks } from "../features/clocks";
import { Linter } from "../features/lint";
import { PeriodicNotes } from "../features/periodic";
import { Planner } from "../features/planner";
import { PpvIndex, PpvService } from "../features/ppv";
import { Rollups } from "../features/rollups";
import { DependencyGate } from "../features/setup";
import { TaskActions, TaskIndex } from "../features/tasks";
import {
	MomentDateFormatter,
	ObsidianYaml,
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
	readonly ppvIndex: PpvIndex;
	readonly ppv: PpvService;
	readonly rollups: Rollups;
	readonly linter: Linter;
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
	const templates = new TemplaterEngine(app);
	const periodic = new PeriodicNotes({
		settings: settings.section("periodic").store,
		notes,
		dates,
		workspace,
		templates,
		clock,
	});
	const yaml = new ObsidianYaml();
	const tasks = new TaskIndex(notes, yaml);
	const taskActions = new TaskActions(notes, clock, new TasksPluginToggler(app));
	const now = new NowTicker(clock);
	const clocks = new Clocks({ tasks, notes, now, yaml });
	const ppvIndex = new PpvIndex(notes, settings.section("ppv").store);
	const ppv = new PpvService({
		index: ppvIndex,
		tasks,
		actions: taskActions,
		notes,
		periodic,
		settings: settings.section("ppv").store,
		templates,
		clock,
		formatDate: (date, format) => dates.format(date, format),
	});
	const planner = new Planner({
		tasks,
		actions: taskActions,
		periodic,
		notes,
		settings: settings.section("planner").store,
		clock,
	});
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
		planner,
		clocks,
		ppvIndex,
		ppv,
		rollups: new Rollups({ ppv, index: ppvIndex, tasks, notes, periodic, now }),
		linter: new Linter({
			index: ppvIndex,
			ppv,
			tasks,
			planner,
			periodic,
			notes,
			settings: settings.section("lint").store,
			now,
			clocks,
		}),
	};
}
