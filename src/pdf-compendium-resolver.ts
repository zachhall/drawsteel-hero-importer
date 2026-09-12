import { App, TFile } from "obsidian";
import { careersFolder, findAmbiguousMatches, findExactFile, kitsFolder } from "./compendium-links";
import { parseKitBonuses, ParsedKitBonuses, parseKitEquipment, parseSignatureAbility, ParsedSignatureAbility } from "./compendium-note-parser";
import { promptForMatchResolution } from "./match-resolution-modal";
import { PdfHeroData } from "./pdf-hero-types";

/**
 * Resolves only what's needed to fill an actual data gap the PDF sheet
 * leaves open — Career and Kit — each as a note LINK (matching
 * markdown-builder.ts's Background callout, which never embeds Career/Kit
 * prose either) plus, for Kit, the specific structured numbers/text the
 * sheet doesn't otherwise carry (stat bonuses, its Equipment listing, its
 * Signature Ability). Ancestry, Complication, and Culture aspects are never
 * resolved here: the sheet's plain name for each is already enough to show
 * in the Note, and dumping a matching compendium note's full body would add
 * narrative prose nobody asked to have embedded (see conversation — that
 * used to happen and was explicitly reversed).
 */
export interface ResolvedCompendiumLink {
	file: TFile;
	link: string;
}

export interface ResolvedPdfCompendiumData {
	career?: ResolvedCompendiumLink;
	kit?: ResolvedCompendiumLink & { bonuses: ParsedKitBonuses; signatureAbility?: ParsedSignatureAbility; equipment?: string };
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

async function toResolvedLink(app: App, notePath: string, outcome: ResolveOutcome): Promise<(ResolvedCompendiumLink & { body: string }) | undefined | "cancelled"> {
	if ("cancelled" in outcome) return "cancelled";
	if ("skipped" in outcome) return undefined;

	const { vault, fileManager } = app;
	const content = await vault.cachedRead(outcome.file);
	return { file: outcome.file, link: fileManager.generateMarkdownLink(outcome.file, notePath), body: stripFrontmatter(app, outcome.file, content) };
}

/**
 * Resolves Career and Kit against the DS Compendium, awaiting a
 * MatchResolutionModal for anything ambiguous or unmatched before this
 * function returns, per the user's explicit "prompt, never silently guess"
 * decision. Returns undefined if the user cancelled the import from either
 * prompt.
 */
export async function resolvePdfCompendiumLinks(
	app: App,
	pdfHero: PdfHeroData,
	compendiumRoot: string,
	notePath: string
): Promise<ResolvedPdfCompendiumData | undefined> {
	const result: ResolvedPdfCompendiumData = {};

	const careerOutcome = await resolveOne(app, "Career", careersFolder(compendiumRoot), pdfHero.careerName);
	const careerLink = await toResolvedLink(app, notePath, careerOutcome);
	if (careerLink === "cancelled") return undefined;
	if (careerLink) result.career = { file: careerLink.file, link: careerLink.link };

	const kitOutcome = await resolveOne(app, "Kit", kitsFolder(compendiumRoot), pdfHero.kitName);
	const kitLink = await toResolvedLink(app, notePath, kitOutcome);
	if (kitLink === "cancelled") return undefined;
	if (kitLink) {
		result.kit = {
			file: kitLink.file,
			link: kitLink.link,
			bonuses: parseKitBonuses(kitLink.body),
			signatureAbility: parseSignatureAbility(kitLink.body),
			equipment: parseKitEquipment(kitLink.body),
		};
	}

	return result;
}
