import type { Plugin } from "obsidian";

import type { NoteStore, Notifier } from "../../../shared/kernel";
import type { PeriodicNotes } from "../application/periodic-notes";
import { GRANULARITIES, LABELS, type Granularity } from "../domain/granularity";

export interface PeriodicModuleDeps {
	readonly periodic: PeriodicNotes;
	readonly notes: NoteStore;
	readonly notifier: Notifier;
}

const REFRESH_DELAY_MS = 150;

async function openOrReport(
	deps: PeriodicModuleDeps,
	granularity: Granularity,
	date: string,
): Promise<void> {
	const result = await deps.periodic.open(granularity, date);
	if (!result.ok) {
		deps.notifier.notify(result.error.message);
	}
}

function jump(
	deps: PeriodicModuleDeps,
	granularity: Granularity,
	direction: "next" | "prev",
): void {
	const target = deps.periodic.adjacent(granularity, direction);
	if (target === null) {
		const which = direction === "next" ? "later" : "earlier";
		deps.notifier.notify(`No ${which} ${LABELS[granularity].periodicity} note exists.`);
		return;
	}
	void openOrReport(deps, granularity, target);
}

/** Commands per granularity, and keeping the index of existing notes current. */
export function registerPeriodic(plugin: Plugin, deps: PeriodicModuleDeps): void {
	const { periodic } = deps;

	for (const granularity of GRANULARITIES) {
		const { periodicity, openCurrent, createCurrent } = LABELS[granularity];
		const whenEnabled =
			(action: () => void) =>
			(checking: boolean): boolean => {
				if (!periodic.enabled(granularity)) {
					return false;
				}
				if (!checking) {
					action();
				}
				return true;
			};

		plugin.addCommand({
			id: `open-${periodicity}-note`,
			name: openCurrent,
			checkCallback: whenEnabled(
				() => void openOrReport(deps, granularity, periodic.today()),
			),
		});
		plugin.addCommand({
			id: `create-${periodicity}-note`,
			name: createCurrent,
			checkCallback: whenEnabled(() => {
				void periodic.ensure(granularity, periodic.today()).then((result) => {
					if (!result.ok) {
						deps.notifier.notify(result.error.message);
					}
				});
			}),
		});
		plugin.addCommand({
			id: `next-${periodicity}-note`,
			name: `Jump forwards to closest ${periodicity} note`,
			checkCallback: whenEnabled(() => jump(deps, granularity, "next")),
		});
		plugin.addCommand({
			id: `prev-${periodicity}-note`,
			name: `Jump backwards to closest ${periodicity} note`,
			checkCallback: whenEnabled(() => jump(deps, granularity, "prev")),
		});
	}

	let timer: number | undefined;
	const scheduleRefresh = (): void => {
		window.clearTimeout(timer);
		timer = window.setTimeout(() => periodic.refresh(), REFRESH_DELAY_MS);
	};
	plugin.register(() => window.clearTimeout(timer));
	plugin.register(
		deps.notes.onChange((change) => {
			if (change.type !== "modify") {
				scheduleRefresh();
			}
		}),
	);
	plugin.register(periodic.settingsStore.subscribe(scheduleRefresh));
	periodic.refresh();
}
