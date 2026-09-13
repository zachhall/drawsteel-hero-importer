import { Notice, Platform, Plugin, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import { ConfirmModal } from "./src/confirm-modal";
import { parseCounterRow } from "./src/counter-row-block";
import { CounterRowView } from "./src/counter-row-view";
import { DsHero } from "./src/ds-hero-types";
import { extractDsCounterValues, FRONTMATTER_SYNCED_COUNTERS } from "./src/frontmatter-sync";
import { flattenHeroFeatures } from "./src/feature-flatten";
import { computeHeroStats } from "./src/hero-stats";
import { buildHeroNote } from "./src/markdown-builder";
import { debugDumpRawFields, extractPdfFields } from "./src/pdf-field-extractor";
import { DSHI_PDF_DEBUG } from "./src/pdf-field-map";
import { parsePdfHeroData } from "./src/pdf-hero-parser";
import { resolvePdfCompendiumLinks } from "./src/pdf-compendium-resolver";
import { buildPdfHeroNote } from "./src/pdf-note-builder";
import { DEFAULT_SETTINGS, HeroImporterSettings, HeroImporterSettingTab } from "./src/settings";

/** What pickHeroFile() actually returns: a ready-to-render ForgeSteel hero, or the raw bytes of a picked PDF (parsed later, once computeNotePath needs to exist first for compendium link generation). */
type PickedHero = { kind: "ds-hero"; hero: DsHero } | { kind: "pdf"; data: ArrayBuffer };

function sanitizeFilename(name: string): string {
	return name.replace(/[\\/:*?"<>|]/g, "").trim() || "Unnamed Hero";
}

/** e.g. "2026-09-09 14-23-05-123" — colons swapped for dashes since ":" isn't valid in a Windows filename. */
function formatTimestampForFilename(date: Date): string {
	const pad = (n: number, width = 2) => String(n).padStart(width, "0");
	const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	const timePart = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
	return `${datePart} ${timePart}`;
}

/** Matches exactly the "<baseName> - <timestamp>[ (n)].md" shape archiveFileContent produces. */
const ARCHIVED_NOTE_NAME = /^(.*) - \d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}-\d{3}(?: \(\d+\))?$/;

/** The hero name encoded in an archived Note's basename, or undefined for a file this plugin didn't create (left alone by cleanup). */
function parseArchivedHeroName(basename: string): string | undefined {
	return ARCHIVED_NOTE_NAME.exec(basename)?.[1];
}

/** The tiny slice of Electron's renderer API this plugin actually calls. */
interface ElectronDialog {
	showOpenDialog(options: {
		title?: string;
		properties?: string[];
		filters?: { name: string; extensions: string[] }[];
	}): Promise<{ canceled: boolean; filePaths: string[] }>;
}
interface ElectronLike {
	remote?: { dialog?: ElectronDialog };
}

/**
 * The tiny slice of Node's `fs/promises` this plugin actually calls, named
 * explicitly rather than cast via `typeof import("fs/promises")` — that cast
 * only type-checks safely when the type-checker can fully resolve
 * `@types/node`'s real module types, which isn't guaranteed in every
 * environment this gets linted in. Reading the result as `Uint8Array` (not
 * `Buffer`) means this has no dependency on `@types/node`'s global `Buffer`
 * type either — only `.buffer`/`.byteOffset`/`.byteLength` are read below,
 * all valid on a plain `Uint8Array`.
 */
interface FsPromisesReadFile {
	// A property-typed overload set, not method shorthand -- method shorthand
	// here trips @typescript-eslint/unbound-method once `readFile` is
	// destructured off the object below, since a method signature implies its
	// `this` binding could matter even though this one never uses `this`.
	readFile: {
		(path: string): Promise<Uint8Array>;
		(path: string, encoding: "utf-8"): Promise<string>;
	};
}

export default class DrawSteelHeroImporterPlugin extends Plugin {
	settings!: HeroImporterSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("user-plus", "Import Draw Steel Hero", () => this.importAsNote());

		this.addCommand({
			id: "import-ds-hero",
			name: "Import Draw Steel Hero (.ds-hero or PDF)",
			callback: () => this.importAsNote(),
		});

		this.addSettingTab(new HeroImporterSettingTab(this.app, this));

		// Renders 2-3 counters as one real row (see src/counter-row-view.ts for
		// why this is a genuine codeblock this plugin owns end-to-end, not a
		// post-render DOM patch). Explicit negative sortOrder: other plugins
		// that scan rendered text (e.g. drawsteel-rule-term-linker) register a
		// plain registerMarkdownPostProcessor at the default sortOrder (0) —
		// without running before that, this handler's own DOM-population would
		// lose the race whenever this plugin happens to load after theirs
		// (Obsidian breaks sortOrder ties by registration/plugin-load order),
		// leaving the row's counter names still empty when the other
		// plugin's scan runs, silently breaking whatever depends on that text
		// already being there. A standalone ds-counter block never had this
		// problem since draw-steel-elements (which renders it) has always
		// loaded before any plugin that only post-processes.
		this.registerMarkdownCodeBlockProcessor(
			"dshi-counter-row",
			(source, el, ctx) => {
				try {
					const view = new CounterRowView(this.app, parseCounterRow(source), ctx, el);
					ctx.addChild(view);
					view.render();
				} catch (err) {
					el.createDiv({
						cls: "error-message",
						text: `Draw Steel Hero Importer: failed to render dshi-counter-row — ${err instanceof Error ? err.message : String(err)}`,
					});
				}
			},
			-100
		);

		// Clicking a ds-counter's +/- rewrites that codeblock's own YAML, not the
		// Note's frontmatter — this is what keeps a synced property (see
		// FRONTMATTER_SYNCED_COUNTERS) following it instead.
		this.registerEvent(this.app.vault.on("modify", (file) => this.syncCounterPropertiesToFrontmatter(file)));
	}

	private async syncCounterPropertiesToFrontmatter(file: TAbstractFile) {
		if (!(file instanceof TFile) || file.extension !== "md") return;

		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter?.ds_hero) return;

		const content = await this.app.vault.read(file);
		const counterValues = extractDsCounterValues(content);

		const updates: Record<string, number> = {};
		for (const [counterName, propertyName] of Object.entries(FRONTMATTER_SYNCED_COUNTERS)) {
			const value = counterValues.get(counterName);
			if (value !== undefined && cache.frontmatter?.[propertyName] !== value) {
				updates[propertyName] = value;
			}
		}
		if (!Object.keys(updates).length) return;

		await this.app.fileManager.processFrontMatter(file, (fm) => {
			Object.assign(fm, updates);
		});
	}

	async importAsNote() {
		const picked = await this.pickHeroFile();
		if (!picked) return;

		if (picked.kind === "ds-hero") {
			await this.importDsHero(picked.hero);
		} else {
			await this.importPdfHero(picked.data);
		}
	}

	private async importDsHero(hero: DsHero) {
		const heroLevel = hero.class?.level ?? 1;
		const flat = flattenHeroFeatures(hero, heroLevel);
		const stats = computeHeroStats(hero, flat.bonuses, flat.kits, flat.characteristicBonuses);
		const content = buildHeroNote(hero, stats, flat);

		const target = await this.writeHeroFile(hero.name, content);

		new Notice(`Imported ${hero.name} to ${target.path}`);
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.openFile(target);
	}

	private async importPdfHero(data: ArrayBuffer) {
		try {
			const rawFields = await extractPdfFields(data);
			if (DSHI_PDF_DEBUG) debugDumpRawFields(rawFields);

			const pdfHero = parsePdfHeroData(rawFields);
			const compendium = await resolvePdfCompendiumLinks(this.app, pdfHero, this.settings.compendiumFolder);
			if (!compendium) return; // user cancelled from a match-resolution prompt

			const content = buildPdfHeroNote(pdfHero, compendium);
			const target = await this.writeHeroFile(pdfHero.name, content);

			new Notice(`Imported ${pdfHero.name} to ${target.path}`);
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.openFile(target);
		} catch (err) {
			this.reportImportError(err);
		}
	}

	private async pickHeroFile(): Promise<PickedHero | undefined> {
		// Chromium refuses to show an <input type="file"> dialog unless click()
		// happens inside genuine, still-live user-activation — which Obsidian's
		// Setting button (and command palette) click handling doesn't reliably
		// preserve by the time our code runs. Electron's native dialog has no
		// such restriction, so prefer it whenever we're actually on desktop.
		const electron = this.getElectron();
		if (electron?.remote?.dialog) {
			return this.pickHeroFileViaElectron(electron.remote.dialog);
		}
		return this.pickHeroFileViaHtmlInput();
	}

	/** Obsidian's desktop sandbox exposes a real Node `require` off `window`, not as a bare global. */
	private getNodeRequire(): ((id: string) => unknown) | undefined {
		try {
			return (window as unknown as { require?: (id: string) => unknown }).require;
		} catch {
			return undefined;
		}
	}

	private getElectron(): ElectronLike | undefined {
		return this.getNodeRequire()?.("electron") as ElectronLike | undefined;
	}

	private async pickHeroFileViaElectron(dialog: ElectronDialog): Promise<PickedHero | undefined> {
		if (!Platform.isDesktop) return undefined;

		const result = await dialog.showOpenDialog({
			title: "Select a .ds-hero or PDF file",
			properties: ["openFile"],
			filters: [{ name: "Draw Steel Hero", extensions: ["ds-hero", "pdf"] }],
		});
		if (result.canceled || !result.filePaths.length) return undefined;

		const path = result.filePaths[0];
		try {
			// "fs/promises" doesn't exist on mobile, so this goes through the
			// same window.require Node escape hatch as getElectron() above,
			// gated by the Platform.isDesktop check at the top of this method.
			// A bare `require("fs/promises")` and a dynamic `import("fs/promises")`
			// both fail at runtime here: Obsidian's desktop plugin sandbox has no
			// global `require`, and resolves import() specifiers as ES modules,
			// which "fs/promises" isn't from its perspective.
			const nodeRequire = this.getNodeRequire();
			if (!nodeRequire) throw new Error("Node require() is unavailable");
			const { readFile } = nodeRequire("fs/promises") as FsPromisesReadFile;

			if (path.toLowerCase().endsWith(".pdf")) {
				const buffer = await readFile(path);
				// Node's fs.readFile always backs its result with a real ArrayBuffer,
				// never a SharedArrayBuffer -- Uint8Array.buffer's type is the more
				// general ArrayBufferLike only because the DOM lib's typing has to
				// account for typed arrays backed by either.
				const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
				return { kind: "pdf", data };
			}

			const text = await readFile(path, "utf-8");
			const hero = this.parseHero(text);
			return hero ? { kind: "ds-hero", hero } : undefined;
		} catch (err) {
			this.reportImportError(err);
			return undefined;
		}
	}

	private pickHeroFileViaHtmlInput(): Promise<PickedHero | undefined> {
		return new Promise((resolve) => {
			const input = document.body.createEl("input", {
				type: "file",
				cls: "dshi-hidden-file-input",
				attr: { accept: ".ds-hero,.pdf" },
			});
			// "change" never fires on cancel, so without this the input is left
			// behind in the DOM (invisible but real), and the returned promise
			// never resolves, every time the user backs out of the picker.
			input.addEventListener("cancel", () => {
				input.remove();
				resolve(undefined);
			});
			input.addEventListener("change", () => {
				const file = input.files?.[0];
				input.remove();
				if (!file) {
					resolve(undefined);
					return;
				}

				if (file.name.toLowerCase().endsWith(".pdf")) {
					file
						.arrayBuffer()
						.then((data) => resolve({ kind: "pdf", data }))
						.catch((err) => {
							this.reportImportError(err);
							resolve(undefined);
						});
					return;
				}

				file
					.text()
					.then((text) => {
						const hero = this.parseHero(text);
						resolve(hero ? { kind: "ds-hero", hero } : undefined);
					})
					.catch((err) => {
						this.reportImportError(err);
						resolve(undefined);
					});
			});
			input.click();
		});
	}

	private parseHero(text: string): DsHero | undefined {
		try {
			const hero = JSON.parse(text) as DsHero;
			if (!hero || typeof hero !== "object" || !hero.name) {
				new Notice("That doesn't look like a valid .ds-hero file.");
				return undefined;
			}
			return hero;
		} catch (err) {
			this.reportImportError(err);
			return undefined;
		}
	}

	private reportImportError(err: unknown) {
		console.error("Draw Steel Hero Importer: failed to import hero", err);
		new Notice(`Failed to import hero: ${err instanceof Error ? err.message : String(err)}`);
	}

	/** Where "Name.md" for this hero lands, given the current destination folder setting. */
	private computeNotePath(heroName: string): string {
		const folder = this.settings.destinationFolder ? normalizePath(this.settings.destinationFolder) : "";
		const baseName = sanitizeFilename(heroName);
		return normalizePath(folder ? `${folder}/${baseName}.md` : `${baseName}.md`);
	}

	/**
	 * Writes a hero to "Name.md" in the destination folder, always the
	 * current import. If a file is already there, its *old* content is
	 * copied into the archive folder as a new file, and the existing file is
	 * then updated in place with the new content — rather than overwritten
	 * wholesale or versioned by Level. Updating in place, instead of moving
	 * the old file out and creating a fresh one, is deliberate: a rename
	 * carries any `[[Name]]` links elsewhere in the vault along with it, so
	 * moving the *old* file to the archive would leave every existing
	 * reference to this hero pointing at the outdated snapshot instead of
	 * the current one. There's no failure case: re-importing a hero always
	 * succeeds and always keeps the previous version around in the archive.
	 */
	private async writeHeroFile(heroName: string, content: string): Promise<TFile> {
		const folder = this.settings.destinationFolder ? normalizePath(this.settings.destinationFolder) : "";
		if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}

		const baseName = sanitizeFilename(heroName);
		const path = this.computeNotePath(heroName);

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			await this.archiveFileContent(existing, baseName);
			// Full regenerate-and-replace; process() runs atomically so a
			// concurrent editor/plugin write can't interleave.
			await this.app.vault.process(existing, () => content);
			return existing;
		}

		return this.app.vault.create(path, content);
	}

	/** Copies a hero's previous Note content into the archive folder, timestamped, before it's replaced in place. */
	private async archiveFileContent(file: TFile, baseName: string): Promise<void> {
		const archiveFolder = normalizePath(this.settings.archiveFolder || DEFAULT_SETTINGS.archiveFolder);
		if (!this.app.vault.getAbstractFileByPath(archiveFolder)) {
			await this.app.vault.createFolder(archiveFolder);
		}

		const stem = `${baseName} - ${formatTimestampForFilename(new Date())}`;
		let archivePath = normalizePath(`${archiveFolder}/${stem}.md`);
		// Millisecond precision still isn't a guarantee (system clock resolution,
		// two rapid re-imports landing in the same tick) — fall back to a counter
		// suffix rather than silently clobbering a still-recent archived version.
		for (let n = 2; this.app.vault.getAbstractFileByPath(archivePath); n++) {
			archivePath = normalizePath(`${archiveFolder}/${stem} (${n}).md`);
		}

		const oldContent = await this.app.vault.read(file);
		await this.app.vault.create(archivePath, oldContent);
	}

	/**
	 * Deletes every archived Hero Note except the most recently modified one
	 * per hero — the current Note (outside the archive folder) is never
	 * touched. Goes through FileManager.trashFile rather than Vault.delete
	 * per Obsidian's plugin guidelines, so this still respects the user's own
	 * "Deleted files" vault setting (system trash, .trash folder, or
	 * permanent) instead of forcing permanent deletion unconditionally —
	 * the confirmation warns accordingly rather than overpromising "undoable".
	 */
	async cleanUpOldHeroNotes() {
		const staleFiles = this.findStaleArchivedNotes();
		if (!staleFiles.length) {
			new Notice("No old Hero Notes to clean up — every archived hero already has only its most recent version.");
			return;
		}

		const count = staleFiles.length;
		new ConfirmModal(
			this.app,
			"Delete old Hero Notes?",
			`This will delete ${count} archived Hero Note${count === 1 ? "" : "s"}, keeping only the most recent ` +
				"archived version of each hero. Where they end up depends on your vault's \"Deleted files\" setting " +
				"(Settings → Files and links) — if that's set to permanently delete, this cannot be undone.",
			"Delete old Notes",
			async () => {
				for (const file of staleFiles) {
					await this.app.fileManager.trashFile(file);
				}
				new Notice(`Deleted ${count} old Hero Note${count === 1 ? "" : "s"}.`);
			}
		).open();
	}

	/** Every archived Hero Note except the most recently modified one per hero, grouped by the name parseArchivedHeroName recovers from the filename. */
	private findStaleArchivedNotes(): TFile[] {
		const archiveFolder = normalizePath(this.settings.archiveFolder || DEFAULT_SETTINGS.archiveFolder);
		const folder = this.app.vault.getAbstractFileByPath(archiveFolder);
		if (!(folder instanceof TFolder)) return [];

		const byHero = new Map<string, TFile[]>();
		for (const file of folder.children) {
			if (!(file instanceof TFile) || file.extension !== "md") continue;
			const heroName = parseArchivedHeroName(file.basename);
			if (!heroName) continue;
			const group = byHero.get(heroName);
			if (group) group.push(file);
			else byHero.set(heroName, [file]);
		}

		const stale: TFile[] = [];
		for (const group of byHero.values()) {
			if (group.length <= 1) continue;
			group.sort((a, b) => b.stat.mtime - a.stat.mtime);
			stale.push(...group.slice(1));
		}
		return stale;
	}

	async loadSettings() {
		const saved = (await this.loadData()) as Partial<HeroImporterSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
