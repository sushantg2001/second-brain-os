import type { App, Plugin } from "obsidian";

import {
	Store,
	type DateFormatter,
	type IsoDate,
	type Notifier,
	type ReadableStore,
	type Workspace,
} from "../../../shared/kernel";
import { confirm } from "../../../shared/react";
import { LABELS, type Granularity, type PeriodicNotes } from "../../periodic";
import { CalendarState } from "../application/calendar-state";
import { CalendarView, JumpToDateModal, VIEW_TYPE_CALENDAR } from "./calendar-view";
import type { CalendarServices, DayBadge } from "./services";

export interface CalendarModuleDeps {
	readonly app: App;
	readonly periodic: PeriodicNotes;
	readonly dates: DateFormatter;
	readonly workspace: Workspace;
	readonly notifier: Notifier;
	readonly badges?: ReadableStore<ReadonlyMap<IsoDate, readonly DayBadge[]>>;
	readonly tick?: ReadableStore<unknown>;
}

async function revealCalendar(app: App): Promise<void> {
	const { workspace } = app;
	let leaf = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR)[0];
	if (!leaf) {
		leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
	}
	await workspace.revealLeaf(leaf);
}

/** The month calendar in the sidebar and its commands. Returns the shared services. */
export function registerCalendar(plugin: Plugin, deps: CalendarModuleDeps): CalendarServices {
	const { app, periodic, notifier } = deps;
	const state = new CalendarState(periodic.today());
	const activePath = new Store<string | null>(deps.workspace.activePath());
	plugin.register(deps.workspace.onActiveChange((path) => activePath.set(path)));

	const activate = async (
		granularity: Granularity,
		date: IsoDate,
		split: boolean,
	): Promise<void> => {
		if (!periodic.find(granularity, date) && periodic.settings.confirmBeforeCreate) {
			const title = periodic.title(granularity, date);
			const confirmed = await confirm(app, {
				title: "Create note",
				message: `${title} does not exist yet. Create the ${LABELS[granularity].periodicity} note?`,
				confirmText: "Create",
			});
			if (!confirmed) {
				return;
			}
		}
		const result = await periodic.open(granularity, date, split ? "split" : "current");
		if (!result.ok) {
			notifier.notify(result.error.message);
		}
	};

	const services: CalendarServices = {
		periodic,
		dates: deps.dates,
		state,
		activePath,
		...(deps.badges ? { badges: deps.badges } : {}),
		...(deps.tick ? { tick: deps.tick } : {}),
		activate: (granularity, date, split) => void activate(granularity, date, split),
		openJumpToDate: () => new JumpToDateModal(app, services).open(),
	};

	plugin.registerView(VIEW_TYPE_CALENDAR, (leaf) => new CalendarView(leaf, services));
	plugin.addCommand({
		id: "open-calendar",
		name: "Open calendar",
		callback: () => void revealCalendar(app),
	});
	plugin.addCommand({
		id: "jump-to-date",
		name: "Jump to date",
		callback: () => {
			void revealCalendar(app);
			services.openJumpToDate();
		},
	});
	plugin.addCommand({
		id: "reveal-active-note",
		name: "Reveal active note in calendar",
		checkCallback: (checking) => {
			const path = deps.workspace.activePath();
			const found = path ? periodic.identify(path) : null;
			if (!found) {
				return false;
			}
			if (!checking) {
				state.show(found.date);
				void revealCalendar(app);
			}
			return true;
		},
	});
	app.workspace.onLayoutReady(() => {
		if (app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length === 0) {
			void app.workspace.getRightLeaf(false)?.setViewState({ type: VIEW_TYPE_CALENDAR });
		}
	});
	return services;
}
