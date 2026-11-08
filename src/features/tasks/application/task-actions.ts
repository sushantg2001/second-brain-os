import { err, ok, type Clock, type NoteStore, type Result } from "../../../shared/kernel";
import { replaceLine, type LineRef } from "../domain/edit";
import { toggleDoneLine } from "../domain/toggle";
import type { TaskToggler } from "./ports";

export interface TaskRef extends LineRef {
	readonly path: string;
}

/** Writes to task lines. Every edit is checked against the line as it was read. */
export class TaskActions {
	constructor(
		private readonly notes: NoteStore,
		private readonly clock: Clock,
		private readonly toggler: TaskToggler | null,
	) {}

	/** Rewrites one task line with a pure function. */
	async editLine(
		ref: TaskRef,
		edit: (raw: string) => string | readonly string[] | null,
	): Promise<Result<void, Error>> {
		let failure: Error | null = null;
		await this.notes.process(ref.path, (content) => {
			const replacement = edit(ref.raw);
			if (replacement === null) {
				failure = new Error("That line is not a task.");
				return content;
			}
			const next = replaceLine(content, ref, replacement);
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
			readonly edit: (raw: string) => string | readonly string[] | null;
		}[],
	): Promise<Result<void, Error>> {
		let failure: Error | null = null;
		await this.notes.process(path, (content) => {
			let next = content;
			for (const { ref, edit } of edits) {
				const replacement = edit(ref.raw);
				if (replacement === null) {
					failure = new Error("That line is not a task.");
					return content;
				}
				const replaced = replaceLine(next, ref, replacement);
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
		return this.editLine(ref, (raw) => {
			const viaTasks = this.toggler?.toggle(raw, ref.path);
			return viaTasks ? viaTasks.split("\n") : toggleDoneLine(raw, this.clock.today());
		});
	}
}
