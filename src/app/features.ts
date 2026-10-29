import type { Plugin } from "obsidian";

import type { Container } from "./container";

/**
 * A feature slice's registration hook: views, commands, settings sections and code blocks.
 * Features register only after the dependency gate reports ready.
 */
export interface FeatureModule {
	readonly id: string;
	register(plugin: Plugin, container: Container): void;
}

/** Filled in phase by phase: periodic and calendar, timeline, clocks, PPV, lint, rollups. */
export const FEATURES: readonly FeatureModule[] = [];
