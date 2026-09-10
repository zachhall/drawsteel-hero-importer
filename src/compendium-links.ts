import { App, TFile, TFolder } from "obsidian";
import { DsHero } from "./ds-hero-types";
import { FlattenResult } from "./feature-flatten";

const CAREERS_FOLDER = "DS Compendium/Rules/Careers";
const KITS_FOLDER = "DS Compendium/Rules/Kits";
const FEATURES_ROOT = "DS Compendium/Rules/Features";

export interface BackgroundLinks {
	/** Linked markdown for the career value (e.g. "[[Gladiator]]"), or undefined if no matching note exists. */
	career?: string;
	/** Linked markdown per selected kit, same order as `flat.kits`; an entry is undefined if no matching note exists for that kit. */
	kits: (string | undefined)[];
	/** Aliased link markdown for the subclass field LABEL (e.g. "[[Censor Order|Order]]"), or undefined. */
	subclassLabel?: string;
	/** Aliased link markdown for the "Domain" field LABEL, or undefined. */
	domainLabel?: string;
}

function findExactFile(app: App, folder: string, name: string): TFile | undefined {
	const { vault } = app;
	const file = vault.getAbstractFileByPath(`${folder}/${name}.md`);
	return file instanceof TFile ? file : undefined;
}

/**
 * Finds a note directly inside `folder` (not recursing into subfolders —
 * those hold nested per-choice feature notes, e.g. a domain's own level-by-
 * level feature options, which would otherwise false-match a keyword search)
 * whose filename contains `keyword`. Prefers the shortest matching filename,
 * since the class's own overview note (e.g. "Censor Order") is reliably
 * shorter than any more specific note that happens to also contain the word.
 */
function findConceptNoteInFolder(app: App, folder: string, keyword: string): TFile | undefined {
	const { vault } = app;
	const abstractFolder = vault.getAbstractFileByPath(folder);
	if (!(abstractFolder instanceof TFolder)) return undefined;

	const needle = keyword.toLowerCase();
	const matches = abstractFolder.children.filter(
		(c): c is TFile => c instanceof TFile && c.extension === "md" && c.basename.toLowerCase().includes(needle)
	);
	if (!matches.length) return undefined;

	matches.sort((a, b) => a.basename.length - b.basename.length);
	return matches[0];
}

/**
 * Resolves the same DS Compendium wikilinks the user hand-adds to a hero
 * Note's Background box, using the vault's actual note structure so this
 * works for any class without hardcoding per-class paths:
 *
 * - Career / Kit: the VALUE itself is linked, but only if a note with that
 *   exact name exists in the compendium's dedicated Careers/Kits folder —
 *   those folders are one note per named option, so an exact match there is
 *   meaningful. A hero's specific career/kit pick otherwise renders as plain
 *   text rather than risk linking to an unrelated same-named note elsewhere
 *   in the vault (e.g. "Fate" also exists as an unrelated Talent ability).
 * - The class's subclass pick (e.g. a Censor's Order) and Domain have no
 *   reliable per-value note (an "Exorcist" or "Fate" note either doesn't
 *   exist or means something else) — instead, the field LABEL links to the
 *   class's own explainer note, found by keyword search directly inside
 *   `.../Features/<Class>/1st-Level Features/` (subclassName itself is the
 *   keyword for the subclass line, e.g. "Order"/"Discipline"/"Aspect"
 *   depending on class; "Domain" is the keyword for the Domain line).
 *
 * Obsidian's own generateMarkdownLink shortens the link when the target's
 * basename is unique in the vault, and falls back to a full disambiguating
 * path when it collides elsewhere (e.g. multiple classes each have their own
 * "Deity and Domains" note) — matching the manual links this logic was
 * reverse-engineered from in the Hellic test Note.
 */
export function resolveBackgroundLinks(app: App, hero: DsHero, flat: FlattenResult, notePath: string): BackgroundLinks {
	const { fileManager } = app;
	const result: BackgroundLinks = { kits: [] };

	if (hero.career) {
		const file = findExactFile(app, CAREERS_FOLDER, hero.career.name);
		if (file) result.career = fileManager.generateMarkdownLink(file, notePath);
	}

	result.kits = flat.kits.map((kit) => {
		const file = findExactFile(app, KITS_FOLDER, kit.name);
		return file ? fileManager.generateMarkdownLink(file, notePath) : undefined;
	});

	const className = hero.class?.name;
	const subclassLabel = hero.class?.subclassName;
	if (className && subclassLabel) {
		const file = findConceptNoteInFolder(app, `${FEATURES_ROOT}/${className}/1st-Level Features`, subclassLabel);
		if (file) result.subclassLabel = fileManager.generateMarkdownLink(file, notePath, undefined, subclassLabel);
	}

	if (className && flat.domains.length) {
		const file = findConceptNoteInFolder(app, `${FEATURES_ROOT}/${className}/1st-Level Features`, "Domain");
		if (file) result.domainLabel = fileManager.generateMarkdownLink(file, notePath, undefined, "Domain");
	}

	return result;
}
