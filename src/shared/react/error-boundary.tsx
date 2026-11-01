import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
	readonly children: ReactNode;
}

interface ErrorBoundaryState {
	readonly error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	override state: ErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
		return { error: error instanceof Error ? error : new Error(String(error)) };
	}

	override componentDidCatch(error: Error, info: ErrorInfo): void {
		console.error("[second-brain-os] view crashed", error, info.componentStack);
	}

	private readonly reset = (): void => {
		this.setState({ error: null });
	};

	override render(): ReactNode {
		const { error } = this.state;
		if (!error) {
			return this.props.children;
		}
		return (
			<div role="alert" className="sbos-error">
				<p>Something went wrong in this view.</p>
				<pre className="sbos-error__message">{error.message}</pre>
				<button type="button" onClick={this.reset}>
					Try again
				</button>
			</div>
		);
	}
}
