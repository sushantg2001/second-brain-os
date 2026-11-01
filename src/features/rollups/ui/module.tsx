import { MarkdownRenderChild, type Plugin } from "obsidian";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
	Store,
	type NoteStore,
	type Notifier,
	type ReadableStore,
	type SettingsSection,
	type Workspace,
} from "../../../shared/kernel";
import { ErrorBoundary } from "../../../shared/react";
import type { Granularity, PeriodicNotes, PeriodicSettings } from "../../periodic";
import { appendToSection } from "../../tasks";
import type { Rollups } from "../application/rollups";
import type { DateRange } from "../domain/review";
import { ReviewBlock, ReviewContext, type ReviewServices } from "./review-block";

export interface RollupsModuleDeps {
	readonly rollups: Rollups;
	readonly periodic: PeriodicNotes;
	readonly periodicSettings: SettingsSection<PeriodicSettings>;
	readonly notes: NoteStore;
	readonly workspace: Workspace;
	readonly notifier: Notifier;
	/** Stores whose changes can change a review. */
	readonly sources: readonly ReadableStore<unknown>[];
	/** Extra review sections from other features. */
	readonly extra?: (range: DateRange) => ReactNode;
}

export const REVIEW_BLOCK = "sbos-review";
const TEMPLATE_FOLDER = "Templates";

const REVIEW_TEMPLATES: readonly { granularity: Granularity; name: string; next: string }[] = [
	{ granularity: "week", name: "Weekly review", next: "week" },
	{ granularity: "month", name: "Monthly review", next: "month" },
	{ granularity: "quarter", name: "Quarterly review", next: "quarter" },
	{ granularity: "year", name: "Yearly review", next: "year" },
];

export function reviewTemplate(next: string): string {
	return [
		"# {{title}}",
		"",
		"## Review",
		"```sbos-review",
		"```",
		"",
		"## Wins",
		"",
		"## Lessons",
		"",
		`## Focus for next ${next}`,
		"",
	].join("\n");
}

class ReviewChild extends MarkdownRenderChild {
	#root: Root | null = null;

	constructor(
		containerEl: HTMLElement,
		private readonly services: ReviewServices,
	) {
		super(containerEl);
	}

	override onload(): void {
		this.#root = createRoot(this.containerEl);
		this.#root.render(
			<ErrorBoundary>
				<ReviewContext.Provider value={this.services}>
					<ReviewBlock />
				</ReviewContext.Provider>
			</ErrorBoundary>,
		);
	}

	override onunload(): void {
		this.#root?.unmount();
		this.#root = null;
	}
}

/** The review code block and the commands around reviews and progress. */
export function registerRollups(plugin: Plugin, deps: RollupsModuleDeps): void {
	const { rollups, periodic, notifier } = deps;
	const version = new Store(0);
	for (const source of deps.sources) {
		plugin.register(source.subscribe(() => version.update((value) => value + 1)));
	}

	plugin.registerMarkdownCodeBlockProcessor(REVIEW_BLOCK, (_source, el, context) => {
		const services: ReviewServices = {
			version,
			review: () => rollups.reviewForNote(context.sourcePath),
			open: (path, line) => void deps.workspace.open(path, "current", line),
			...(deps.extra
				? {
						extra: () => {
							const review = rollups.reviewForNote(context.sourcePath);
							return review && deps.extra ? deps.extra(review.range) : null;
						},
					}
				: {}),
		};
		context.addChild(new ReviewChild(el, services));
	});

	plugin.addCommand({
		id: "insert-review",
		name: "Insert review into this periodic note",
		checkCallback: (checking) => {
			const path = deps.workspace.activePath();
			if (!path || !periodic.identify(path)) {
				return false;
			}
			if (!checking) {
				void deps.notes
					.process(path, (content) =>
						content.includes("```sbos-review")
							? content
							: appendToSection(content, "Review", ["```sbos-review", "```"]),
					)
					.then(() => undefined);
			}
			return true;
		},
	});

	plugin.addCommand({
		id: "create-review-templates",
		name: "Create review templates",
		callback: () =>
			void (async () => {
				const created: string[] = [];
				for (const { granularity, name, next } of REVIEW_TEMPLATES) {
					const path = `${TEMPLATE_FOLDER}/${name}.md`;
					if (!deps.notes.exists(path)) {
						await deps.notes.create(path, reviewTemplate(next));
						created.push(path);
					}
					if (!deps.periodicSettings.store.get().notes[granularity].template) {
						await deps.periodicSettings.update((settings) => ({
							...settings,
							notes: {
								...settings.notes,
								[granularity]: { ...settings.notes[granularity], template: path },
							},
						}));
					}
				}
				notifier.notify(
					created.length === 0
						? "Review templates already exist."
						: `Created ${created.length} review templates in ${TEMPLATE_FOLDER}.`,
				);
			})(),
	});

	plugin.addCommand({
		id: "write-progress",
		name: "Write progress to project notes",
		callback: () =>
			void rollups.writeProgress().then((changed) => {
				notifier.notify(
					changed === 1
						? "Updated progress on 1 project."
						: `Updated progress on ${changed} projects.`,
				);
			}),
	});
}
