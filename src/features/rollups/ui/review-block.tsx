import type { ReactNode } from "react";

import { formatDuration, type ReadableStore } from "../../../shared/kernel";
import { createServiceContext, useStore } from "../../../shared/react";
import type { PeriodReview } from "../domain/review";
import { sortedPillarTimes } from "../domain/review";

export interface ReviewServices {
	/** Changes whenever the review may have changed. */
	readonly version: ReadableStore<unknown>;
	readonly review: () => PeriodReview | null;
	readonly open: (path: string, line?: number) => void;
	/** Extra sections from other features, such as lint findings for the period. */
	readonly extra?: () => ReactNode;
}

export const ReviewContext = createServiceContext<ReviewServices>("ReviewServices");

const SHOWN = 25;

export function ReviewBlock(): ReactNode {
	const services = ReviewContext.useService();
	useStore(services.version);
	const review = services.review();
	if (!review) {
		return (
			<p className="sbos-muted">
				Put this block in a daily, weekly, monthly, quarterly or yearly note.
			</p>
		);
	}
	const pillars = sortedPillarTimes(review.clockedByPillar);
	return (
		<div className="sbos-review">
			<p className="sbos-muted">
				{review.range.from} to {review.range.to}
			</p>
			<h4>Completed ({review.completed.length})</h4>
			{review.completed.length === 0 ? (
				<p className="sbos-muted">Nothing completed in this period.</p>
			) : (
				<ul>
					{review.completed.slice(0, SHOWN).map((task) => (
						<li key={`${task.path}:${task.line}`}>
							<button
								type="button"
								className="sbos-link"
								onClick={() => services.open(task.path, task.line)}
							>
								{task.title}
							</button>{" "}
							<span className="sbos-muted">{task.done}</span>
						</li>
					))}
					{review.completed.length > SHOWN && (
						<li className="sbos-muted">and {review.completed.length - SHOWN} more</li>
					)}
				</ul>
			)}
			<h4>Time by pillar ({formatDuration(review.clockedTotal)})</h4>
			{pillars.length === 0 ? (
				<p className="sbos-muted">No time clocked in this period.</p>
			) : (
				<table className="sbos-review__table">
					<tbody>
						{pillars.map(([pillar, minutes]) => (
							<tr key={pillar}>
								<th scope="row">{pillar || "Not linked to a pillar"}</th>
								<td>{formatDuration(minutes)}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
			<h4>Projects</h4>
			{review.projectsFinished.length === 0 && review.projectsStarted.length === 0 ? (
				<p className="sbos-muted">No projects started or finished.</p>
			) : (
				<ul>
					{review.projectsFinished.map((project) => (
						<li key={`done-${project.path}`}>
							Finished{" "}
							<button
								type="button"
								className="sbos-link"
								onClick={() => services.open(project.path)}
							>
								{project.title}
							</button>{" "}
							<span className="sbos-muted">{project.date}</span>
						</li>
					))}
					{review.projectsStarted.map((project) => (
						<li key={`start-${project.path}`}>
							Started{" "}
							<button
								type="button"
								className="sbos-link"
								onClick={() => services.open(project.path)}
							>
								{project.title}
							</button>{" "}
							<span className="sbos-muted">{project.date}</span>
						</li>
					))}
				</ul>
			)}
			{services.extra?.()}
		</div>
	);
}
