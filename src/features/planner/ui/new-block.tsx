import { useState, type ReactNode } from "react";

import { formatTime, parseTime, type Minutes } from "../../../shared/kernel";

export interface NewBlockFormProps {
	readonly start: Minutes;
	readonly end: Minutes;
	readonly onSubmit: (title: string, start: Minutes, end: Minutes) => Promise<string | null>;
	readonly onCancel: () => void;
}

/** Title, start and end for a new block. `onSubmit` returns an error message or null. */
export function NewBlockForm(props: NewBlockFormProps): ReactNode {
	const [title, setTitle] = useState("");
	const [start, setStart] = useState(formatTime(props.start));
	const [end, setEnd] = useState(formatTime(Math.min(props.end, 24 * 60 - 1)));
	const [error, setError] = useState<string | null>(null);

	const submit = async (): Promise<void> => {
		const startMinutes = parseTime(start);
		const endMinutes = parseTime(end);
		if (!title.trim()) {
			setError("Enter a title.");
		} else if (startMinutes === null || endMinutes === null) {
			setError("Enter times as HH:mm.");
		} else if (endMinutes <= startMinutes) {
			setError("The end must be after the start.");
		} else {
			setError(await props.onSubmit(title, startMinutes, endMinutes));
		}
	};

	return (
		<form
			className="sbos-new-block"
			onSubmit={(event) => {
				event.preventDefault();
				void submit();
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
			<label>
				Start
				<input
					type="time"
					value={start}
					onChange={(event) => setStart(event.target.value)}
				/>
			</label>
			<label>
				End
				<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
			</label>
			{error && (
				<p role="alert" className="sbos-new-block__error">
					{error}
				</p>
			)}
			<div className="modal-button-container">
				<button type="button" onClick={props.onCancel}>
					Cancel
				</button>
				<button type="submit" className="mod-cta">
					Add block
				</button>
			</div>
		</form>
	);
}
