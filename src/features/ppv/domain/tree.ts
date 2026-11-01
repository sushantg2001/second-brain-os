import type { PpvNote } from "./ppv-note";

export interface GoalNode {
	readonly note: PpvNote;
	readonly projects: readonly PpvNote[];
}

export interface PillarNode {
	readonly note: PpvNote;
	readonly goals: readonly GoalNode[];
	/** Projects linked straight to the pillar. */
	readonly projects: readonly PpvNote[];
}

export interface PpvTree {
	readonly pillars: readonly PillarNode[];
	/** Goals without a pillar, with their projects. */
	readonly looseGoals: readonly GoalNode[];
	/** Projects whose parent is missing or not a goal or pillar. */
	readonly looseProjects: readonly PpvNote[];
	readonly resources: readonly PpvNote[];
}

const byTitle = (a: PpvNote, b: PpvNote): number => a.title.localeCompare(b.title);

export function buildTree(notes: Iterable<PpvNote>): PpvTree {
	const all = [...notes];
	const byPath = new Map(all.map((note) => [note.path, note]));
	const parentOf = (note: PpvNote): PpvNote | undefined =>
		note.parent ? byPath.get(note.parent) : undefined;

	const projectsUnder = (path: string): PpvNote[] =>
		all.filter((note) => note.type === "project" && note.parent === path).sort(byTitle);
	const goalNode = (goal: PpvNote): GoalNode => ({
		note: goal,
		projects: projectsUnder(goal.path),
	});

	const pillars = all
		.filter((note) => note.type === "pillar")
		.sort(byTitle)
		.map((pillar) => ({
			note: pillar,
			goals: all
				.filter((note) => note.type === "goal" && note.parent === pillar.path)
				.sort(byTitle)
				.map(goalNode),
			projects: projectsUnder(pillar.path),
		}));

	const looseGoals = all
		.filter((note) => note.type === "goal" && parentOf(note)?.type !== "pillar")
		.sort(byTitle)
		.map(goalNode);

	const looseProjects = all
		.filter((note) => {
			const parentType = note.type === "project" ? parentOf(note)?.type : undefined;
			return note.type === "project" && parentType !== "goal" && parentType !== "pillar";
		})
		.sort(byTitle);

	return {
		pillars,
		looseGoals,
		looseProjects,
		resources: all.filter((note) => note.type === "resource").sort(byTitle),
	};
}
