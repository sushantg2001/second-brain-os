/**
 * An in-memory stand-in for the `obsidian` module. It behaves like the real API for the parts the
 * plugin uses: a vault that fires events, a metadata cache, a workspace with leaves, plugin
 * registration, modals and settings controls. Tests import it as "obsidian".
 */
import realMoment from "moment";

export const moment = realMoment;

export function normalizePath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.split("/")
		.filter((segment) => segment !== "")
		.join("/");
}

export function parseYaml(yaml: string): unknown {
	return Bun.YAML.parse(yaml);
}

export function stringifyYaml(value: unknown): string {
	return `${Bun.YAML.stringify(value, null, 2)}\n`;
}

export const Platform = {
	isMobile: false,
	isDesktop: true,
	isDesktopApp: true,
	isMobileApp: false,
};

export const Keymap = {
	isModEvent(event?: { ctrlKey?: boolean; metaKey?: boolean } | null): "tab" | false {
		return event && (event.ctrlKey || event.metaKey) ? "tab" : false;
	},
};

export class Notice {
	static readonly messages: string[] = [];
	readonly noticeEl = document.createElement("div");

	constructor(message: string | DocumentFragment, _timeout?: number) {
		Notice.messages.push(typeof message === "string" ? message : (message.textContent ?? ""));
	}

	setMessage(message: string): this {
		Notice.messages.push(message);
		return this;
	}

	hide(): void {}
}

export function setIcon(el: HTMLElement, name: string): void {
	el.dataset.icon = name;
}

export interface RequestUrlParam {
	url: string;
	method?: string;
}

/** Tests set `requestUrlHandler` to answer remote requests. */
export const network: {
	handler: ((request: RequestUrlParam) => Promise<{ text: string; status: number }>) | null;
} = {
	handler: null,
};

export function requestUrl(request: RequestUrlParam | string) {
	const param = typeof request === "string" ? { url: request } : request;
	if (!network.handler) {
		return Promise.reject(new Error(`No network in tests: ${param.url}`));
	}
	return network.handler(param);
}

// ---------------------------------------------------------------- events

export interface EventRef {
	readonly name: string;
	readonly callback: (...args: never[]) => unknown;
}

export class Events {
	readonly #handlers = new Map<string, Set<EventRef>>();

	on(name: string, callback: (...args: never[]) => unknown): EventRef {
		const ref = { name, callback };
		let set = this.#handlers.get(name);
		if (!set) {
			set = new Set();
			this.#handlers.set(name, set);
		}
		set.add(ref);
		return ref;
	}

	offref(ref: EventRef): void {
		this.#handlers.get(ref.name)?.delete(ref);
	}

	trigger(name: string, ...args: unknown[]): void {
		for (const ref of [...(this.#handlers.get(name) ?? [])]) {
			(ref.callback as (...values: unknown[]) => unknown)(...args);
		}
	}

	listenerCount(name: string): number {
		return this.#handlers.get(name)?.size ?? 0;
	}
}

// ---------------------------------------------------------------- files

export class TAbstractFile {
	path: string;
	name: string;
	parent: TFolder | null = null;

	constructor(path: string) {
		this.path = path;
		this.name = path.split("/").pop() ?? path;
	}
}

export class TFile extends TAbstractFile {
	stat = { ctime: Date.now(), mtime: Date.now(), size: 0 };

	get basename(): string {
		return this.name.replace(/\.[^.]+$/, "");
	}

	get extension(): string {
		const match = /\.([^.]+)$/.exec(this.name);
		return match?.[1] ?? "";
	}
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];

	isRoot(): boolean {
		return this.path === "/";
	}
}

function parentPath(path: string): string {
	const index = path.lastIndexOf("/");
	return index === -1 ? "/" : path.slice(0, index);
}

export class Vault extends Events {
	readonly #files = new Map<string, TAbstractFile>();
	readonly #contents = new Map<string, string>();
	readonly #root = new TFolder("/");
	/** Set by App so the metadata cache updates before "changed" fires. */
	afterWrite: (file: TFile) => void = () => {};

	constructor() {
		super();
		this.#files.set("/", this.#root);
	}

	getRoot(): TFolder {
		return this.#root;
	}

	getAbstractFileByPath(path: string): TAbstractFile | null {
		return this.#files.get(normalizePath(path) || "/") ?? null;
	}

	getFileByPath(path: string): TFile | null {
		const file = this.getAbstractFileByPath(path);
		return file instanceof TFile ? file : null;
	}

	getMarkdownFiles(): TFile[] {
		return [...this.#files.values()].filter(
			(file): file is TFile => file instanceof TFile && file.extension === "md",
		);
	}

	getFiles(): TFile[] {
		return [...this.#files.values()].filter((file): file is TFile => file instanceof TFile);
	}

	contentOf(path: string): string | undefined {
		return this.#contents.get(normalizePath(path));
	}

	async createFolder(path: string): Promise<TFolder> {
		const normalized = normalizePath(path);
		if (this.#files.has(normalized)) {
			throw new Error("Folder already exists.");
		}
		const parent = this.#folder(parentPath(normalized));
		const folder = new TFolder(normalized);
		folder.parent = parent;
		parent.children.push(folder);
		this.#files.set(normalized, folder);
		return Promise.resolve(folder);
	}

	async create(path: string, content: string): Promise<TFile> {
		const normalized = normalizePath(path);
		if (this.#files.has(normalized)) {
			throw new Error("File already exists.");
		}
		const parent = this.#folder(parentPath(normalized));
		const file = new TFile(normalized);
		file.parent = parent;
		file.stat.size = content.length;
		parent.children.push(file);
		this.#files.set(normalized, file);
		this.#contents.set(normalized, content);
		this.trigger("create", file);
		this.afterWrite(file);
		return Promise.resolve(file);
	}

	read(file: TFile): Promise<string> {
		const content = this.#contents.get(file.path);
		return content === undefined
			? Promise.reject(new Error(`ENOENT: ${file.path}`))
			: Promise.resolve(content);
	}

	cachedRead(file: TFile): Promise<string> {
		return this.read(file);
	}

	async modify(file: TFile, content: string): Promise<void> {
		if (!this.#contents.has(file.path)) {
			throw new Error(`ENOENT: ${file.path}`);
		}
		this.#contents.set(file.path, content);
		file.stat.mtime = Date.now();
		file.stat.size = content.length;
		this.trigger("modify", file);
		this.afterWrite(file);
		return Promise.resolve();
	}

	async process(file: TFile, fn: (data: string) => string): Promise<string> {
		const next = fn(await this.read(file));
		await this.modify(file, next);
		return next;
	}

	async delete(file: TAbstractFile): Promise<void> {
		this.#files.delete(file.path);
		this.#contents.delete(file.path);
		if (file.parent) {
			file.parent.children = file.parent.children.filter((child) => child !== file);
		}
		this.trigger("delete", file);
		return Promise.resolve();
	}

	async rename(file: TAbstractFile, newPath: string): Promise<void> {
		const oldPath = file.path;
		const normalized = normalizePath(newPath);
		const content = this.#contents.get(oldPath);
		this.#files.delete(oldPath);
		this.#contents.delete(oldPath);
		file.parent?.children.splice(file.parent.children.indexOf(file), 1);
		const parent = this.#folder(parentPath(normalized));
		file.path = normalized;
		file.name = normalized.split("/").pop() ?? normalized;
		file.parent = parent;
		parent.children.push(file);
		this.#files.set(normalized, file);
		if (content !== undefined) {
			this.#contents.set(normalized, content);
		}
		this.trigger("rename", file, oldPath);
		if (file instanceof TFile) {
			this.afterWrite(file);
		}
		return Promise.resolve();
	}

	#folder(path: string): TFolder {
		if (path === "/" || path === "") {
			return this.#root;
		}
		const existing = this.#files.get(path);
		if (existing instanceof TFolder) {
			return existing;
		}
		throw new Error(`Parent folder does not exist: ${path}`);
	}
}

export interface CachedMetadata {
	frontmatter?: Record<string, unknown>;
	links?: { link: string; original: string }[];
	tags?: { tag: string }[];
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export class MetadataCache extends Events {
	readonly #cache = new Map<string, CachedMetadata>();

	constructor(private readonly vault: Vault) {
		super();
	}

	/** Re-parses a file, like Obsidian's indexer, then fires "changed". */
	index(file: TFile): void {
		const content = this.vault.contentOf(file.path) ?? "";
		const metadata: CachedMetadata = {};
		const match = FRONTMATTER.exec(content);
		if (match) {
			try {
				const parsed = parseYaml(match[1] ?? "");
				if (parsed && typeof parsed === "object") {
					metadata.frontmatter = parsed as Record<string, unknown>;
				}
			} catch {
				// Invalid YAML: Obsidian leaves frontmatter undefined.
			}
		}
		metadata.links = [...content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map(
			(link) => ({ link: link[1] ?? "", original: link[0] }),
		);
		this.#cache.set(file.path, metadata);
		this.trigger("changed", file, content, metadata);
	}

	getFileCache(file: TFile): CachedMetadata | null {
		return this.#cache.get(file.path) ?? null;
	}

	getFirstLinkpathDest(linkpath: string, _sourcePath: string): TFile | null {
		const target = normalizePath(linkpath);
		const direct = this.vault.getFileByPath(target) ?? this.vault.getFileByPath(`${target}.md`);
		if (direct) {
			return direct;
		}
		const name = target.split("/").pop()?.toLowerCase();
		return (
			this.vault
				.getFiles()
				.find(
					(file) =>
						file.basename.toLowerCase() === name ||
						file.name.toLowerCase() === name ||
						file.path.toLowerCase().endsWith(`/${target.toLowerCase()}.md`),
				) ?? null
		);
	}
}

// ---------------------------------------------------------------- components and views

export class Component {
	readonly #cleanups: (() => void)[] = [];
	readonly #children: Component[] = [];
	loaded = false;

	load(): void {
		this.loaded = true;
		this.onload();
	}

	onload(): void {}

	onunload(): void {}

	register(cleanup: () => void): void {
		this.#cleanups.push(cleanup);
	}

	registerEvent(ref: EventRef & { owner?: Events }): void {
		this.register(() => ref.owner?.offref(ref));
	}

	registerInterval(id: number): number {
		this.register(() => window.clearInterval(id));
		return id;
	}

	registerDomEvent(el: EventTarget, type: string, callback: (event: Event) => unknown): void {
		el.addEventListener(type, callback);
		this.register(() => el.removeEventListener(type, callback));
	}

	addChild<T extends Component>(child: T): T {
		this.#children.push(child);
		child.load();
		return child;
	}

	unload(): void {
		for (const child of this.#children.splice(0)) {
			child.unload();
		}
		for (const cleanup of this.#cleanups.splice(0)) {
			cleanup();
		}
		this.onunload();
		this.loaded = false;
	}
}

export interface ViewState {
	type: string;
	active?: boolean;
	state?: Record<string, unknown>;
}

export class View extends Component {
	readonly containerEl = document.createElement("div");
	readonly contentEl = document.createElement("div");
	app: App;

	constructor(readonly leaf: WorkspaceLeaf) {
		super();
		this.app = leaf.app;
		this.containerEl.append(this.contentEl);
	}

	getViewType(): string {
		return "";
	}

	getDisplayText(): string {
		return "";
	}

	getIcon(): string {
		return "";
	}

	getState(): Record<string, unknown> {
		return {};
	}

	async setState(_state: unknown, _result: unknown): Promise<void> {}

	async onOpen(): Promise<void> {}

	async onClose(): Promise<void> {}
}

export class ItemView extends View {}

export class MarkdownView extends View {
	file: TFile | null = null;

	override getViewType(): string {
		return "markdown";
	}
}

export class WorkspaceLeaf {
	view: View | null = null;
	viewState: ViewState | null = null;
	file: TFile | null = null;
	openState: Record<string, unknown> | null = null;
	detached = false;

	constructor(
		readonly app: App = new App(),
		readonly kind: string = "main",
	) {}

	async openFile(file: TFile, state?: Record<string, unknown>): Promise<void> {
		this.file = file;
		this.openState = state ?? null;
		this.viewState = { type: "markdown" };
		this.app.workspace.setActiveFile(file);
		return Promise.resolve();
	}

	async setViewState(state: ViewState): Promise<void> {
		this.viewState = state;
		const factory = this.app.workspace.viewFactories.get(state.type);
		if (factory && this.view?.getViewType() !== state.type) {
			await this.view?.onClose();
			this.view = factory(this);
			await this.view.setState(state.state ?? {}, { history: false });
			await this.view.onOpen();
		} else if (this.view && state.state) {
			await this.view.setState(state.state, { history: false });
		}
		return Promise.resolve();
	}

	getViewState(): ViewState {
		return this.viewState ?? { type: "empty" };
	}

	detach(): void {
		this.detached = true;
		void this.view?.onClose();
		this.app.workspace.removeLeaf(this);
	}
}

export class Workspace extends Events {
	readonly leaves: WorkspaceLeaf[] = [];
	readonly revealed: WorkspaceLeaf[] = [];
	readonly viewFactories = new Map<string, (leaf: WorkspaceLeaf) => View>();
	layoutReady = false;
	#activeFile: TFile | null = null;
	readonly #pending: (() => void)[] = [];

	constructor(private readonly app: App) {
		super();
	}

	onLayoutReady(callback: () => void): void {
		if (this.layoutReady) {
			callback();
		} else {
			this.#pending.push(callback);
		}
	}

	finishLayout(): void {
		this.layoutReady = true;
		for (const callback of this.#pending.splice(0)) {
			callback();
		}
	}

	getLeaf(mode?: boolean | "tab" | "split" | "window"): WorkspaceLeaf {
		const leaf = new WorkspaceLeaf(this.app, mode ? String(mode) : "main");
		this.leaves.push(leaf);
		return leaf;
	}

	getRightLeaf(_split: boolean): WorkspaceLeaf {
		const leaf = new WorkspaceLeaf(this.app, "right");
		this.leaves.push(leaf);
		return leaf;
	}

	getLeavesOfType(type: string): WorkspaceLeaf[] {
		return this.leaves.filter((leaf) => leaf.viewState?.type === type);
	}

	removeLeaf(leaf: WorkspaceLeaf): void {
		this.leaves.splice(this.leaves.indexOf(leaf), 1);
	}

	detachLeavesOfType(type: string): void {
		for (const leaf of this.getLeavesOfType(type)) {
			leaf.detach();
		}
	}

	async revealLeaf(leaf: WorkspaceLeaf): Promise<void> {
		this.revealed.push(leaf);
		return Promise.resolve();
	}

	getActiveFile(): TFile | null {
		return this.#activeFile;
	}

	setActiveFile(file: TFile | null): void {
		this.#activeFile = file;
		this.trigger("file-open", file);
	}

	getActiveViewOfType<T>(_type: unknown): T | null {
		return null;
	}
}

export class FileManager {
	constructor(private readonly app: App) {}

	async processFrontMatter(
		file: TFile,
		fn: (frontmatter: Record<string, unknown>) => void,
	): Promise<void> {
		await this.app.vault.process(file, (content) => {
			const match = FRONTMATTER.exec(content);
			const data = (match ? parseYaml(match[1] ?? "") : {}) as Record<string, unknown> | null;
			const frontmatter = data ?? {};
			fn(frontmatter);
			const body = match ? content.slice(match[0].length) : content;
			return `---\n${stringifyYaml(frontmatter)}---\n${body}`;
		});
	}
}

export interface PluginManagerState {
	manifests: Record<string, { version?: string }>;
	enabledPlugins: Set<string>;
	plugins: Record<string, unknown>;
}

export class App {
	readonly vault = new Vault();
	readonly metadataCache = new MetadataCache(this.vault);
	readonly workspace: Workspace = new Workspace(this);
	readonly fileManager = new FileManager(this);
	plugins: PluginManagerState = { manifests: {}, enabledPlugins: new Set(), plugins: {} };

	constructor() {
		this.vault.afterWrite = (file) => this.metadataCache.index(file);
		// Event refs remember their owner so Component.registerEvent can detach them.
		for (const owner of [this.vault, this.metadataCache, this.workspace] as Events[]) {
			const on = owner.on.bind(owner);
			owner.on = (name, callback) => Object.assign(on(name, callback), { owner });
		}
	}
}

// ---------------------------------------------------------------- plugin API

export interface Command {
	id: string;
	name: string;
	icon?: string;
	callback?: () => unknown;
	checkCallback?: (checking: boolean) => boolean | void;
	editorCallback?: (...args: never[]) => unknown;
	editorCheckCallback?: (checking: boolean, editor: unknown, context: unknown) => boolean | void;
}

export interface PluginManifest {
	id: string;
	name: string;
	version: string;
}

export class Plugin extends Component {
	readonly commands: Command[] = [];
	readonly settingTabs: PluginSettingTab[] = [];
	readonly ribbonIcons: {
		icon: string;
		title: string;
		callback: (event: MouseEvent) => unknown;
	}[] = [];
	readonly statusBarItems: HTMLElement[] = [];
	readonly codeBlockProcessors = new Map<
		string,
		(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => unknown
	>();
	data: unknown = null;

	constructor(
		readonly app: App = new App(),
		readonly manifest: PluginManifest = {
			id: "second-brain-os",
			name: "Second Brain OS",
			version: "0.0.0",
		},
	) {
		super();
	}

	addCommand(command: Command): Command {
		this.commands.push({ ...command, id: `${this.manifest.id}:${command.id}` });
		return command;
	}

	/** Test helper: runs a command the way the palette does. Returns false when unavailable. */
	runCommand(id: string): boolean {
		const command = this.commands.find(
			(candidate) => candidate.id === `${this.manifest.id}:${id}`,
		);
		if (!command) {
			throw new Error(`No command ${id}. Have: ${this.commands.map((c) => c.id).join(", ")}`);
		}
		if (command.checkCallback) {
			if (command.checkCallback(true) === false) {
				return false;
			}
			command.checkCallback(false);
			return true;
		}
		void command.callback?.();
		return true;
	}

	/** Test helper: runs an editor command with a cursor on `line` in `path`. */
	runEditorCommand(id: string, path: string, line: number): boolean {
		const command = this.commands.find(
			(candidate) => candidate.id === `${this.manifest.id}:${id}`,
		);
		if (!command?.editorCheckCallback) {
			throw new Error(`No editor command ${id}`);
		}
		const editor = { getCursor: () => ({ line, ch: 0 }) };
		const context = { file: this.app.vault.getFileByPath(path) };
		if (command.editorCheckCallback(true, editor, context) === false) {
			return false;
		}
		command.editorCheckCallback(false, editor, context);
		return true;
	}

	registerView(type: string, factory: (leaf: WorkspaceLeaf) => View): void {
		this.app.workspace.viewFactories.set(type, factory);
		this.register(() => this.app.workspace.viewFactories.delete(type));
	}

	addSettingTab(tab: PluginSettingTab): void {
		this.settingTabs.push(tab);
	}

	addRibbonIcon(
		icon: string,
		title: string,
		callback: (event: MouseEvent) => unknown,
	): HTMLElement {
		this.ribbonIcons.push({ icon, title, callback });
		return document.createElement("div");
	}

	addStatusBarItem(): HTMLElement {
		const el = document.createElement("div");
		this.statusBarItems.push(el);
		return el;
	}

	registerMarkdownCodeBlockProcessor(
		language: string,
		handler: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => unknown,
	): void {
		this.codeBlockProcessors.set(language, handler);
	}

	async loadData(): Promise<unknown> {
		return Promise.resolve(this.data);
	}

	async saveData(data: unknown): Promise<void> {
		this.data = structuredClone(data);
		return Promise.resolve();
	}
}

export interface MarkdownPostProcessorContext {
	sourcePath: string;
	addChild(child: MarkdownRenderChild): void;
}

export class MarkdownRenderChild extends Component {
	constructor(readonly containerEl: HTMLElement) {
		super();
	}
}

export class Modal {
	readonly modalEl = document.createElement("div");
	readonly titleEl = document.createElement("div");
	readonly contentEl = document.createElement("div");
	static readonly open: Modal[] = [];

	constructor(readonly app: App) {
		this.modalEl.className = "modal";
		this.modalEl.append(this.titleEl, this.contentEl);
	}

	setTitle(title: string): this {
		this.titleEl.textContent = title;
		return this;
	}

	open(): void {
		document.body.append(this.modalEl);
		Modal.open.push(this);
		this.onOpen();
	}

	close(): void {
		this.onClose();
		this.modalEl.remove();
		Modal.open.splice(Modal.open.indexOf(this), 1);
	}

	onOpen(): void {}

	onClose(): void {}
}

export class PluginSettingTab {
	readonly containerEl = document.createElement("div");

	constructor(
		readonly app: App,
		readonly plugin: Plugin,
	) {}

	display(): void {}

	hide(): void {}
}

abstract class ValueComponent<T> {
	protected handler: ((value: T) => unknown) | null = null;

	onChange(handler: (value: T) => unknown): this {
		this.handler = handler;
		return this;
	}
}

export class ToggleComponent extends ValueComponent<boolean> {
	readonly toggleEl: HTMLInputElement = document.createElement("input");

	constructor(parent: HTMLElement) {
		super();
		this.toggleEl.type = "checkbox";
		// Obsidian toggles react to clicks; a click on a checkbox has already flipped `checked`.
		this.toggleEl.addEventListener("click", () => void this.handler?.(this.toggleEl.checked));
		parent.append(this.toggleEl);
	}

	setValue(value: boolean): this {
		this.toggleEl.checked = value;
		return this;
	}

	getValue(): boolean {
		return this.toggleEl.checked;
	}

	setTooltip(_tooltip: string): this {
		return this;
	}
}

export class TextComponent extends ValueComponent<string> {
	readonly inputEl: HTMLInputElement = document.createElement("input");

	constructor(parent: HTMLElement) {
		super();
		this.inputEl.type = "text";
		this.inputEl.addEventListener("input", () => void this.handler?.(this.inputEl.value));
		parent.append(this.inputEl);
	}

	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}

	getValue(): string {
		return this.inputEl.value;
	}

	setPlaceholder(placeholder: string): this {
		this.inputEl.placeholder = placeholder;
		return this;
	}
}

export class TextAreaComponent extends ValueComponent<string> {
	readonly inputEl: HTMLTextAreaElement = document.createElement("textarea");

	constructor(parent: HTMLElement) {
		super();
		this.inputEl.addEventListener("input", () => void this.handler?.(this.inputEl.value));
		parent.append(this.inputEl);
	}

	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}

	setPlaceholder(placeholder: string): this {
		this.inputEl.placeholder = placeholder;
		return this;
	}
}

export class DropdownComponent extends ValueComponent<string> {
	readonly selectEl: HTMLSelectElement = document.createElement("select");

	constructor(parent: HTMLElement) {
		super();
		this.selectEl.addEventListener("change", () => void this.handler?.(this.selectEl.value));
		parent.append(this.selectEl);
	}

	addOption(value: string, display: string): this {
		const option = document.createElement("option");
		option.value = value;
		option.textContent = display;
		this.selectEl.append(option);
		return this;
	}

	addOptions(options: Record<string, string>): this {
		for (const [value, display] of Object.entries(options)) {
			this.addOption(value, display);
		}
		return this;
	}

	setValue(value: string): this {
		this.selectEl.value = value;
		return this;
	}

	getValue(): string {
		return this.selectEl.value;
	}
}

export class ButtonComponent {
	readonly buttonEl: HTMLButtonElement = document.createElement("button");

	constructor(parent: HTMLElement) {
		this.buttonEl.type = "button";
		parent.append(this.buttonEl);
	}

	setButtonText(text: string): this {
		this.buttonEl.textContent = text;
		return this;
	}

	setCta(): this {
		return this;
	}

	setWarning(): this {
		return this;
	}

	onClick(handler: (event: MouseEvent) => unknown): this {
		this.buttonEl.addEventListener("click", (event) => void handler(event));
		return this;
	}
}

export class Setting {
	readonly settingEl = document.createElement("div");
	readonly nameEl = document.createElement("div");
	readonly descEl = document.createElement("div");
	readonly controlEl = document.createElement("div");

	constructor(containerEl: HTMLElement) {
		this.settingEl.className = "setting-item";
		this.settingEl.append(this.nameEl, this.descEl, this.controlEl);
		containerEl.append(this.settingEl);
	}

	setName(name: string): this {
		this.nameEl.textContent = name;
		return this;
	}

	setDesc(desc: string | DocumentFragment): this {
		this.descEl.replaceChildren(desc);
		return this;
	}

	setHeading(): this {
		this.settingEl.classList.add("setting-item-heading");
		return this;
	}

	setClass(cls: string): this {
		this.settingEl.classList.add(cls);
		return this;
	}

	setDisabled(disabled: boolean): this {
		this.settingEl.toggleAttribute("data-disabled", disabled);
		return this;
	}

	#labelled<T extends { toggleEl?: HTMLElement; inputEl?: HTMLElement; selectEl?: HTMLElement }>(
		component: T,
	): T {
		const el = component.toggleEl ?? component.inputEl ?? component.selectEl;
		el?.setAttribute("aria-label", this.nameEl.textContent ?? "");
		return component;
	}

	addToggle(build: (toggle: ToggleComponent) => unknown): this {
		build(this.#labelled(new ToggleComponent(this.controlEl)));
		return this;
	}

	addText(build: (text: TextComponent) => unknown): this {
		build(this.#labelled(new TextComponent(this.controlEl)));
		return this;
	}

	addTextArea(build: (text: TextAreaComponent) => unknown): this {
		build(this.#labelled(new TextAreaComponent(this.controlEl)));
		return this;
	}

	addDropdown(build: (dropdown: DropdownComponent) => unknown): this {
		build(this.#labelled(new DropdownComponent(this.controlEl)));
		return this;
	}

	addButton(build: (button: ButtonComponent) => unknown): this {
		build(new ButtonComponent(this.controlEl));
		return this;
	}
}

export class Menu {
	static last: Menu | null = null;
	readonly items: { title: string; icon?: string; onClick?: () => unknown }[] = [];

	addItem(build: (item: MenuItem) => unknown): this {
		const item = new MenuItem();
		build(item);
		this.items.push(item.toJSON());
		return this;
	}

	addSeparator(): this {
		return this;
	}

	showAtMouseEvent(_event: MouseEvent): this {
		Menu.last = this;
		return this;
	}

	showAtPosition(_position: { x: number; y: number }): this {
		Menu.last = this;
		return this;
	}
}

export class MenuItem {
	#title = "";
	#icon: string | undefined;
	#onClick: (() => unknown) | undefined;

	setTitle(title: string): this {
		this.#title = title;
		return this;
	}

	setIcon(icon: string): this {
		this.#icon = icon;
		return this;
	}

	onClick(callback: () => unknown): this {
		this.#onClick = callback;
		return this;
	}

	toJSON(): { title: string; icon?: string; onClick?: () => unknown } {
		return {
			title: this.#title,
			...(this.#icon === undefined ? {} : { icon: this.#icon }),
			...(this.#onClick === undefined ? {} : { onClick: this.#onClick }),
		};
	}
}

export type PaneType = "tab" | "split" | "window";
