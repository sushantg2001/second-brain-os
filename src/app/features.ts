import type { Plugin } from "obsidian";

import { registerCalendar } from "../features/calendar";
import { registerPeriodic } from "../features/periodic";
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
		id: "calendar",
		register: (plugin, container) => {
			registerCalendar(plugin, {
				app: container.app,
				periodic: container.periodic,
				dates: container.dates,
				workspace: container.workspace,
				notifier: container.notifier,
			});
		},
	},
];
