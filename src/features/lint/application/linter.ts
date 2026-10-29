import {
	err,
	ok,
	type NoteStore,
	type NowSnapshot,
	type ReadableStore,
	type Result,
} from "../../../shared/kernel";
import { closeClockLine } from "../../clocks";
import type { PeriodicNotes } from "../../periodic";
import type { Planner } from "../../planner";
import type { PpvIndex, PpvService, PpvType } from "../../ppv";
import { replaceLine, type TaskIndex } from "../../tasks";
import { lint, type Finding, type LintFix } from "../domain/rules";
import { applySettings, type LintSettings } from "../domain/settings";

export interface LinterDeps {
	readonly index: PpvIndex;
	readonly ppv: PpvService;
	readonly tasks: TaskIndex;
	readonly planner: Planner;
	readonly periodic: PeriodicNotes;
	readonly notes: NoteStore;
	readonly settings: ReadableStore<LintSettings>;
	readonly now: ReadableStore<NowSnapshot>;
}

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;

/** Front matter key for a parent of the given type. */
const PARENT_KEY: Readonly<Record<PpvType, string>> = {
	pillar: "pillar",
	goal: "goal",
	project: "project",
	resource: "resource",
};

export class Linter {
	#cache: { inputs: readonly unknown[]; findings: Finding[] } | null = null;

	constructor(private readonly deps: LinterDeps) {}

	run(): Finding[] {
		const inputs = [
			this.deps.index.snapshot.get(),
			this.deps.tasks.snapshot.get(),
			this.deps.periodic.index.get(),
			this.deps.settings.get(),
			this.deps.now.get().date,
		];
		if (this.#cache && inputs.every((input, index) => input === this.#cache?.inputs[index])) {
			return this.#cache.findings;
		}
		const now = this.deps.now.get();
		const plans = [...this.deps.periodic.index.get().day].map(([date, path]) => ({
			path,
			plan: this.deps.planner.plan(date),
		}));
		const findings = applySettings(
			lint({
				notes: this.deps.index.snapshot.get().notes,
				tasks: this.deps.tasks.all(),
				projectTasks: (path) => this.deps.ppv.projectTasks(path),
				plans,
				today: now.date,
				now,
			}),
			this.deps.settings.get(),
		).sort(
			(a, b) =>
				SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
				a.path.localeCompare(b.path),
		);
		this.#cache = { inputs, findings };
		return findings;
	}

	/** What a clock fix would change, as the line before and after. */
	previewCloseClock(
		fix: Extract<LintFix, { kind: "close-clock" }>,
	): { before: string; after: string } | null {
		const after = closeClockLine(fix.raw, this.deps.now.get());
		return after === null ? null : { before: fix.raw, after };
	}

	async closeClock(fix: Extract<LintFix, { kind: "close-clock" }>): Promise<Result<void, Error>> {
		const after = closeClockLine(fix.raw, this.deps.now.get());
		if (after === null) {
			return err(new Error("That clock is no longer running."));
		}
		let failure: Error | null = null;
		await this.deps.notes.process(fix.path, (content) => {
			const next = replaceLine(content, fix, after);
			if (!next.ok) {
				failure = next.error;
				return content;
			}
			return next.value;
		});
		await this.deps.tasks.update(fix.path);
		return failure ? err(failure) : ok(undefined);
	}

	/** The front matter line a set-parent fix would add. */
	previewParent(parentPath: string): string | null {
		const parent = this.deps.index.get(parentPath);
		return parent ? `${PARENT_KEY[parent.type]}: "[[${parent.title}]]"` : null;
	}

	async setParent(path: string, parentPath: string): Promise<Result<void, Error>> {
		const parent = this.deps.index.get(parentPath);
		if (!parent) {
			return err(new Error("Pick a pillar, goal or project."));
		}
		await this.deps.notes.updateFrontmatter(path, (frontmatter) => {
			frontmatter[PARENT_KEY[parent.type]] = `[[${parent.title}]]`;
		});
		this.deps.index.rebuild();
		return ok(undefined);
	}
}
