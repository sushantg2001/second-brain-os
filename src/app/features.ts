import type { Plugin } from "obsidian";

import { registerCalendar, type DayBadge } from "../features/calendar";
import { registerLint } from "../features/lint";
import { registerClocks } from "../features/clocks";
import { registerPeriodic } from "../features/periodic";
import { registerPlanner } from "../features/planner";
import { registerPpv } from "../features/ppv";
import { registerRollups, type Rollup } from "../features/rollups";
import { formatDuration, Store, type IsoDate, type Minutes } from "../shared/kernel";
import type { Container } from "./container";

/**
 * A feature slice's registration hook: views, commands, settings sections and code blocks.
 * Features register only after the dependency gate reports ready, in this order.
 */
export interface FeatureModule {
	readonly id: string;
	register(plugin: Plugin, container: Container): void;
}

const TICK_MS = 30_000;

export const FEATURES: readonly FeatureModule[] = [
	{
		id: "time",
		register: (plugin, container) => {
			plugin.registerInterval(window.setInterval(() => container.now.tick(), TICK_MS));
		},
	},
	{
		id: "periodic",
		register: (plugin, container) =>
			registerPeriodic(plugin, {
				periodic: container.periodic,
				notes: container.notes,
				notifier: container.notifier,
			}),
	},
	{
		id: "tasks",
		register: (plugin, container) => {
			plugin.register(container.tasks.attach());
			// Reading every note can take a moment in large vaults, so it waits for the layout.
			container.app.workspace.onLayoutReady(() => void container.tasks.rebuild());
		},
	},
	{
		id: "clocks",
		register: (plugin, container) =>
			registerClocks(plugin, {
				clocks: container.clocks,
				tasks: container.tasks,
				workspace: container.workspace,
				now: container.now,
				notifier: container.notifier,
			}),
	},
	{
		id: "planner",
		register: (plugin, container) => {
			const { clocks, notifier } = container;
			registerPlanner(plugin, {
				app: container.app,
				planner: container.planner,
				tasks: container.tasks,
				periodic: container.periodic,
				dates: container.dates,
				workspace: container.workspace,
				clock: container.clock,
				now: container.now,
				notifier: container.notifier,
				clocks: {
					isRunning: (task) => clocks.isRunning(task),
					toggle: (task) =>
						void clocks.toggle(task).then((result) => {
							if (!result.ok) {
								notifier.notify(result.error.message);
							}
						}),
					rangesOn: (date) => clocks.rangesOn(date),
					minutesOn: (date) => clocks.minutesOn(date),
				},
			});
		},
	},
	{
		id: "ppv",
		register: (plugin, container) => {
			const { rollups } = container;
			registerPpv(plugin, {
				app: container.app,
				index: container.ppvIndex,
				service: container.ppv,
				tasks: container.tasks,
				actions: container.taskActions,
				workspace: container.workspace,
				notifier: container.notifier,
				settings: container.settings.section("ppv").store,
				summary: (project) => summaryOf(rollups.project(project.path)),
				aggregate: (note) => summaryOf(rollups.of(note)),
			});
		},
	},
	{
		id: "lint-and-rollups",
		register: (plugin, container) => {
			const sources = [
				container.tasks.snapshot,
				container.ppvIndex.snapshot,
				container.periodic.index,
				container.now,
			];
			const lint = registerLint(plugin, {
				app: container.app,
				linter: container.linter,
				ppv: container.ppv,
				workspace: container.workspace,
				notifier: container.notifier,
				sources: [...sources, container.settings.section("lint").store],
			});
			registerRollups(plugin, {
				rollups: container.rollups,
				periodic: container.periodic,
				periodicSettings: container.settings.section("periodic"),
				notes: container.notes,
				workspace: container.workspace,
				notifier: container.notifier,
				sources,
				extra: () => lint.summary(),
			});
		},
	},
	{
		id: "calendar",
		register: (plugin, container) => {
			registerCalendar(plugin, {
				app: container.app,
				periodic: container.periodic,
				dates: container.dates,
				workspace: container.workspace,
				notifier: container.notifier,
				badges: dayBadges(plugin, container),
			});
		},
	},
];

/** Planned and clocked time per day for the calendar, kept current. */
function dayBadges(
	plugin: Plugin,
	container: Container,
): Store<ReadonlyMap<IsoDate, readonly DayBadge[]>> {
	const badges = new Store<ReadonlyMap<IsoDate, readonly DayBadge[]>>(new Map());
	const refresh = (): void => {
		const planned = container.planner.plannedByDate.get();
		const clocked: ReadonlyMap<IsoDate, Minutes> = container.clocks.minutesByDate();
		const next = new Map<IsoDate, DayBadge[]>();
		for (const [date, minutes] of planned) {
			next.set(date, [
				{ text: formatDuration(minutes), label: `${formatDuration(minutes)} planned` },
			]);
		}
		for (const [date, minutes] of clocked) {
			const list = next.get(date) ?? [];
			list.push({
				text: `⏱${formatDuration(minutes)}`,
				label: `${formatDuration(minutes)} clocked`,
			});
			next.set(date, list);
		}
		badges.set(next);
	};
	plugin.register(container.planner.plannedByDate.subscribe(refresh));
	plugin.register(container.tasks.snapshot.subscribe(refresh));
	refresh();
	return badges;
}

function summaryOf(rollup: Rollup): { done: number; total: number; clockedMinutes: number } {
	return { done: rollup.done, total: rollup.total, clockedMinutes: rollup.clockedMinutes };
}
