import { Notice, Platform, Plugin, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import { ConfirmModal } from "./src/confirm-modal";
import { resolveBackgroundLinks } from "./src/compendium-links";
import { DsHero } from "./src/ds-hero-types";
import { extractDsCounterValues, FRONTMATTER_SYNCED_COUNTERS } from "./src/frontmatter-sync";
import { flattenHeroFeatures } from "./src/feature-flatten";
import { computeHeroStats } from "./src/hero-stats";
import { buildHeroNote } from "./src/markdown-builder";
import { DEFAULT_SETTINGS, HeroImporterSettings, HeroImporterSettingTab } from "./src/settings";

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

export default class DrawSteelHeroImporterPlugin extends Plugin {
	settings!: HeroImporterSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("user-plus", "Import Draw Steel Hero", () => this.importAsNote());

		this.addCommand({
			id: "import-ds-hero",
			name: "Import Draw Steel Hero (.ds-hero)",
			callback: () => this.importAsNote(),
		});

		this.addSettingTab(new HeroImporterSettingTab(this.app, this));

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
		const hero = await this.pickHeroFile();
		if (!hero) return;

		const heroLevel = hero.class?.level ?? 1;
		const flat = flattenHeroFeatures(hero, heroLevel);
		const stats = computeHeroStats(hero, flat.bonuses, flat.kits, flat.characteristicBonuses);
		const notePath = this.computeNotePath(hero.name);
		const links = resolveBackgroundLinks(this.app, hero, flat, notePath);
		const content = buildHeroNote(hero, stats, flat, links);

		const target = await this.writeHeroFile(hero.name, content);

		new Notice(`Imported ${hero.name} to ${target.path}`);
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.openFile(target);
	}

	private async pickHeroFile(): Promise<DsHero | undefined> {
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

	private getElectron(): ElectronLike | undefined {
		try {
			return (window as unknown as { require?: (id: string) => ElectronLike }).require?.("electron");
		} catch {
			return undefined;
		}
	}

	private async pickHeroFileViaElectron(dialog: ElectronDialog): Promise<DsHero | undefined> {
		if (!Platform.isDesktop) return undefined;

		const result = await dialog.showOpenDialog({
			title: "Select a .ds-hero file",
			properties: ["openFile"],
			filters: [{ name: "Draw Steel Hero", extensions: ["ds-hero"] }],
		});
		if (result.canceled || !result.filePaths.length) return undefined;

		try {
			// Dynamic import, not a static one -- "fs/promises" doesn't exist on
			// mobile, and this branch only ever runs behind the Electron dialog
			// check above, which is desktop-only.
			const { readFile } = await import("fs/promises");
			const text = await readFile(result.filePaths[0], "utf-8");
			return this.parseHero(text);
		} catch (err) {
			this.reportImportError(err);
			return undefined;
		}
	}

	private pickHeroFileViaHtmlInput(): Promise<DsHero | undefined> {
		return new Promise((resolve) => {
			const input = document.body.createEl("input", {
				type: "file",
				cls: "dshi-hidden-file-input",
				attr: { accept: ".ds-hero" },
			});
			input.addEventListener("change", () => {
				const file = input.files?.[0];
				input.remove();
				if (!file) {
					resolve(undefined);
					return;
				}
				file
					.text()
					.then((text) => resolve(this.parseHero(text)))
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
