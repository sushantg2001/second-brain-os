export interface TemplateContext {
	readonly title: string;
	/** Formats the note's date with a moment format. */
	readonly formatDate: (format: string) => string;
	/** Formats the current time with a moment format. */
	readonly formatNow: (format: string) => string;
}

/**
 * Fills the built-in placeholders: {{title}}, {{date}}, {{date:FORMAT}}, {{time}} and
 * {{time:FORMAT}}. Templater syntax (<% %>) is left for Templater to process afterwards.
 */
export function renderTemplate(template: string, context: TemplateContext): string {
	return template
		.replace(/{{\s*title\s*}}/gi, () => context.title)
		.replace(/{{\s*date(?::(.*?))?\s*}}/gi, (_, format: string | undefined) =>
			context.formatDate(format?.trim() || "YYYY-MM-DD"),
		)
		.replace(/{{\s*time(?::(.*?))?\s*}}/gi, (_, format: string | undefined) =>
			context.formatNow(format?.trim() || "HH:mm"),
		);
}
