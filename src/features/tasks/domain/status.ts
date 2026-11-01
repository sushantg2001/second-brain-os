/** Task states, following the Tasks plugin's default status symbols. */
export type TaskState = "todo" | "in-progress" | "done" | "cancelled" | "waiting";

const SYMBOLS: Readonly<Record<string, TaskState>> = {
	" ": "todo",
	"/": "in-progress",
	x: "done",
	X: "done",
	"-": "cancelled",
	">": "waiting",
};

export function stateOf(symbol: string): TaskState {
	return SYMBOLS[symbol] ?? "todo";
}

export function isClosed(state: TaskState): boolean {
	return state === "done" || state === "cancelled";
}

export const STATE_SYMBOL: Readonly<Record<TaskState, string>> = {
	todo: " ",
	"in-progress": "/",
	done: "x",
	cancelled: "-",
	waiting: ">",
};
