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
import type { PlannedBlock } from "../domain/day-plan";
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
export const TASK_DRAG_TYPE = "application/x-sbos-task";

export function TimelineDay({ date }: { readonly date: IsoDate }): ReactNode {
	const services = PlannerContext.useService();
	const { planner } = services;
	useStore(services.version);
	const now = useStore(services.now);
	const settings = useStore(planner.settingsStore);
	const plan = planner.plan(date);
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
				run(planner.moveBlock(current.block, current.start, current.end));
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
					: planner.moveBlock(block, block.start + delta, block.end + delta),
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
				/>
			))}
			{plan.blocks.map((block) => {
				const live = drag?.block?.id === block.id && drag.moved ? drag : null;
				const start = live ? live.start : block.start;
				const end = live ? live.end : block.end;
				const closed = isClosed(block.state);
				const label = `${formatTime(start)} to ${formatTime(end)}, ${block.title}${closed ? ", done" : ""}`;
				return (
					<div
						key={block.id}
						className={`sbos-block${closed ? " is-done" : ""}${live ? " is-dragging" : ""}${block.source === "scheduled" ? " is-scheduled" : ""}`}
						style={{
							top: `${top(start)}px`,
							height: `${Math.max(top(end) - top(start), 18)}px`,
							left: `${(block.column / block.columns) * 100}%`,
							width: `${100 / block.columns}%`,
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
						{services.clocks && !closed && (
							<button
								type="button"
								className={`sbos-block__clock${services.clocks.isRunning(block) ? " is-running" : ""}`}
								aria-label={`${services.clocks.isRunning(block) ? "Stop" : "Start"} clock on ${block.title}`}
								onPointerDown={(event) => event.stopPropagation()}
								onClick={() => services.clocks?.toggle(block)}
							>
								<Icon name={services.clocks.isRunning(block) ? "square" : "play"} />
							</button>
						)}
						<button
							type="button"
							className="sbos-block__title"
							aria-label={label}
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
							<span className="sbos-block__time">
								{formatTime(start)}–{formatTime(end)}
							</span>{" "}
							{block.title}
						</button>
						<div
							className="sbos-block__resize"
							aria-hidden="true"
							onPointerDown={(event) => begin("resize", block, event)}
						/>
					</div>
				);
			})}
			{services.clocks?.rangesOn(date).map((range) => (
				<div
					key={`${range.taskId}-${range.start}`}
					className={`sbos-clocked${range.running ? " is-running" : ""}`}
					style={{
						top: `${top(range.start)}px`,
						height: `${Math.max(top(range.end) - top(range.start), 2)}px`,
					}}
					title={`Clocked: ${range.title}, ${formatDuration(range.end - range.start)}`}
					aria-hidden="true"
				/>
			))}
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
