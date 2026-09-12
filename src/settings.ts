import { App, PluginSettingTab, Setting } from "obsidian";
import type DrawSteelHeroImporterPlugin from "../main";

export interface HeroImporterSettings {
	/** Vault-relative folder to place imported hero notes in. Empty string = vault root. */
	destinationFolder: string;
	/** Vault-relative folder outdated Notes are archived into on re-import. */
	archiveFolder: string;
	/** Vault-relative folder the user's DS Compendium lives in, used to look up Career/Kit/Ancestry/Culture/Complication/Feature notes. */
	compendiumFolder: string;
}

export const DEFAULT_SETTINGS: HeroImporterSettings = {
	destinationFolder: "",
	archiveFolder: "hero-archive",
	compendiumFolder: "DS Compendium",
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
			.setName("Import a Hero")
			.setDesc(
				"Upload a .ds-hero file (exported from forgesteel.net) or a filled official MCDM " +
					"Draw Steel character sheet PDF to create a new Hero Note, formatted with the " +
					"Draw Steel Elements plugin. Neither forgesteel.net nor MCDM are affiliated with " +
					"this plugin. PDF import looks up anything the sheet doesn't carry (full ability " +
					"text, kit bonuses, etc.) from the DS Compendium folder configured below."
			)
			.addButton((button) =>
				button
					.setButtonText("Choose file...")
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
			.setName("Destination folder")
			.setDesc("Vault folder new Hero Notes are created in. Leave blank to use the vault root.")
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
			.setName("DS compendium folder")
			.setDesc(
				"Vault folder your DS Compendium lives in — used only for PDF imports, to look up a Kit's stat " +
					`bonuses, Equipment, and Signature Ability. Leave blank to use "${DEFAULT_SETTINGS.compendiumFolder}".`
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.compendiumFolder)
					.setValue(this.plugin.settings.compendiumFolder)
					.onChange(async (value) => {
						this.plugin.settings.compendiumFolder = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Archive folder")
			.setDesc(
				'Re-importing a hero always keeps "Name.md" as the current file — the previous version\'s ' +
					'content is copied here first, as "Name - <timestamp>.md". Leave blank to use ' +
					`"${DEFAULT_SETTINGS.archiveFolder}" in the vault root.`
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.archiveFolder)
					.setValue(this.plugin.settings.archiveFolder)
					.onChange(async (value) => {
						this.plugin.settings.archiveFolder = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Clean up old Hero Notes")
			.setDesc(
				"Delete every archived version of a hero except the most recent one, clearing out " +
					"the clutter repeated re-imports leave in the archive folder. Each hero's current " +
					"Note is never touched."
			)
			.addButton((button) =>
				button
					.setButtonText("Delete old Notes")
					.setWarning()
					.onClick(() => this.plugin.cleanUpOldHeroNotes())
			);
	}
}
