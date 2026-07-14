import { moment, Notice } from "obsidian";
import type { Command } from "obsidian";

import { DISPLAY_CONFIGS, GRANULARITIES } from "./constants";
import { findAdjacentDate } from "./utils/dates";
import type { Granularity } from "./types";
import type CalendarPeriodicNotesPlugin from "./main";

function jumpToAdjacentNote(
	plugin: CalendarPeriodicNotesPlugin,
	granularity: Granularity,
	direction: "next" | "prev",
): void {
	const activeFile = plugin.app.workspace.getActiveFile();
	const current = activeFile
		? (plugin.notesManager.getNoteDate(granularity, activeFile) ?? moment())
		: moment();

	const notes = plugin.notesManager.getAllNotes(granularity);
	const target = findAdjacentDate(
		notes.map((note) => note.date),
		current,
		direction,
	);
	if (!target) {
		new Notice(
			`No ${direction === "next" ? "later" : "earlier"} ${DISPLAY_CONFIGS[granularity].periodicity} note exists.`,
		);
		return;
	}
	void plugin.notesManager.openNote(granularity, target);
}

export function getCommands(plugin: CalendarPeriodicNotesPlugin): Command[] {
	const commands: Command[] = [];

	for (const granularity of GRANULARITIES) {
		const config = DISPLAY_CONFIGS[granularity];
		const enabled = () => plugin.settings.notes[granularity].enabled;

		commands.push(
			{
				id: `open-${config.periodicity}-note`,
				name: config.labelOpenPresent,
				checkCallback: (checking) => {
					if (!enabled()) {
						return false;
					}
					if (!checking) {
						void plugin.notesManager.openNote(granularity, moment());
					}
					return true;
				},
			},
			{
				id: `create-${config.periodicity}-note`,
				name: config.labelCreatePresent,
				checkCallback: (checking) => {
					if (!enabled()) {
						return false;
					}
					if (!checking) {
						void plugin.notesManager.createOrReturnNote(granularity, moment());
					}
					return true;
				},
			},
			{
				id: `next-${config.periodicity}-note`,
				name: `Jump forwards to closest ${config.periodicity} note`,
				checkCallback: (checking) => {
					if (!enabled()) {
						return false;
					}
					if (!checking) {
						jumpToAdjacentNote(plugin, granularity, "next");
					}
					return true;
				},
			},
			{
				id: `prev-${config.periodicity}-note`,
				name: `Jump backwards to closest ${config.periodicity} note`,
				checkCallback: (checking) => {
					if (!enabled()) {
						return false;
					}
					if (!checking) {
						jumpToAdjacentNote(plugin, granularity, "prev");
					}
					return true;
				},
			},
		);
	}

	return commands;
}
