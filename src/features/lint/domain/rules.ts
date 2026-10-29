import { compareDates, type IsoDate, type NowSnapshot } from "../../../shared/kernel";
import { clocksOf, minutesBetween } from "../../clocks";
import type { DayPlan } from "../../planner";
import { isClosedStatus, type PpvNote, type PpvType } from "../../ppv";
import { isClosed, type Task } from "../../tasks";

export type Severity = "error" | "warning" | "info";

export const RULE_IDS = [
	"orphan-goal",
	"orphan-project",
	"broken-parent",
	"wrong-parent",
	"no-next-action",
	"overdue-project",
	"malformed-time-block",
	"overlapping-blocks",
	"stale-clock",
] as const;

export type RuleId = (typeof RULE_IDS)[number];

export type LintFix =
	| {
			readonly kind: "close-clock";
			readonly path: string;
			readonly line: number;
			readonly raw: string;
	  }
	| { readonly kind: "set-parent"; readonly path: string; readonly type: PpvType };

export interface Finding {
	readonly rule: RuleId;
	readonly severity: Severity;
	readonly path: string;
	/** 0-based line, when the finding is about one line. */
	readonly line: number | null;
	readonly message: string;
	readonly fix: LintFix | null;
}

export interface RuleInfo {
	readonly title: string;
	readonly severity: Severity;
}

export const RULES: Readonly<Record<RuleId, RuleInfo>> = {
	"orphan-goal": { title: "Goal without a pillar", severity: "warning" },
	"orphan-project": { title: "Project without a goal or pillar", severity: "warning" },
	"broken-parent": { title: "Parent link does not resolve", severity: "error" },
	"wrong-parent": { title: "Parent is the wrong kind of note", severity: "warning" },
	"no-next-action": { title: "Active project without a next action", severity: "warning" },
	"overdue-project": { title: "Open project past its due date", severity: "warning" },
	"malformed-time-block": { title: "Time block ends before it starts", severity: "error" },
	"overlapping-blocks": { title: "Overlapping time blocks", severity: "info" },
	"stale-clock": { title: "Clock running for more than 12 hours", severity: "warning" },
};

export interface LintInput {
	readonly notes: ReadonlyMap<string, PpvNote>;
	readonly tasks: Iterable<Task>;
	/** Tasks that belong to a project, by project path. */
	readonly projectTasks: (path: string) => readonly Task[];
	readonly plans: Iterable<{ readonly path: string; readonly plan: DayPlan }>;
	readonly today: IsoDate;
	readonly now: NowSnapshot;
}

const ALLOWED_PARENTS: Readonly<Record<PpvType, readonly PpvType[]>> = {
	pillar: [],
	goal: ["pillar"],
	project: ["goal", "pillar"],
	resource: ["project", "pillar"],
};

export const STALE_CLOCK_MINUTES = 12 * 60;

function finding(
	rule: RuleId,
	path: string,
	line: number | null,
	message: string,
	fix: LintFix | null = null,
): Finding {
	return { rule, severity: RULES[rule].severity, path, line, message, fix };
}

function structureFindings(input: LintInput): Finding[] {
	const findings: Finding[] = [];
	for (const note of input.notes.values()) {
		if (note.parentLink !== null && note.parent === null) {
			findings.push(
				finding(
					"broken-parent",
					note.path,
					null,
					`${note.title} links to ${note.parentLink}, which does not exist.`,
				),
			);
			continue;
		}
		const parent = note.parent ? input.notes.get(note.parent) : undefined;
		if (note.parent && (!parent || !ALLOWED_PARENTS[note.type].includes(parent.type))) {
			const kind = parent ? `a ${parent.type}` : "not a pillar, goal or project";
			findings.push(
				finding(
					"wrong-parent",
					note.path,
					null,
					`${note.title} is linked to ${note.parentLink ?? note.parent}, which is ${kind}.`,
				),
			);
			continue;
		}
		if (note.type === "goal" && !note.parent) {
			findings.push(
				finding(
					"orphan-goal",
					note.path,
					null,
					`${note.title} is not linked to a pillar.`,
					{ kind: "set-parent", path: note.path, type: note.type },
				),
			);
		}
		if (note.type === "project" && !note.parent && !isClosedStatus(note.status)) {
			findings.push(
				finding(
					"orphan-project",
					note.path,
					null,
					`${note.title} is not linked to a goal or pillar.`,
					{
						kind: "set-parent",
						path: note.path,
						type: note.type,
					},
				),
			);
		}
	}
	return findings;
}

function projectFindings(input: LintInput): Finding[] {
	const findings: Finding[] = [];
	for (const note of input.notes.values()) {
		if (note.type !== "project" || isClosedStatus(note.status)) {
			continue;
		}
		if (note.due && compareDates(note.due, input.today) < 0) {
			findings.push(
				finding("overdue-project", note.path, null, `${note.title} was due ${note.due}.`),
			);
		}
		if (
			note.status === "active" &&
			!input
				.projectTasks(note.path)
				.some((task) => !isClosed(task.state) && task.text.trim() !== "")
		) {
			findings.push(
				finding(
					"no-next-action",
					note.path,
					null,
					`${note.title} is active but has no open task.`,
				),
			);
		}
	}
	return findings;
}

function taskFindings(input: LintInput): Finding[] {
	const findings: Finding[] = [];
	for (const task of input.tasks) {
		if (task.block?.malformed) {
			findings.push(
				finding(
					"malformed-time-block",
					task.path,
					task.line,
					`"${task.text}" ends before it starts.`,
				),
			);
		}
		for (const clock of clocksOf(task)) {
			if (
				clock.end === null &&
				minutesBetween(clock.start, input.now) > STALE_CLOCK_MINUTES
			) {
				findings.push(
					finding(
						"stale-clock",
						task.path,
						clock.line,
						`A clock on "${task.text}" has run since ${clock.start.date}.`,
						{ kind: "close-clock", path: task.path, line: task.line, raw: task.raw },
					),
				);
			}
		}
	}
	return findings;
}

function overlapFindings(input: LintInput): Finding[] {
	const findings: Finding[] = [];
	for (const { path, plan } of input.plans) {
		const overlapping = plan.blocks.filter(
			(block) => block.columns > 1 && !isClosed(block.state),
		);
		if (overlapping.length > 1) {
			findings.push(
				finding(
					"overlapping-blocks",
					path,
					overlapping[0]?.line ?? null,
					`${overlapping.length} blocks overlap on ${plan.date}: ${overlapping.map((block) => block.title).join(", ")}.`,
				),
			);
		}
	}
	return findings;
}

const ORDER: Readonly<Record<Severity, number>> = { error: 0, warning: 1, info: 2 };

/** Runs every rule. Findings are sorted by severity, then path and line. */
export function lint(input: LintInput): Finding[] {
	return [
		...structureFindings(input),
		...projectFindings(input),
		...taskFindings(input),
		...overlapFindings(input),
	].sort(
		(a, b) =>
			ORDER[a.severity] - ORDER[b.severity] ||
			a.path.localeCompare(b.path) ||
			(a.line ?? -1) - (b.line ?? -1),
	);
}
