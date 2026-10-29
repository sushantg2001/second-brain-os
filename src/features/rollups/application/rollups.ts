import {
	type IsoDate,
	type Minutes,
	type NoteStore,
	type NowSnapshot,
	type ReadableStore,
} from "../../../shared/kernel";
import { clocksOf, datesOf, entryMinutes, minutesOnDate, taskTitle } from "../../clocks";
import { periodEnd, periodStart, type Granularity, type PeriodicNotes } from "../../periodic";
import type { PpvIndex, PpvNote, PpvService } from "../../ppv";
import { isClosed, type Task, type TaskIndex } from "../../tasks";
import { combine, EMPTY_ROLLUP, rollupTasks, type Rollup } from "../domain/rollup";
import {
	addTo,
	inRange,
	type DateRange,
	type PeriodReview,
	type ReviewProject,
} from "../domain/review";

export interface RollupsDeps {
	readonly ppv: PpvService;
	readonly index: PpvIndex;
	readonly tasks: TaskIndex;
	readonly notes: NoteStore;
	readonly periodic: PeriodicNotes;
	readonly now: ReadableStore<NowSnapshot>;
}

/** Progress and time for projects, goals, pillars and periods. Computed on demand. */
export class Rollups {
	constructor(private readonly deps: RollupsDeps) {}

	/** The project a task belongs to: the note it is in, or the first project it links to. */
	projectOf(task: Task): string | null {
		if (this.deps.index.get(task.path)?.type === "project") {
			return task.path;
		}
		for (const link of task.fields.links) {
			const target = this.deps.notes.resolveLink(link, task.path);
			if (target && this.deps.index.get(target)?.type === "project") {
				return target;
			}
		}
		return null;
	}

	/** The pillar above a note, following parent links. */
	pillarOf(path: string | null): PpvNote | null {
		const seen = new Set<string>();
		let current = path ? this.deps.index.get(path) : null;
		while (current && !seen.has(current.path)) {
			if (current.type === "pillar") {
				return current;
			}
			seen.add(current.path);
			current = current.parent ? this.deps.index.get(current.parent) : null;
		}
		return null;
	}

	private clocked(task: Task): { minutes: Minutes; lastDate: IsoDate | null } {
		const now = this.deps.now.get();
		let minutes = 0;
		const dates: IsoDate[] = [];
		for (const clock of clocksOf(task)) {
			minutes += entryMinutes(clock, now);
			dates.push((clock.end ?? now).date);
		}
		dates.sort();
		return { minutes, lastDate: dates.at(-1) ?? null };
	}

	project(path: string): Rollup {
		return rollupTasks(this.deps.ppv.projectTasks(path), (task) => this.clocked(task));
	}

	/** A project's, goal's or pillar's rollup. Resources have none. */
	of(note: PpvNote): Rollup {
		const { tree } = this.deps.index.snapshot.get();
		if (note.type === "project") {
			return this.project(note.path);
		}
		if (note.type === "goal") {
			const goal =
				tree.pillars
					.flatMap((pillar) => pillar.goals)
					.find((node) => node.note.path === note.path) ??
				tree.looseGoals.find((node) => node.note.path === note.path);
			return combine((goal?.projects ?? []).map((project) => this.project(project.path)));
		}
		if (note.type === "pillar") {
			const pillar = tree.pillars.find((node) => node.note.path === note.path);
			if (!pillar) {
				return EMPTY_ROLLUP;
			}
			const projects = [...pillar.projects, ...pillar.goals.flatMap((goal) => goal.projects)];
			return combine(projects.map((project) => this.project(project.path)));
		}
		return EMPTY_ROLLUP;
	}

	rangeOf(granularity: Granularity, date: IsoDate): DateRange {
		const weekStart = this.deps.periodic.weekStart();
		return {
			from: periodStart(date, granularity, weekStart),
			to: periodEnd(date, granularity, weekStart),
		};
	}

	review(range: DateRange): PeriodReview {
		const now = this.deps.now.get();
		const completed = [];
		const clockedByPillar = new Map<string, Minutes>();
		let clockedTotal = 0;
		for (const task of this.deps.tasks.all()) {
			const project = this.projectOf(task);
			if (isClosed(task.state) && task.fields.done && inRange(task.fields.done, range)) {
				completed.push({
					path: task.path,
					line: task.line,
					title: taskTitle(task),
					done: task.fields.done,
					project,
				});
			}
			const pillar = this.pillarOf(project ?? task.path)?.title ?? "";
			for (const clock of clocksOf(task)) {
				for (const date of datesOf(clock, now)) {
					if (inRange(date, range)) {
						const minutes = minutesOnDate(clock, date, now);
						addTo(clockedByPillar, pillar, minutes);
						clockedTotal += minutes;
					}
				}
			}
		}
		completed.sort((a, b) =>
			a.done === b.done ? a.title.localeCompare(b.title) : a.done < b.done ? -1 : 1,
		);
		const projects = this.deps.index.ofType("project");
		const dated = (pick: (note: PpvNote) => IsoDate | null): ReviewProject[] =>
			projects.flatMap((note) => {
				const date = pick(note);
				return date && inRange(date, range)
					? [{ path: note.path, title: note.title, date }]
					: [];
			});
		return {
			range,
			completed,
			clockedByPillar,
			clockedTotal,
			projectsFinished: dated((note) => note.completed),
			projectsStarted: dated((note) => note.start),
		};
	}

	/** The review for the periodic note at `path`, or null when it is not one. */
	reviewForNote(path: string): PeriodReview | null {
		const found = this.deps.periodic.identify(path);
		return found ? this.review(this.rangeOf(found.granularity, found.date)) : null;
	}

	/** Writes `progress` into each open project's front matter. Returns how many changed. */
	async writeProgress(): Promise<number> {
		let changed = 0;
		for (const project of this.deps.index.ofType("project")) {
			const { percent } = this.project(project.path);
			const current = this.deps.notes.frontmatter(project.path)?.progress;
			if (current !== percent) {
				await this.deps.notes.updateFrontmatter(project.path, (frontmatter) => {
					frontmatter.progress = percent;
				});
				changed++;
			}
		}
		return changed;
	}
}
