import type { Task } from "../../src/features/tasks";
import { tasksFromLists } from "../../src/infrastructure/dataview";

import { readLists } from "./fake-dataview";

/** The tasks of a note as the plugin sees them: what Dataview indexes, mapped by the adapter. */
export function tasksIn(path: string, content: string): Task[] {
	return tasksFromLists(path, readLists(content));
}
