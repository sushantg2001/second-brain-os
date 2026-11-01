import { createContext, useContext, type ReactNode } from "react";

export interface ServiceContext<T> {
	readonly Provider: (props: { value: T; children: ReactNode }) => ReactNode;
	readonly useService: () => T;
}

/**
 * Creates a typed context for one service so components receive dependencies from the
 * composition root instead of importing them. Tests provide fakes through the same Provider.
 */
export function createServiceContext<T>(name: string): ServiceContext<T> {
	const Context = createContext<T | null>(null);
	Context.displayName = name;

	function Provider({ value, children }: { value: T; children: ReactNode }): ReactNode {
		return <Context.Provider value={value}>{children}</Context.Provider>;
	}

	function useService(): T {
		const value = useContext(Context);
		if (value === null) {
			throw new Error(`${name} is not provided. Wrap the component in its Provider.`);
		}
		return value;
	}

	return { Provider, useService };
}
