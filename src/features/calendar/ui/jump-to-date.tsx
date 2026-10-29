import { useState, type ReactNode } from "react";

import { fromParts, type DateFormatter } from "../../../shared/kernel";

export interface JumpToDateProps {
	readonly dates: DateFormatter;
	readonly initialYear: number;
	readonly currentMonth: number;
	readonly onPick: (year: number, month: number) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/** Two steps: type a year, then pick a month. Enter keeps the current month. */
export function JumpToDate({
	dates,
	initialYear,
	currentMonth,
	onPick,
}: JumpToDateProps): ReactNode {
	const [text, setText] = useState(String(initialYear));
	const year = /^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : null;
	const valid = year !== null && year >= 1 && year <= 9999;

	return (
		<form
			className="sbos-jump"
			onSubmit={(event) => {
				event.preventDefault();
				if (valid) {
					onPick(year, currentMonth);
				}
			}}
		>
			<label className="sbos-jump__year">
				Year
				<input
					type="text"
					inputMode="numeric"
					value={text}
					aria-invalid={!valid}
					// The year field is the only field, so it should take focus when the dialog opens.
					// eslint-disable-next-line jsx-a11y/no-autofocus -- see above
					autoFocus
					onChange={(event) => setText(event.target.value)}
				/>
			</label>
			<div className="sbos-jump__months" role="group" aria-label="Month">
				{MONTHS.map((month) => {
					const first = valid ? fromParts(year, month, 1) : fromParts(2000, month, 1);
					return (
						<button
							key={month}
							type="button"
							disabled={!valid}
							aria-label={
								valid
									? dates.format(first, "MMMM YYYY")
									: dates.format(first, "MMMM")
							}
							className={month === currentMonth ? "mod-cta" : ""}
							onClick={() => valid && onPick(year, month)}
						>
							{dates.format(first, "MMM")}
						</button>
					);
				})}
			</div>
		</form>
	);
}
