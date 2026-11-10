import {
	useRef,
	useState,
	type DragEvent,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
} from "react";

import { formatDuration, formatTime, type IsoDate, type Minutes } from "../../../shared/kernel";
import { Icon, useStore } from "../../../shared/react";
import { isClosed } from "../../tasks";
import { childrenOf, descendantsOf, type PlannedBlock } from "../domain/day-plan";
import { PlannerContext } from "./services";

type DragKind = "move" | "resize" | "create";

interface Drag {
	readonly kind: DragKind;
	readonly block: PlannedBlock | null;
	readonly originY: number;
	readonly start: Minutes;
	readonly end: Minutes;
	readonly moved: boolean;
}

/** Drag distance in pixels before a press counts as a drag instead of a click. */
const DRAG_THRESHOLD = 4;
/** Blocks shorter than this (in pixels) show only their summary, not the time range. */
const SHORT_BLOCK = 44;
/** Pixels a sub task is indented for each level it is nested below its block. */
const SUBTASK_INDENT = 14;
/**
 * Share of the day's width, in percent, kept for clocked time, by how deeply the day's tasks are
 * nested. Each level of nesting is a column of its own, so a deeper day needs a wider lane.
 */
const CLOCK_LANE = [40, 52, 58];
/** Clocked blocks shorter than this (in pixels) show only their title, not the time range. */
const SHORT_CLOCK = 30;
export const TASK_DRAG_TYPE = "application/x-sbos-task";

type Relation = "past" | "present" | "future";

/** Whether a block on `date` is over, running, or still to come. */
function relationToNow(
	date: IsoDate,
	now: { readonly date: IsoDate; readonly minutes: Minutes },
	start: Minutes,
	end: Minutes,
): Relation {
	if (date !== now.date) {
		return date < now.date ? "past" : "future";
	}
	if (now.minutes >= end) {
		return "past";
	}
	return now.minutes >= start ? "present" : "future";
}

export function TimelineDay({ date }: { readonly date: IsoDate }): ReactNode {
	const services = PlannerContext.useService();
	const { planner } = services;
	useStore(services.version);
	const now = useStore(services.now);
	const settings = useStore(planner.settingsStore);
	const plan = planner.plan(date);
	// A task's clocked time is drawn as a block with its sub tasks' blocks in the columns beside it.
	const clocked = services.clocks?.rangesOn(date) ?? [];
	const clockedDepth = Math.max(0, ...clocked.map((range) => range.depth));
	const lane =
		clocked.length === 0 ? 0 : (CLOCK_LANE[Math.min(clockedDepth, CLOCK_LANE.length - 1)] ?? 0);
	const [drag, setDrag] = useState<Drag | null>(null);
	const dragRef = useRef<Drag | null>(null);
	const suppressClick = useRef(false);
	const columnRef = useRef<HTMLDivElement>(null);

	const step = settings.snapMinutes;
	const dayStart = settings.startHour * 60;
	const dayEnd = settings.endHour * 60;
	const perMinute = settings.hourHeight / 60;
	const top = (minute: Minutes): number =>
		(Math.min(Math.max(minute, dayStart), dayEnd) - dayStart) * perMinute;
	const minuteAt = (clientY: number): Minutes => {
		const rect = columnRef.current?.getBoundingClientRect();
		return dayStart + (clientY - (rect?.top ?? 0)) / perMinute;
	};
	const snap = (minute: number): Minutes => Math.round(minute / step) * step;

	const update = (next: Drag | null): void => {
		dragRef.current = next;
		setDrag(next);
	};

	const run = (action: Promise<{ ok: boolean; error?: Error }>): void => {
		void action.then((result) => {
			if (!result.ok && result.error) {
				services.report(result.error);
			}
		});
	};

	const begin = (kind: DragKind, block: PlannedBlock | null, event: PointerEvent): void => {
		if (event.button !== 0) {
			return;
		}
		event.stopPropagation();
		event.currentTarget.setPointerCapture?.(event.pointerId);
		const start = block ? block.start : snap(minuteAt(event.clientY) - step / 2);
		const end = block ? block.end : start + step;
		update({ kind, block, originY: event.clientY, start, end, moved: false });
	};

	const onPointerMove = (event: PointerEvent): void => {
		const current = dragRef.current;
		if (!current) {
			return;
		}
		const deltaPixels = event.clientY - current.originY;
		const moved = current.moved || Math.abs(deltaPixels) >= DRAG_THRESHOLD;
		const delta = snap(deltaPixels / perMinute);
		const original = current.block;
		let { start, end } = current;
		if (current.kind === "move" && original) {
			start = original.start + delta;
			end = original.end + delta;
		} else if (current.kind === "resize" && original) {
			end = Math.max(original.start + step, original.end + delta);
		} else if (current.kind === "create") {
			const anchor = snap(minuteAt(current.originY) - step / 2);
			const pointer = snap(minuteAt(event.clientY));
			start = Math.min(anchor, pointer);
			end = Math.max(anchor + step, pointer);
		}
		update({ ...current, start, end, moved });
	};

	const onPointerUp = (): void => {
		const current = dragRef.current;
		update(null);
		if (!current) {
			return;
		}
		if (current.kind === "create") {
			const end = current.moved ? current.end : current.start + settings.defaultDuration;
			services.newBlock(date, current.start, end);
			return;
		}
		if (current.block && current.moved) {
			suppressClick.current = true;
			if (current.start !== current.block.start || current.end !== current.block.end) {
				run(
					current.kind === "move"
						? planner.moveBlockWithChildren(
								current.block,
								descendantsOf(plan, current.block),
								current.start,
							)
						: planner.moveBlock(current.block, current.start, current.end),
				);
			}
		}
	};

	const onBlockKeyDown = (block: PlannedBlock, event: KeyboardEvent): void => {
		const direction = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
		if (direction !== 0) {
			const delta = direction * step;
			run(
				event.shiftKey
					? planner.moveBlock(
							block,
							block.start,
							Math.max(block.start + step, block.end + delta),
						)
					: planner.moveBlockWithChildren(
							block,
							descendantsOf(plan, block),
							block.start + delta,
						),
			);
		} else if (event.key === "Delete" || event.key === "Backspace") {
			run(planner.unschedule(block));
		} else {
			return;
		}
		event.preventDefault();
	};

	const onDrop = (event: DragEvent): void => {
		const id = event.dataTransfer.getData(TASK_DRAG_TYPE);
		const task = [...plan.unscheduled, ...planner.plan(planner.today()).unscheduled].find(
			(candidate) => candidate.id === id,
		);
		if (task) {
			event.preventDefault();
			run(planner.schedule(task, date, snap(minuteAt(event.clientY))));
		}
	};

	/** A block, with the blocks inside it drawn within it, positioned from the parent's top. */
	const renderBlock = (block: PlannedBlock, parent: PlannedBlock | null): ReactNode => {
		const live = drag?.block?.id === block.id && drag.moved ? drag : null;
		const start = live ? live.start : block.start;
		const end = live ? live.end : block.end;
		const closed = isClosed(block.state);
		const label = `${formatTime(start)} to ${formatTime(end)}, ${block.title}${closed ? ", done" : ""}`;
		const when = relationToNow(date, now, start, end);
		const height = Math.max(top(end) - top(start), 18);
		const running = services.clocks?.isRunning(block) ?? false;
		const inside = childrenOf(plan, block);
		const subtasksDone = block.subtasks.filter((task) => isClosed(task.state)).length;
		return (
			<div
				key={block.id}
				className={`sbos-block is-${when}${height < SHORT_BLOCK ? " is-short" : ""}${closed ? " is-done" : ""}${live ? " is-dragging" : ""}${block.source === "scheduled" ? " is-scheduled" : ""}${parent ? " is-nested" : ""}${inside.length > 0 ? " has-children" : ""}`}
				data-depth={block.depth}
				style={{
					top: `${top(start) - (parent ? top(parent.start) : 0)}px`,
					height: `${height}px`,
					// Planned blocks leave the clocked lane free; blocks inside another do not
					// share the day with it, so they keep a share of their parent.
					left:
						parent || lane === 0
							? `${(block.column / block.columns) * 100}%`
							: `calc((100% - ${lane}%) * ${block.column / block.columns})`,
					width:
						parent || lane === 0
							? `${100 / block.columns}%`
							: `calc((100% - ${lane}%) / ${block.columns})`,
				}}
				onPointerDown={(event) => begin("move", block, event)}
			>
				<input
					type="checkbox"
					className="task-list-item-checkbox"
					checked={block.state === "done"}
					aria-label={`Done: ${block.title}`}
					onPointerDown={(event) => event.stopPropagation()}
					onChange={() => run(planner.toggleDone(block))}
				/>
				<button
					type="button"
					className="sbos-block__title"
					aria-label={label}
					title={`${formatTime(start)} – ${formatTime(end)}${
						block.subtasks.length > 0
							? ` · ${subtasksDone} of ${block.subtasks.length} sub tasks done`
							: ""
					}`}
					aria-keyshortcuts="ArrowUp ArrowDown Shift+ArrowUp Shift+ArrowDown Delete"
					onClick={() => {
						if (suppressClick.current) {
							suppressClick.current = false;
							return;
						}
						services.openTask(block);
					}}
					onKeyDown={(event) => onBlockKeyDown(block, event)}
				>
					<span className="sbos-block__summary">{block.title}</span>
					{block.subtasks.length > 0 && (
						<span className="sbos-block__count" aria-hidden="true">
							{subtasksDone}/{block.subtasks.length}
						</span>
					)}
					<span className="sbos-block__time">
						{formatTime(start)} – {formatTime(end)}
					</span>
				</button>
				{block.subtasks.length > 0 && (
					<ul className="sbos-block__subtasks" aria-label={`Sub tasks of ${block.title}`}>
						{block.subtasks.map((task) => (
							<li
								key={task.id}
								className={`sbos-subtask is-${task.state}`}
								style={{
									paddingInlineStart: `${task.level * SUBTASK_INDENT}px`,
								}}
							>
								<input
									type="checkbox"
									className="task-list-item-checkbox"
									checked={task.state === "done"}
									aria-label={`Done: ${task.title}`}
									onPointerDown={(event) => event.stopPropagation()}
									onChange={() => run(planner.toggleDone(task))}
								/>
								<button
									type="button"
									className="sbos-subtask__title"
									onPointerDown={(event) => event.stopPropagation()}
									onClick={() => services.openTask(task)}
								>
									{task.title}
								</button>
							</li>
						))}
					</ul>
				)}
				{services.clocks && !closed && (
					<button
						type="button"
						className={`sbos-block__clock${running ? " is-running" : ""}`}
						aria-label={`${running ? "Stop" : "Start"} clock on ${block.title}`}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={() => services.clocks?.toggle(block)}
					>
						<Icon name={running ? "square" : "play"} />
					</button>
				)}
				{inside.length > 0 && (
					<div className="sbos-block__children">
						{inside.map((child) => renderBlock(child, block))}
					</div>
				)}
				<div
					className="sbos-block__resize"
					aria-hidden="true"
					onPointerDown={(event) => begin("resize", block, event)}
				/>
			</div>
		);
	};

	const hours = Array.from(
		{ length: settings.endHour - settings.startHour },
		(_, index) => settings.startHour + index,
	);
	const isToday = date === now.date;

	return (
		<div
			ref={columnRef}
			className="sbos-timeline__column"
			style={{ height: `${(dayEnd - dayStart) * perMinute}px` }}
			data-date={date}
			onPointerDown={(event) => begin("create", null, event)}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={() => update(null)}
			onDragOver={(event) => {
				if (event.dataTransfer.types.includes(TASK_DRAG_TYPE)) {
					event.preventDefault();
				}
			}}
			onDrop={onDrop}
		>
			{hours.map((hour) => (
				<div
					key={hour}
					className="sbos-timeline__hour"
					style={{ top: `${top(hour * 60)}px`, height: `${settings.hourHeight}px` }}
					aria-hidden="true"
				>
					<div className="sbos-timeline__half" />
				</div>
			))}
			{plan.blocks
				.filter((block) => block.parentId === null)
				.map((block) => renderBlock(block, null))}
			{lane > 0 && (
				<div className="sbos-clocks" style={{ width: `${lane}%` }}>
					{clocked.map((range) => {
						const column = 100 / (clockedDepth + 1);
						const left = range.depth * column;
						const height = Math.max(top(range.end) - top(range.start), 2);
						// Clocked time is tracked to the second; the labels are whole minutes.
						const span = `${formatTime(Math.floor(range.start))} – ${formatTime(Math.floor(range.end))}`;
						return (
							<div
								key={range.key}
								className={`sbos-clock${range.running ? " is-running" : ""}${range.leaf ? " is-leaf" : ""}${height < SHORT_CLOCK ? " is-short" : ""}`}
								data-depth={range.depth}
								style={{
									top: `${top(range.start)}px`,
									height: `${height}px`,
									left: `${left}%`,
									// A block with sub tasks leaves the columns after it to them.
									width: `${range.leaf ? 100 - left : column}%`,
								}}
							>
								<button
									type="button"
									className="sbos-clock__title"
									aria-label={`Clocked ${span}, ${range.title}${range.running ? ", running" : ""}`}
									title={`${range.title}: ${formatDuration(range.end - range.start)}${range.running ? ", running" : ""}`}
									onPointerDown={(event) => event.stopPropagation()}
									onClick={() => services.openTask(range)}
								>
									<span className="sbos-clock__summary">{range.title}</span>
									<span className="sbos-clock__time">
										{span} · {formatDuration(range.end - range.start)}
									</span>
								</button>
							</div>
						);
					})}
				</div>
			)}
			{drag?.kind === "create" && (
				<div
					className="sbos-block is-ghost"
					style={{
						top: `${top(drag.start)}px`,
						height: `${top(drag.end) - top(drag.start)}px`,
					}}
					aria-hidden="true"
				>
					{formatTime(drag.start)}–{formatTime(drag.end)} ·{" "}
					{formatDuration(drag.end - drag.start)}
				</div>
			)}
			{isToday && now.minutes >= dayStart && now.minutes <= dayEnd && (
				<div
					className="sbos-timeline__now"
					style={{ top: `${top(now.minutes)}px` }}
					aria-hidden="true"
				/>
			)}
		</div>
	);
}
