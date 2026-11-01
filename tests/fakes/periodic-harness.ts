import {
	DEFAULT_PERIODIC_SETTINGS,
	PeriodicNotes,
	type PeriodicSettings,
} from "../../src/features/periodic";
import {
	MomentDateFormatter,
	ObsidianWorkspace,
	VaultNoteStore,
} from "../../src/infrastructure/obsidian";
import { TemplaterEngine } from "../../src/infrastructure/templater";
import { Store } from "../../src/shared/kernel";
import { moment, type App } from "../mocks/obsidian";
import { asObsidianApp, createTestApp, type TestAppOptions } from "./fake-obsidian-app";
import { FixedClock } from "./fixed-clock";

export type SettingsPatch = Partial<Omit<PeriodicSettings, "notes">> & {
	notes?: Partial<{
		[K in keyof PeriodicSettings["notes"]]: Partial<PeriodicSettings["notes"][K]>;
	}>;
};

export function periodicSettings(patch: SettingsPatch = {}): PeriodicSettings {
	const notes = { ...DEFAULT_PERIODIC_SETTINGS.notes };
	for (const [key, value] of Object.entries(patch.notes ?? {})) {
		const granularity = key as keyof typeof notes;
		notes[granularity] = { ...notes[granularity], ...value };
	}
	return { ...DEFAULT_PERIODIC_SETTINGS, ...patch, notes };
}

export const dates = new MomentDateFormatter(moment);

export interface PeriodicHarness {
	readonly app: App;
	readonly settings: Store<PeriodicSettings>;
	readonly clock: FixedClock;
	readonly notes: VaultNoteStore;
	readonly workspace: ObsidianWorkspace;
	readonly periodic: PeriodicNotes;
}

export async function createPeriodicHarness(
	options: TestAppOptions & { settings?: SettingsPatch; today?: string } = {},
): Promise<PeriodicHarness> {
	const app = await createTestApp(options);
	const obsidianApp = asObsidianApp(app);
	const settings = new Store(periodicSettings(options.settings));
	const clock = new FixedClock(options.today);
	const notes = new VaultNoteStore(obsidianApp);
	const workspace = new ObsidianWorkspace(obsidianApp);
	const periodic = new PeriodicNotes({
		settings,
		notes,
		dates,
		workspace,
		templates: new TemplaterEngine(obsidianApp),
		clock,
	});
	periodic.refresh();
	return { app, settings, clock, notes, workspace, periodic };
}
