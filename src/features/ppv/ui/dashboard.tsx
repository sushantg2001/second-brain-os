import { useState, type ReactNode } from "react";

import { formatDuration } from "../../../shared/kernel";
import { useStore } from "../../../shared/react";
import type { PpvNote } from "../domain/ppv-note";
import { isClosedStatus, type ProjectStatus } from "../domain/settings";
import type { GoalNode } from "../domain/tree";
import { ProjectList } from "./project-list";
import { PpvContext } from "./services";

type Filter = "open" | "active" | "all";

const FILTERS: Readonly<Record<Filter, (status: ProjectStatus) => boolean>> = {
	open: (status) => !isClosedStatus(status),
	active: (status) => status === "active",
	all: () => true,
};

function Progress({ note }: { readonly note: PpvNote }): ReactNode {
	const services = PpvContext.useService();
	const totals = services.aggregate?.(note);
	if (!totals || totals.total === 0) {
		return null;
	}
	return (
		<span className="sbos-progress">
			<progress
				max={totals.total}
				value={totals.done}
				aria-label={`${note.title}: ${totals.done} of ${totals.total} tasks done`}
			/>
			{totals.clockedMinutes > 0 && (
				<span className="sbos-muted">⏱ {formatDuration(totals.clockedMinutes)}</span>
			)}
		</span>
	);
}

function Goal({
	goal,
	keep,
}: {
	readonly goal: GoalNode;
	readonly keep: (project: PpvNote) => boolean;
}): ReactNode {
	const services = PpvContext.useService();
	return (
		<li className="sbos-goal">
			<div className="sbos-goal__header">
				<button
					type="button"
					className="sbos-link sbos-goal__title"
					onClick={() => services.open(goal.note.path)}
				>
					{goal.note.title}
				</button>
				{goal.note.kind && <span className="sbos-pill">{goal.note.kind}</span>}
				{goal.note.due && <span className="sbos-muted">Due {goal.note.due}</span>}
				<Progress note={goal.note} />
				<button
					type="button"
					className="sbos-icon-button"
					aria-label={`New project for ${goal.note.title}`}
					onClick={() => services.newNote("project", goal.note)}
				>
					+
				</button>
			</div>
			<ProjectList projects={goal.projects.filter(keep)} />
		</li>
	);
}

export function Dashboard(): ReactNode {
	const services = PpvContext.useService();
	useStore(services.version);
	const { tree } = useStore(services.index.snapshot);
	const [filter, setFilter] = useState<Filter>("open");
	const keep = (project: PpvNote): boolean => FILTERS[filter](project.status);
	const empty =
		tree.pillars.length === 0 &&
		tree.looseGoals.length === 0 &&
		tree.looseProjects.length === 0;

	return (
		<div className="sbos-dashboard">
			<div className="sbos-dashboard__toolbar">
				<h2>Pillars, goals and projects</h2>
				<label>
					Show
					<select
						value={filter}
						onChange={(event) => setFilter(event.target.value as Filter)}
					>
						<option value="open">Open projects</option>
						<option value="active">Active projects</option>
						<option value="all">All projects</option>
					</select>
				</label>
				<button type="button" onClick={() => services.newNote("pillar")}>
					New pillar
				</button>
				<button type="button" onClick={() => services.newNote("goal")}>
					New goal
				</button>
				<button type="button" onClick={() => services.newNote("project")}>
					New project
				</button>
			</div>
			{empty && (
				<div className="sbos-empty">
					<p>
						No pillars yet. Pillars are the areas of life you keep up, like health or
						work.
					</p>
					<button type="button" className="mod-cta" onClick={services.setUp}>
						Set up folders and an example pillar
					</button>
				</div>
			)}
			{tree.pillars.map((pillar) => (
				<section
					key={pillar.note.path}
					className="sbos-pillar"
					aria-labelledby={`pillar-${pillar.note.path}`}
				>
					<div className="sbos-pillar__header">
						<h3 id={`pillar-${pillar.note.path}`}>
							<button
								type="button"
								className="sbos-link"
								onClick={() => services.open(pillar.note.path)}
							>
								{pillar.note.title}
							</button>
						</h3>
						<Progress note={pillar.note} />
						<button
							type="button"
							className="sbos-icon-button"
							aria-label={`New goal for ${pillar.note.title}`}
							onClick={() => services.newNote("goal", pillar.note)}
						>
							+
						</button>
					</div>
					{pillar.goals.length === 0 && <p className="sbos-muted">No goals yet.</p>}
					<ul className="sbos-goal-list">
						{pillar.goals.map((goal) => (
							<Goal key={goal.note.path} goal={goal} keep={keep} />
						))}
					</ul>
					{pillar.projects.filter(keep).length > 0 && (
						<ProjectList projects={pillar.projects.filter(keep)} />
					)}
				</section>
			))}
			{(tree.looseGoals.length > 0 || tree.looseProjects.filter(keep).length > 0) && (
				<section className="sbos-pillar sbos-pillar--loose" aria-labelledby="sbos-loose">
					<h3 id="sbos-loose">Not linked to a pillar</h3>
					<ul className="sbos-goal-list">
						{tree.looseGoals.map((goal) => (
							<Goal key={goal.note.path} goal={goal} keep={keep} />
						))}
					</ul>
					<ProjectList projects={tree.looseProjects.filter(keep)} empty="" />
				</section>
			)}
		</div>
	);
}
