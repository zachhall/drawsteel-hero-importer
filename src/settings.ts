import { App, PluginSettingTab, Setting } from "obsidian";
import type DrawSteelHeroImporterPlugin from "../main";

export interface HeroImporterSettings {
	/** Vault-relative folder to place imported hero notes in. Empty string = vault root. */
	destinationFolder: string;
	/**
	 * If an existing file for this exact hero name AND level is found, replace it
	 * instead of failing. Does not affect versioning: a same-named hero at a
	 * *different* level always gets its own "Name - Level N" file regardless of
	 * this setting.
	 */
	overwriteExisting: boolean;
}

export const DEFAULT_SETTINGS: HeroImporterSettings = {
	destinationFolder: "",
	overwriteExisting: false,
};

export class HeroImporterSettingTab extends PluginSettingTab {
	plugin: DrawSteelHeroImporterPlugin;

	constructor(app: App, plugin: DrawSteelHeroImporterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Import a Hero as a Note")
			.setDesc(
				"Upload a .ds-hero file to create a new Hero Note, formatted with the " +
					"Draw Steel Elements plugin. This is the only file type accepted. " +
					".ds-hero files are exported from forgesteel.net, which is not " +
					"affiliated with this plugin."
			)
			.addButton((button) =>
				button
					.setButtonText("Choose .ds-hero file...")
					.setCta()
					.onClick(() => this.plugin.importAsNote())
			)
			.addButton((button) =>
				button
					.setButtonText("Go to Forge Steel")
					.setIcon("external-link")
					.onClick(() => window.open("https://forgesteel.net", "_blank"))
			);

		new Setting(containerEl)
			.setName("Import a Hero as a Canvas")
			.setDesc(
				"Upload a .ds-hero file to create a new Canvas laid out like MCDM's " +
					"printed character sheet (identity, characteristics, combat stats, " +
					"skills, and a grid of ability cards)."
			)
			.addButton((button) =>
				button
					.setButtonText("Choose .ds-hero file...")
					.setCta()
					.onClick(() => this.plugin.importAsCanvas())
			);

		new Setting(containerEl)
			.setName("Destination folder")
			.setDesc("Vault folder new Hero Notes and Canvases are created in. Leave blank to use the vault root.")
			.addText((text) =>
				text
					.setPlaceholder("Characters")
					.setValue(this.plugin.settings.destinationFolder)
					.onChange(async (value) => {
						this.plugin.settings.destinationFolder = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Overwrite existing files")
			.setDesc(
				"Replace an existing Note or Canvas when re-importing the same hero at " +
					"the same Level, instead of failing. A hero re-imported at a " +
					'different Level is never overwritten — it\'s always saved as its own "Name - Level N" file.'
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.overwriteExisting).onChange(async (value) => {
					this.plugin.settings.overwriteExisting = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
