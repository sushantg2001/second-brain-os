import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { ErrorBoundary } from "../../src/shared/react";

let shouldThrow = true;

function Fragile(): ReactNode {
	if (shouldThrow) {
		throw new Error("index unavailable");
	}
	return <p>Recovered</p>;
}

describe("ErrorBoundary", () => {
	let consoleError: { mockRestore: () => void };

	beforeEach(() => {
		shouldThrow = true;
		consoleError = spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleError.mockRestore();
	});

	it("renders children when nothing throws", () => {
		shouldThrow = false;
		render(
			<ErrorBoundary>
				<Fragile />
			</ErrorBoundary>,
		);
		expect(screen.getByText("Recovered")).toBeInTheDocument();
	});

	it("shows an alert with the error message instead of crashing the view", () => {
		render(
			<ErrorBoundary>
				<Fragile />
			</ErrorBoundary>,
		);

		const alert = screen.getByRole("alert");
		expect(alert).toHaveTextContent("Something went wrong in this view.");
		expect(alert).toHaveTextContent("index unavailable");
	});

	it("re-renders the children after Try again", async () => {
		render(
			<ErrorBoundary>
				<Fragile />
			</ErrorBoundary>,
		);

		shouldThrow = false;
		await userEvent.click(screen.getByRole("button", { name: "Try again" }));

		expect(screen.getByText("Recovered")).toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});
});
