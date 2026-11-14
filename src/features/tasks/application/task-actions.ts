import { err, ok, type Clock, type NoteStore, type Result } from "../../../shared/kernel";
import { editLine, type LineRef } from "../domain/edit";
import { toggleDoneLine } from "../domain/toggle";
import type { TaskToggler } from "./ports";

export interface TaskRef extends LineRef {
	readonly path: string;
}

/** Writes to task lines. Every edit is checked against the task as it was read. */
export class TaskActions {
	constructor(
		private readonly notes: NoteStore,
		private readonly clock: Clock,
		private readonly toggler: TaskToggler | null,
	) {}

	/** Rewrites one task line with a pure function. */
	async editLine(
		ref: TaskRef,
		edit: (line: string) => string | readonly string[] | null,
	): Promise<Result<void, Error>> {
		let failure: Error | null = null;
		await this.notes.process(ref.path, (content) => {
			const next = editLine(content, ref, edit);
			if (!next.ok) {
				failure = next.error;
				return content;
			}
			return next.value;
		});
		return failure ? err(failure) : ok(undefined);
	}

	/**
	 * Rewrites several lines of one note in a single write. Either every line is rewritten or, if
	 * any of them changed since it was read, none is.
	 */
	async editLines(
		path: string,
		edits: readonly {
			readonly ref: LineRef;
			readonly edit: (line: string) => string | readonly string[] | null;
		}[],
	): Promise<Result<void, Error>> {
		let failure: Error | null = null;
		await this.notes.process(path, (content) => {
			let next = content;
			for (const { ref, edit } of edits) {
				const replaced = editLine(next, ref, edit);
				if (!replaced.ok) {
					failure = replaced.error;
					return content;
				}
				next = replaced.value;
			}
			return next;
		});
		return failure ? err(failure) : ok(undefined);
	}

	toggleDone(ref: TaskRef): Promise<Result<void, Error>> {
		return this.editLine(ref, (line) => {
			const viaTasks = this.toggler?.toggle(line, ref.path);
			return viaTasks ? viaTasks.split("\n") : toggleDoneLine(line, this.clock.today());
		});
	}
}
