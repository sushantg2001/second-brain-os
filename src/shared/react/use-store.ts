import { useCallback, useSyncExternalStore } from "react";

import type { ReadableStore } from "../kernel";

export function useStore<T>(store: ReadableStore<T>): T {
	return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Subscribes to a derived slice. The selector must return a stable value for unchanged input. */
export function useStoreSelector<T, S>(store: ReadableStore<T>, selector: (value: T) => S): S {
	const getSlice = useCallback(() => selector(store.get()), [store, selector]);
	return useSyncExternalStore(store.subscribe, getSlice, getSlice);
}
