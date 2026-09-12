import { App, TFile } from "obsidian";
import { ancestriesFolder, classesFolder, findAmbiguousMatches, findExactFile, kitsFolder } from "./compendium-links";
import {
	findNamedFeatureSection,
	parseKitBonuses,
	ParsedKitBonuses,
	parseKitEquipment,
	parseSignatureAbility,
	ParsedSignatureAbility,
} from "./compendium-note-parser";
import { promptForMatchResolution } from "./match-resolution-modal";
import { PdfHeroData } from "./pdf-hero-types";

/**
 * Resolves only what's needed to fill an actual data gap the PDF sheet
 * leaves open — Kit's specific structured numbers/text the sheet doesn't
 * otherwise carry (stat bonuses, its Equipment listing, its Signature
 * Ability), found by matching its name against the DS Compendium. Career,
 * Ancestry, Complication, and Culture aspects are never resolved here: their
 * plain sheet name is already enough to show in the Note (compendium
 * wikilinks for background terms used to be generated here and in
 * markdown-builder.ts — removed; that's a different plugin's job now, see
 * drawsteel-rule-term-linker), and dumping a matching compendium note's full
 * body would add narrative prose nobody asked to have embedded (see
 * conversation — that used to happen and was explicitly reversed).
 */
/** One Ancestry trait or Class feature, resolved by name against the DS Compendium. `description` is undefined when either the Ancestry/Class note itself wasn't found or it has no heading matching this name — rendered name-only in that case (see buildNamedFeatureBlocks), never dropped. */
export interface ResolvedNamedFeature {
	name: string;
	description?: string;
}

export interface ResolvedPdfCompendiumData {
	kit?: { file: TFile; bonuses: ParsedKitBonuses; signatureAbility?: ParsedSignatureAbility; equipment?: string };
	/** From the sheet's "Perks 1" field — see PdfHeroData.ancestryTraitNames. */
	ancestryTraits?: ResolvedNamedFeature[];
	/** From the sheet's "Class Features 1" field, already excluding whichever entry names the class's own Heroic Resource (e.g. "Wrath") — that's already shown as its own Resources counter, not a trait to also list here. */
	classFeatures?: ResolvedNamedFeature[];
}

/** Returned by resolveOne to distinguish "no value on the sheet, nothing to resolve" from "the user explicitly skipped this one" from "the whole import was cancelled". */
type ResolveOutcome = { file: TFile } | { skipped: true } | { cancelled: true };

async function resolveOne(app: App, fieldLabel: string, folder: string, rawValue: string | undefined): Promise<ResolveOutcome> {
	if (!rawValue) return { skipped: true };

	const exact = findExactFile(app, folder, rawValue);
	if (exact) return { file: exact };

	const candidates = findAmbiguousMatches(app, folder, rawValue);
	if (candidates.length === 1) return { file: candidates[0] };

	const result = await promptForMatchResolution(app, fieldLabel, rawValue, candidates);
	if (!result) return { cancelled: true };
	if ("skip" in result) return { skipped: true };
	return { file: result.file };
}

/**
 * Compendium notes carry their own frontmatter (item_id/scc/source/etc.) —
 * meant for that note standing alone. It doesn't matter for the bold-label/
 * table scraping in compendium-note-parser.ts (frontmatter's "key: value"
 * lines don't match those patterns), but stripping it keeps this function
 * from ever handing scraper code a block it wasn't written to expect.
 * metadataCache already knows exactly where that block ends; a regex
 * fallback covers the (unexpected) case where the cache hasn't parsed the
 * file yet.
 */
function stripFrontmatter(app: App, file: TFile, content: string): string {
	const { metadataCache } = app;
	const frontmatterEnd = metadataCache.getFileCache(file)?.frontmatterPosition?.end.offset;
	const body = frontmatterEnd !== undefined ? content.slice(frontmatterEnd) : content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
	return body.replace(/^\s+/, "");
}

async function toResolvedFile(app: App, outcome: ResolveOutcome): Promise<{ file: TFile; body: string } | undefined | "cancelled"> {
	if ("cancelled" in outcome) return "cancelled";
	if ("skipped" in outcome) return undefined;

	const { vault } = app;
	const content = await vault.cachedRead(outcome.file);
	return { file: outcome.file, body: stripFrontmatter(app, outcome.file, content) };
}

/**
 * Ancestry/Class names are canonical, closed-vocabulary sheet fields (a
 * dropdown pick, not free text like Kit's guessed-at name), so this only
 * ever tries an exact `<folder>/<name>.md` match — no ambiguous-match modal
 * the way resolveOne needs for Kit. Each DS Compendium Ancestry/Class note is
 * one file holding every one of its traits/features as its own heading (see
 * findNamedFeatureSection); a name with no matching heading in that file, or
 * no file at all (unknown Ancestry/Class, or the compendium folder not
 * present in this vault), renders name-only rather than failing the import.
 */
async function resolveNamedFeatures(
	app: App,
	folder: string,
	conceptName: string | undefined,
	names: string[]
): Promise<ResolvedNamedFeature[] | undefined> {
	if (!names.length) return undefined;

	const file = conceptName ? findExactFile(app, folder, conceptName) : undefined;
	if (!file) return names.map((name) => ({ name }));

	const { vault } = app;
	const body = stripFrontmatter(app, file, await vault.cachedRead(file));
	return names.map((name) => ({ name, description: findNamedFeatureSection(body, name) }));
}

/**
 * Resolves Kit against the DS Compendium, awaiting a MatchResolutionModal
 * for anything ambiguous or unmatched before this function returns, per the
 * user's explicit "prompt, never silently guess" decision. Returns
 * undefined if the user cancelled the import from that prompt.
 */
export async function resolvePdfCompendiumLinks(app: App, pdfHero: PdfHeroData, compendiumRoot: string): Promise<ResolvedPdfCompendiumData | undefined> {
	const result: ResolvedPdfCompendiumData = {};

	const kitOutcome = await resolveOne(app, "Kit", kitsFolder(compendiumRoot), pdfHero.kitName);
	const kitFile = await toResolvedFile(app, kitOutcome);
	if (kitFile === "cancelled") return undefined;
	if (kitFile) {
		result.kit = {
			file: kitFile.file,
			bonuses: parseKitBonuses(kitFile.body),
			signatureAbility: parseSignatureAbility(kitFile.body),
			equipment: parseKitEquipment(kitFile.body),
		};
	}

	result.ancestryTraits = await resolveNamedFeatures(app, ancestriesFolder(compendiumRoot), pdfHero.ancestryName, pdfHero.ancestryTraitNames);

	const classFeatureNames = pdfHero.classFeatureNames.filter(
		(name) => name.toLowerCase() !== (pdfHero.heroicResourceName ?? "").toLowerCase()
	);
	result.classFeatures = await resolveNamedFeatures(app, classesFolder(compendiumRoot), pdfHero.className, classFeatureNames);

	return result;
}
