export type Listener = () => void;

export interface ReadableStore<T> {
	readonly get: () => T;
	readonly subscribe: (listener: Listener) => () => void;
}

/**
 * Minimal observable value. `get` and `subscribe` are stable bound functions so they can be
 * handed straight to React's `useSyncExternalStore`.
 */
export class Store<T> implements ReadableStore<T> {
	#value: T;
	readonly #listeners = new Set<Listener>();

	constructor(initial: T) {
		this.#value = initial;
	}

	readonly get = (): T => this.#value;

	readonly subscribe = (listener: Listener): (() => void) => {
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	};

	set(value: T): void {
		if (Object.is(value, this.#value)) {
			return;
		}
		this.#value = value;
		for (const listener of [...this.#listeners]) {
			listener();
		}
	}

	update(updater: (current: T) => T): void {
		this.set(updater(this.#value));
	}
}
