import type { ReadableStore } from "../../../shared/kernel";
import { createServiceContext } from "../../../shared/react";
import type { Task, TaskIndex } from "../../tasks";
import type { PpvIndex } from "../application/ppv-index";
import type { PpvService } from "../application/ppv-service";
import type { PpvNote } from "../domain/ppv-note";
import type { PpvType } from "../domain/settings";

/** Extra numbers for a project row, filled in by the rollups feature when present. */
export interface ProjectSummary {
	readonly done: number;
	readonly total: number;
	readonly clockedMinutes: number;
}

export interface PpvServices {
	readonly index: PpvIndex;
	readonly service: PpvService;
	readonly tasks: TaskIndex;
	/** Changes when notes, tasks or settings change. */
	readonly version: ReadableStore<unknown>;
	readonly open: (path: string, line?: number) => void;
	readonly newNote: (type: PpvType, parent?: PpvNote) => void;
	readonly toggleTask: (task: Task) => void;
	readonly summary: (project: PpvNote) => ProjectSummary;
	readonly setUp: () => void;
}

export const PpvContext = createServiceContext<PpvServices>("PpvServices");
