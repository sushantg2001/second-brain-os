import type { Plugin } from "obsidian";

import { registerCalendar, type DayBadge } from "../features/calendar";
import { registerPeriodic } from "../features/periodic";
import { registerPlanner } from "../features/planner";
import { formatDuration, select, type IsoDate } from "../shared/kernel";
import type { Container } from "./container";

/**
 * A feature slice's registration hook: views, commands, settings sections and code blocks.
 * Features register only after the dependency gate reports ready, in this order.
 */
export interface FeatureModule {
	readonly id: string;
	register(plugin: Plugin, container: Container): void;
}

export const FEATURES: readonly FeatureModule[] = [
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
		id: "planner",
		register: (plugin, container) => {
			registerPlanner(plugin, {
				app: container.app,
				planner: container.planner,
				tasks: container.tasks,
				periodic: container.periodic,
				dates: container.dates,
				workspace: container.workspace,
				clock: container.clock,
				notifier: container.notifier,
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
				badges: select(
					container.planner.plannedByDate,
					(planned) =>
						new Map<IsoDate, readonly DayBadge[]>(
							[...planned].map(([date, minutes]) => [
								date,
								[
									{
										text: formatDuration(minutes),
										label: `${formatDuration(minutes)} planned`,
									},
								],
							]),
						),
				),
			});
		},
	},
];
