import { Notice, Plugin, TFile, normalizePath } from "obsidian";
import { readFile } from "fs/promises";
import { buildHeroCanvas } from "./src/canvas-builder";
import { DsHero } from "./src/ds-hero-types";
import { flattenHeroFeatures } from "./src/feature-flatten";
import { computeHeroStats } from "./src/hero-stats";
import { buildHeroNote } from "./src/markdown-builder";
import { DEFAULT_SETTINGS, HeroImporterSettings, HeroImporterSettingTab } from "./src/settings";

function sanitizeFilename(name: string): string {
	return name.replace(/[\\/:*?"<>|]/g, "").trim() || "Unnamed Hero";
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

		this.addRibbonIcon("user-plus", "Import Draw Steel Hero as Note", () => this.importAsNote());
		this.addRibbonIcon("layout-dashboard", "Import Draw Steel Hero as Canvas", () => this.importAsCanvas());

		this.addCommand({
			id: "import-ds-hero",
			name: "Import Draw Steel Hero as Note (.ds-hero)",
			callback: () => this.importAsNote(),
		});

		this.addCommand({
			id: "import-ds-hero-canvas",
			name: "Import Draw Steel Hero as Canvas (.ds-hero)",
			callback: () => this.importAsCanvas(),
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

		const target = await this.writeHeroFile(hero.name, stats.level, "md", content);
		if (!target) return;

		new Notice(`Imported ${hero.name} to ${target.path}`);
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.openFile(target);
	}

	async importAsCanvas() {
		const hero = await this.pickHeroFile();
		if (!hero) return;

		const heroLevel = hero.class?.level ?? 1;
		const flat = flattenHeroFeatures(hero, heroLevel);
		const stats = computeHeroStats(hero, flat.bonuses, flat.kits);
		const canvas = buildHeroCanvas(hero, stats, flat);

		const target = await this.writeHeroFile(hero.name, stats.level, "canvas", JSON.stringify(canvas, null, 2));
		if (!target) return;

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
	 * Resolves where to save a hero, versioning by Level:
	 * - No existing file for this hero name -> use the bare name.
	 * - An existing file at the bare name IS this same Level -> that's the
	 *   target (subject to the overwrite setting below).
	 * - An existing file at the bare name is a DIFFERENT Level (or its Level
	 *   can't be determined, e.g. a pre-existing unrelated file) -> version
	 *   as "Name - Level N", which is itself subject to the same check
	 *   against whatever's already at *that* path.
	 */
	private async writeHeroFile(heroName: string, level: number, extension: string, content: string): Promise<TFile | undefined> {
		const folder = this.settings.destinationFolder ? normalizePath(this.settings.destinationFolder) : "";
		if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}

		const toPath = (filename: string) => normalizePath(folder ? `${folder}/${filename}.${extension}` : `${filename}.${extension}`);

		const baseName = sanitizeFilename(heroName);
		const barePath = toPath(baseName);
		const bareExisting = this.app.vault.getAbstractFileByPath(barePath);

		let targetPath = barePath;
		let existing: TFile | undefined = bareExisting instanceof TFile ? bareExisting : undefined;

		if (existing) {
			const existingLevel = await this.readExistingHeroLevel(existing);
			if (existingLevel !== level) {
				targetPath = toPath(`${baseName} - Level ${level}`);
				const versionedExisting = this.app.vault.getAbstractFileByPath(targetPath);
				existing = versionedExisting instanceof TFile ? versionedExisting : undefined;
			}
		}

		if (existing) {
			if (!this.settings.overwriteExisting) {
				new Notice(
					`A Level ${level} file for "${heroName}" already exists at "${targetPath}". ` +
						'Import canceled — enable "Overwrite existing files" in settings if you want to replace it.'
				);
				return undefined;
			}
			await this.app.vault.modify(existing, content);
			return existing;
		}

		return this.app.vault.create(targetPath, content);
	}

	/** Reads back the Level a previously-imported Note/Canvas was created for, if determinable. */
	private async readExistingHeroLevel(file: TFile): Promise<number | undefined> {
		try {
			const content = await this.app.vault.read(file);

			if (file.extension === "canvas") {
				const data = JSON.parse(content) as { metadata?: { level?: number } };
				return typeof data.metadata?.level === "number" ? data.metadata.level : undefined;
			}

			const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
			const levelLine = frontmatter?.[1].match(/^level:\s*(\d+)\s*$/m);
			return levelLine ? Number(levelLine[1]) : undefined;
		} catch {
			return undefined;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
