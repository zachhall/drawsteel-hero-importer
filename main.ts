import { Notice, Plugin, TFile, normalizePath } from "obsidian";
import { readFile } from "fs/promises";
import { DsHero } from "./src/ds-hero-types";
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
	}

	async importAsNote() {
		const hero = await this.pickHeroFile();
		if (!hero) return;

		const heroLevel = hero.class?.level ?? 1;
		const flat = flattenHeroFeatures(hero, heroLevel);
		const stats = computeHeroStats(hero, flat.bonuses, flat.kits);
		const content = buildHeroNote(hero, stats, flat);

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
		const result = await dialog.showOpenDialog({
			title: "Select a .ds-hero file",
			properties: ["openFile"],
			filters: [{ name: "Draw Steel Hero", extensions: ["ds-hero"] }],
		});
		if (result.canceled || !result.filePaths.length) return undefined;

		try {
			const text = await readFile(result.filePaths[0], "utf-8");
			return this.parseHero(text);
		} catch (err) {
			this.reportImportError(err);
			return undefined;
		}
	}

	private pickHeroFileViaHtmlInput(): Promise<DsHero | undefined> {
		return new Promise((resolve) => {
			const input = document.createElement("input");
			input.type = "file";
			input.accept = ".ds-hero";
			input.style.display = "none";
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
			document.body.appendChild(input);
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
		const path = normalizePath(folder ? `${folder}/${baseName}.md` : `${baseName}.md`);

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			await this.archiveFileContent(existing, baseName);
			await this.app.vault.modify(existing, content);
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

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
