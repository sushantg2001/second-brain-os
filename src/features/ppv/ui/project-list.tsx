import type { ReactNode } from "react";

import { formatDuration } from "../../../shared/kernel";
import { displayText, stripTimeBlock } from "../../tasks";
import type { PpvNote } from "../domain/ppv-note";
import { STATUS_LABELS } from "../domain/settings";
import { PpvContext } from "./services";

export function ProjectRow({ project }: { readonly project: PpvNote }): ReactNode {
	const services = PpvContext.useService();
	const summary = services.summary(project);
	const next = services.service.nextActions(project.path, 1)[0];
	const percent = summary.total === 0 ? 0 : Math.round((summary.done / summary.total) * 100);
	return (
		<li className={`sbos-project sbos-project--${project.status}`}>
			<div className="sbos-project__main">
				<button
					type="button"
					className="sbos-link"
					onClick={() => services.open(project.path)}
				>
					{project.title}
				</button>
				<span className="sbos-pill">{STATUS_LABELS[project.status]}</span>
				{project.due && <span className="sbos-project__due">Due {project.due}</span>}
			</div>
			<div className="sbos-project__meta">
				<progress
					max={100}
					value={percent}
					aria-label={`${project.title}: ${summary.done} of ${summary.total} tasks done`}
				/>
				<span>
					{summary.done}/{summary.total}
				</span>
				{summary.clockedMinutes > 0 && (
					<span>⏱ {formatDuration(summary.clockedMinutes)}</span>
				)}
			</div>
			{next && (
				<div className="sbos-project__next">
					<input
						type="checkbox"
						className="task-list-item-checkbox"
						aria-label={`Complete next action: ${displayText(stripTimeBlock(next.text))}`}
						checked={false}
						onChange={() => services.toggleTask(next)}
					/>
					<button
						type="button"
						className="sbos-link"
						onClick={() => services.open(next.path, next.line)}
					>
						{displayText(stripTimeBlock(next.text))}
					</button>
				</div>
			)}
		</li>
	);
}

export function ProjectList({
	projects,
	empty = "No projects.",
}: {
	readonly projects: readonly PpvNote[];
	readonly empty?: string;
}): ReactNode {
	if (projects.length === 0) {
		return <p className="sbos-muted">{empty}</p>;
	}
	return (
		<ul className="sbos-project-list">
			{projects.map((project) => (
				<ProjectRow key={project.path} project={project} />
			))}
		</ul>
	);
}
