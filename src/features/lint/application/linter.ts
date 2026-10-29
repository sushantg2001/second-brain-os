import {
	err,
	ok,
	type NoteStore,
	type NowSnapshot,
	type ReadableStore,
	type Result,
} from "../../../shared/kernel";
import type { Clocks } from "../../clocks";
import type { PeriodicNotes } from "../../periodic";
import type { Planner } from "../../planner";
import type { PpvIndex, PpvService, PpvType } from "../../ppv";
import type { TaskIndex } from "../../tasks";
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
	readonly clocks: Clocks;
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

	/** What a clock fix would record, before and after. */
	previewCloseClock(
		fix: Extract<LintFix, { kind: "close-clock" }>,
	): { before: string; after: string } | null {
		const task = this.deps.tasks
			.tasksIn(fix.path)
			.find((candidate) => candidate.line === fix.line && candidate.raw === fix.raw);
		return task ? this.deps.clocks.previewStop(task) : null;
	}

	closeClock(fix: Extract<LintFix, { kind: "close-clock" }>): Promise<Result<void, Error>> {
		return this.deps.clocks.stopTask(fix);
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
