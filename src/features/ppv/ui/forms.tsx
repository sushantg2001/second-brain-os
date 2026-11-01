import { useState, type ReactNode } from "react";

import type { PpvNote } from "../domain/ppv-note";
import {
	PROJECT_STATUSES,
	STATUS_LABELS,
	TYPE_LABELS,
	type PpvType,
	type ProjectStatus,
} from "../domain/settings";

export interface NewNoteFormProps {
	readonly type: PpvType;
	readonly parents: readonly PpvNote[];
	readonly initialParent: string | null;
	readonly onSubmit: (
		title: string,
		parent: string | null,
		status: ProjectStatus,
	) => Promise<string | null>;
	readonly onCancel: () => void;
}

export function NewNoteForm(props: NewNoteFormProps): ReactNode {
	const [title, setTitle] = useState("");
	const [parent, setParent] = useState(props.initialParent ?? "");
	const [status, setStatus] = useState<ProjectStatus>("active");
	const [error, setError] = useState<string | null>(null);

	return (
		<form
			className="sbos-form"
			onSubmit={(event) => {
				event.preventDefault();
				void props.onSubmit(title, parent || null, status).then(setError);
			}}
		>
			<label>
				Title
				<input
					type="text"
					value={title}
					// The dialog's first field takes focus when it opens.
					// eslint-disable-next-line jsx-a11y/no-autofocus -- see above
					autoFocus
					onChange={(event) => setTitle(event.target.value)}
				/>
			</label>
			{props.type !== "pillar" && (
				<label>
					Linked to
					<select value={parent} onChange={(event) => setParent(event.target.value)}>
						<option value="">Nothing</option>
						{props.parents.map((note) => (
							<option key={note.path} value={note.path}>
								{TYPE_LABELS[note.type]}: {note.title}
							</option>
						))}
					</select>
				</label>
			)}
			{props.type === "project" && (
				<label>
					Status
					<select
						value={status}
						onChange={(event) => setStatus(event.target.value as ProjectStatus)}
					>
						{PROJECT_STATUSES.map((value) => (
							<option key={value} value={value}>
								{STATUS_LABELS[value]}
							</option>
						))}
					</select>
				</label>
			)}
			{error && (
				<p role="alert" className="sbos-form__error">
					{error}
				</p>
			)}
			<div className="modal-button-container">
				<button type="button" onClick={props.onCancel}>
					Cancel
				</button>
				<button type="submit" className="mod-cta">
					Create {TYPE_LABELS[props.type].toLowerCase()}
				</button>
			</div>
		</form>
	);
}

export function StatusPicker({
	current,
	onPick,
}: {
	readonly current: ProjectStatus;
	readonly onPick: (status: ProjectStatus) => void;
}): ReactNode {
	return (
		<div className="sbos-status-picker" role="group" aria-label="Project status">
			{PROJECT_STATUSES.map((status) => (
				<button
					key={status}
					type="button"
					aria-pressed={status === current}
					className={status === current ? "mod-cta" : ""}
					onClick={() => onPick(status)}
				>
					{STATUS_LABELS[status]}
				</button>
			))}
		</div>
	);
}

export function CaptureForm({
	destination,
	onSubmit,
}: {
	readonly destination: string;
	readonly onSubmit: (text: string, asTask: boolean) => Promise<string | null>;
}): ReactNode {
	const [text, setText] = useState("");
	const [asTask, setAsTask] = useState(true);
	const [error, setError] = useState<string | null>(null);
	return (
		<form
			className="sbos-form"
			onSubmit={(event) => {
				event.preventDefault();
				void onSubmit(text, asTask).then(setError);
			}}
		>
			<label>
				Capture
				<textarea
					value={text}
					rows={3}
					// The dialog's only text field takes focus when it opens.
					// eslint-disable-next-line jsx-a11y/no-autofocus -- see above
					autoFocus
					onChange={(event) => setText(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
							event.currentTarget.form?.requestSubmit();
						}
					}}
				/>
			</label>
			<label className="sbos-form__inline">
				<input
					type="checkbox"
					checked={asTask}
					onChange={(event) => setAsTask(event.target.checked)}
				/>
				As a task
			</label>
			<p className="sbos-muted">Goes to {destination}.</p>
			{error && (
				<p role="alert" className="sbos-form__error">
					{error}
				</p>
			)}
			<div className="modal-button-container">
				<button type="submit" className="mod-cta">
					Capture
				</button>
			</div>
		</form>
	);
}
