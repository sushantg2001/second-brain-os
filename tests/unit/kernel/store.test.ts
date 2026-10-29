import { describe, expect, it, mock } from "bun:test";

import { Store } from "../../../src/shared/kernel";

describe("Store", () => {
	it("returns the initial value", () => {
		expect(new Store(1).get()).toBe(1);
	});

	it("notifies subscribers when the value changes", () => {
		const store = new Store(1);
		const listener = mock(() => {});
		store.subscribe(listener);

		store.set(2);

		expect(store.get()).toBe(2);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("does not notify when the value is identical", () => {
		const value = { a: 1 };
		const store = new Store(value);
		const listener = mock(() => {});
		store.subscribe(listener);

		store.set(value);

		expect(listener).not.toHaveBeenCalled();
	});

	it("stops notifying after unsubscribe", () => {
		const store = new Store(1);
		const listener = mock(() => {});
		const unsubscribe = store.subscribe(listener);

		unsubscribe();
		store.set(2);

		expect(listener).not.toHaveBeenCalled();
	});

	it("derives the next value with update", () => {
		const store = new Store(2);
		store.update((current) => current * 3);
		expect(store.get()).toBe(6);
	});

	it("tolerates a listener that unsubscribes while being notified", () => {
		const store = new Store(1);
		const second = mock(() => {});
		const unsubscribeFirst = store.subscribe(() => unsubscribeFirst());
		store.subscribe(second);

		store.set(2);

		expect(second).toHaveBeenCalledTimes(1);
	});

	it("exposes get and subscribe as bound functions", () => {
		const store = new Store("x");
		const { get, subscribe } = store;
		const listener = mock(() => {});
		subscribe(listener);
		store.set("y");
		expect(get()).toBe("y");
		expect(listener).toHaveBeenCalledTimes(1);
	});
});
