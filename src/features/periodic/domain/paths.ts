/** Vault paths always use "/", never start or end with one, and have no empty segments. */
export function normalizeVaultPath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.split("/")
		.filter((segment) => segment !== "" && segment !== ".")
		.join("/");
}

export function joinPath(folder: string, name: string): string {
	return normalizeVaultPath(`${folder}/${name}`);
}

export function notePath(folder: string, basename: string): string {
	return joinPath(folder, `${basename}.md`);
}

/** Adds ".md" when a template path was written without it. */
export function withMarkdownExtension(path: string): string {
	const normalized = normalizeVaultPath(path);
	return normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`;
}

export function parentFolder(path: string): string {
	const normalized = normalizeVaultPath(path);
	const index = normalized.lastIndexOf("/");
	return index === -1 ? "" : normalized.slice(0, index);
}

export function basename(path: string): string {
	const name = normalizeVaultPath(path).split("/").pop() ?? "";
	return name.replace(/\.md$/i, "");
}
