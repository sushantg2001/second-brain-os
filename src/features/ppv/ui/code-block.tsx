import type { ReactNode } from "react";

import { useStore } from "../../../shared/react";
import { displayText, stripTimeBlock } from "../../tasks";
import type { PpvNote } from "../domain/ppv-note";
import { selectProjects, type BlockQuery } from "../domain/query";
import { ProjectList } from "./project-list";
import { PpvContext } from "./services";

/** Titles of a note's parents, nearest first. */
export function ancestorTitles(note: PpvNote, lookup: (path: string) => PpvNote | null): string[] {
	const titles: string[] = [];
	const seen = new Set<string>([note.path]);
	let current = note.parent ? lookup(note.parent) : null;
	while (current && !seen.has(current.path)) {
		titles.push(current.title);
		seen.add(current.path);
		current = current.parent ? lookup(current.parent) : null;
	}
	return titles;
}

export function QueryBlock({ query }: { readonly query: BlockQuery }): ReactNode {
	const services = PpvContext.useService();
	useStore(services.version);
	const snapshot = useStore(services.index.snapshot);
	const projects = selectProjects(snapshot.notes.values(), query, (note) =>
		ancestorTitles(note, (path) => snapshot.notes.get(path) ?? null),
	);
	if (query.view === "projects") {
		return <ProjectList projects={projects} empty="No matching projects." />;
	}
	const tasks = projects.flatMap((project) =>
		services.service.nextActions(project.path, query.limit).map((task) => ({ task, project })),
	);
	if (tasks.length === 0) {
		return <p className="sbos-muted">No open tasks.</p>;
	}
	return (
		<ul className="sbos-task-list">
			{tasks.slice(0, query.limit).map(({ task, project }) => {
				const title = displayText(stripTimeBlock(task.text));
				return (
					<li key={`${task.path}:${task.line}`}>
						<input
							type="checkbox"
							className="task-list-item-checkbox"
							aria-label={`Complete ${title}`}
							checked={false}
							onChange={() => services.toggleTask(task)}
						/>
						<button
							type="button"
							className="sbos-link"
							onClick={() => services.open(task.path, task.line)}
						>
							{title}
						</button>
						<span className="sbos-muted"> · {project.title}</span>
					</li>
				);
			})}
		</ul>
	);
}
