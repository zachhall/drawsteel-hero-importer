import { App, TFile, TFolder } from "obsidian";

export function kitsFolder(root: string): string {
	return `${root}/Rules/Kits`;
}

export function ancestriesFolder(root: string): string {
	return `${root}/Rules/Ancestries`;
}

export function classesFolder(root: string): string {
	return `${root}/Rules/Classes`;
}

export function findExactFile(app: App, folder: string, name: string): TFile | undefined {
	const { vault } = app;
	const file = vault.getAbstractFileByPath(`${folder}/${name}.md`);
	return file instanceof TFile ? file : undefined;
}

/** Every markdown file directly inside `folder` (not recursing) whose basename contains `name` — used for PDF-sourced free text, where a hand-typed value is more likely to have a typo or partial match than an exact ForgeSteel export value. Returns every match (not just the shortest) so a caller can present the full candidate list to the user. */
export function findAmbiguousMatches(app: App, folder: string, name: string): TFile[] {
	const { vault } = app;
	const abstractFolder = vault.getAbstractFileByPath(folder);
	if (!(abstractFolder instanceof TFolder)) return [];

	const needle = name.toLowerCase();
	return abstractFolder.children.filter(
		(c): c is TFile => c instanceof TFile && c.extension === "md" && c.basename.toLowerCase().includes(needle)
	);
}
