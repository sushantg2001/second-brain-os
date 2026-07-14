import momentImpl from "moment";

export const moment = momentImpl;

type ElementInfo =
	| string
	| {
			cls?: string | string[];
			text?: string;
			type?: string;
			value?: string;
			placeholder?: string;
			attr?: Record<string, string | number | boolean | null>;
	  };

function applyInfo(el: HTMLElement, info?: ElementInfo): void {
	if (typeof info === "string") {
		el.className = info;
		return;
	}
	if (!info) {
		return;
	}
	if (info.cls) {
		el.className = Array.isArray(info.cls) ? info.cls.join(" ") : info.cls;
	}
	if (info.text) {
		el.textContent = info.text;
	}
	if (info.type && el instanceof HTMLInputElement) {
		el.type = info.type;
	}
	if (info.value && el instanceof HTMLInputElement) {
		el.value = info.value;
	}
	if (info.placeholder && el instanceof HTMLInputElement) {
		el.placeholder = info.placeholder;
	}
	if (info.attr) {
		for (const [key, value] of Object.entries(info.attr)) {
			if (value !== null) {
				el.setAttribute(key, String(value));
			}
		}
	}
}

const proto = HTMLElement.prototype as unknown as Record<string, unknown>;

proto.createEl = function (
	this: HTMLElement,
	tag: string,
	info?: ElementInfo,
	callback?: (el: HTMLElement) => void,
) {
	const el = document.createElement(tag);
	applyInfo(el, info);
	this.appendChild(el);
	callback?.(el);
	return el;
};

proto.createDiv = function (
	this: HTMLElement,
	info?: ElementInfo,
	callback?: (el: HTMLElement) => void,
) {
	return (this as HTMLElement & { createEl: CallableFunction }).createEl(
		"div",
		info,
		callback,
	);
};

proto.createSpan = function (
	this: HTMLElement,
	info?: ElementInfo,
	callback?: (el: HTMLElement) => void,
) {
	return (this as HTMLElement & { createEl: CallableFunction }).createEl(
		"span",
		info,
		callback,
	);
};

proto.empty = function (this: HTMLElement) {
	while (this.firstChild) {
		this.removeChild(this.firstChild);
	}
};

proto.setText = function (this: HTMLElement, text: string) {
	this.textContent = text;
};

proto.addClass = function (this: HTMLElement, ...classes: string[]) {
	this.classList.add(...classes);
};

proto.removeClass = function (this: HTMLElement, ...classes: string[]) {
	this.classList.remove(...classes);
};

proto.toggleClass = function (this: HTMLElement, cls: string, value: boolean) {
	this.classList.toggle(cls, value);
};

proto.detach = function (this: HTMLElement) {
	this.remove();
};

export function normalizePath(path: string): string {
	const normalized = path
		.replace(/\\/g, "/")
		.replace(/\/+/g, "/")
		.replace(/^\/+|\/+$/g, "");
	return normalized === "" ? "/" : normalized;
}

export type EventRef = { name: string; callback: CallableFunction };

class Events {
	private handlers: EventRef[] = [];

	on(name: string, callback: CallableFunction): EventRef {
		const ref = { name, callback };
		this.handlers.push(ref);
		return ref;
	}

	off(ref: EventRef): void {
		this.handlers = this.handlers.filter((h) => h !== ref);
	}

	trigger(name: string, ...args: unknown[]): void {
		for (const handler of this.handlers) {
			if (handler.name === name) {
				(handler.callback as (...callbackArgs: unknown[]) => void)(...args);
			}
		}
	}
}

export class TAbstractFile {
	path = "";
	name = "";
	parent: TFolder | null = null;
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
}

export class TFile extends TAbstractFile {
	basename = "";
	extension = "";
}

function makeFile(path: string, root: Map<string, TAbstractFile>): TFile {
	const file = new TFile();
	file.path = path;
	const parts = path.split("/");
	file.name = parts[parts.length - 1] ?? path;
	const dotIndex = file.name.lastIndexOf(".");
	file.basename = dotIndex === -1 ? file.name : file.name.slice(0, dotIndex);
	file.extension = dotIndex === -1 ? "" : file.name.slice(dotIndex + 1);
	const parentPath = normalizePath(parts.slice(0, -1).join("/"));
	const parent = root.get(parentPath);
	file.parent = parent instanceof TFolder ? parent : null;
	return file;
}

export class Vault extends Events {
	private entries = new Map<string, TAbstractFile>();
	private contents = new Map<string, string>();

	constructor() {
		super();
		const rootFolder = new TFolder();
		rootFolder.path = "/";
		this.entries.set("/", rootFolder);
	}

	getAbstractFileByPath(path: string): TAbstractFile | null {
		return this.entries.get(normalizePath(path)) ?? null;
	}

	getMarkdownFiles(): TFile[] {
		return [...this.entries.values()].filter(
			(entry): entry is TFile =>
				entry instanceof TFile && entry.extension === "md",
		);
	}

	async create(path: string, contents: string): Promise<TFile> {
		const normalized = normalizePath(path);
		if (this.entries.has(normalized)) {
			throw new Error(`File already exists: ${normalized}`);
		}
		const file = makeFile(normalized, this.entries);
		this.entries.set(normalized, file);
		this.contents.set(normalized, contents);
		this.trigger("create", file);
		return file;
	}

	async createFolder(path: string): Promise<TFolder> {
		const normalized = normalizePath(path);
		const parts = normalized.split("/");
		let current = "";
		let folder = this.entries.get("/") as TFolder;
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			const existing = this.entries.get(current);
			if (existing instanceof TFolder) {
				folder = existing;
				continue;
			}
			const created = new TFolder();
			created.path = current;
			created.name = part;
			this.entries.set(current, created);
			folder = created;
		}
		return folder;
	}

	async cachedRead(file: TFile): Promise<string> {
		return this.contents.get(file.path) ?? "";
	}

	async read(file: TFile): Promise<string> {
		return this.cachedRead(file);
	}

	async delete(file: TAbstractFile): Promise<void> {
		this.entries.delete(file.path);
		this.contents.delete(file.path);
		this.trigger("delete", file);
	}
}

export class WorkspaceLeaf {
	view: unknown = null;
	openedFiles: TFile[] = [];

	async openFile(file: TFile): Promise<void> {
		this.openedFiles.push(file);
	}

	async setViewState(): Promise<void> {}
}

export class Workspace extends Events {
	activeFile: TFile | null = null;
	lastLeaf = new WorkspaceLeaf();
	leavesByType = new Map<string, WorkspaceLeaf[]>();

	getActiveFile(): TFile | null {
		return this.activeFile;
	}

	getLeaf(): WorkspaceLeaf {
		return this.lastLeaf;
	}

	getRightLeaf(): WorkspaceLeaf {
		return this.lastLeaf;
	}

	getLeavesOfType(type: string): WorkspaceLeaf[] {
		return this.leavesByType.get(type) ?? [];
	}

	async revealLeaf(): Promise<void> {}
}

export class App {
	vault = new Vault();
	workspace = new Workspace();
}

export class Component {
	registerEvent(): void {}
	registerInterval(id: number): number {
		return id;
	}
	registerDomEvent(): void {}
}

export class Plugin extends Component {
	app: App;
	settingsData: unknown = null;
	commands: unknown[] = [];

	constructor(app: App = new App()) {
		super();
		this.app = app;
	}

	addCommand(command: unknown): unknown {
		this.commands.push(command);
		return command;
	}

	addRibbonIcon(): HTMLElement {
		return document.createElement("div");
	}

	addSettingTab(): void {}

	registerView(): void {}

	async loadData(): Promise<unknown> {
		return this.settingsData;
	}

	async saveData(data: unknown): Promise<void> {
		this.settingsData = data;
	}
}

export class ItemView extends Component {
	app: App;
	leaf: WorkspaceLeaf;
	containerEl: HTMLElement;
	contentEl: HTMLElement;

	constructor(leaf: WorkspaceLeaf, app: App = new App()) {
		super();
		this.leaf = leaf;
		this.app = app;
		this.containerEl = document.createElement("div");
		this.contentEl = document.createElement("div");
		this.containerEl.appendChild(this.contentEl);
	}
}

export class Modal {
	app: App;
	modalEl: HTMLElement;
	titleEl: HTMLElement;
	contentEl: HTMLElement;
	isOpen = false;

	constructor(app: App) {
		this.app = app;
		this.modalEl = document.createElement("div");
		this.modalEl.className = "modal";
		this.titleEl = document.createElement("div");
		this.titleEl.className = "modal-title";
		this.contentEl = document.createElement("div");
		this.contentEl.className = "modal-content";
		this.modalEl.appendChild(this.titleEl);
		this.modalEl.appendChild(this.contentEl);
	}

	open(): void {
		this.isOpen = true;
		document.body.appendChild(this.modalEl);
		(this as unknown as { onOpen?: () => void }).onOpen?.();
	}

	close(): void {
		this.isOpen = false;
		(this as unknown as { onClose?: () => void }).onClose?.();
		this.modalEl.remove();
	}
}

export class Notice {
	static messages: string[] = [];

	constructor(message: string) {
		Notice.messages.push(message);
	}
}

export class PluginSettingTab {
	app: App;
	containerEl: HTMLElement;

	constructor(app: App) {
		this.app = app;
		this.containerEl = document.createElement("div");
	}
}

class BaseComponent {
	changeHandler: ((value: unknown) => void) | null = null;

	onChange(handler: (value: unknown) => void): this {
		this.changeHandler = handler;
		return this;
	}

	setValue(): this {
		return this;
	}

	setPlaceholder(): this {
		return this;
	}

	addOption(): this {
		return this;
	}
}

export class Setting {
	settingEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		this.settingEl = document.createElement("div");
		containerEl.appendChild(this.settingEl);
	}

	setName(): this {
		return this;
	}

	setDesc(): this {
		return this;
	}

	setHeading(): this {
		return this;
	}

	addToggle(callback: (component: BaseComponent) => void): this {
		callback(new BaseComponent());
		return this;
	}

	addText(callback: (component: BaseComponent) => void): this {
		callback(new BaseComponent());
		return this;
	}

	addDropdown(callback: (component: BaseComponent) => void): this {
		callback(new BaseComponent());
		return this;
	}
}
