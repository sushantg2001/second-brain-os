import { describe, expect, it } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { Store } from "../../src/shared/kernel";
import { useStore, useStoreSelector } from "../../src/shared/react";

interface Counter {
	readonly count: number;
	readonly label: string;
}

const selectCount = (value: Counter): number => value.count;

function CountView({ store }: { store: Store<Counter> }): ReactNode {
	const { label } = useStore(store);
	const count = useStoreSelector(store, selectCount);
	return (
		<p>
			{label}: {count}
		</p>
	);
}

describe("useStore", () => {
	it("re-renders when the store changes", () => {
		const store = new Store<Counter>({ count: 1, label: "Items" });
		render(<CountView store={store} />);
		expect(screen.getByText("Items: 1")).toBeInTheDocument();

		act(() => store.set({ count: 2, label: "Tasks" }));

		expect(screen.getByText("Tasks: 2")).toBeInTheDocument();
	});
});
