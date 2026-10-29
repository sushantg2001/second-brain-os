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

/**
 * A read-only view of part of a store. Listeners run only when the selected value changes
 * (by Object.is), and `get` is memoised on the source value so React sees a stable snapshot.
 */
export function select<T, S>(
	source: ReadableStore<T>,
	selector: (value: T) => S,
): ReadableStore<S> {
	let lastSource = source.get();
	let lastValue = selector(lastSource);
	const get = (): S => {
		const current = source.get();
		if (!Object.is(current, lastSource)) {
			lastSource = current;
			lastValue = selector(current);
		}
		return lastValue;
	};
	const subscribe = (listener: Listener): (() => void) => {
		let previous = get();
		return source.subscribe(() => {
			const next = get();
			if (!Object.is(next, previous)) {
				previous = next;
				listener();
			}
		});
	};
	return { get, subscribe };
}
