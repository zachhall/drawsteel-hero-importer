import {
	buildBackgroundCallout,
	buildCharacteristicsBlock,
	buildFrontmatter,
	buildResourcesBlock,
	buildSkillsBlock,
	buildStatisticsBlock,
	buildVitalsBlock,
	NoteAbility,
	renderActionsGroup,
} from "./note-model";
import { PdfAbility, PdfHeroData } from "./pdf-hero-types";
import { ResolvedPdfCompendiumData } from "./pdf-compendium-resolver";

/**
 * Renders a Hero Note from PDF-sourced data — parallel to
 * markdown-builder.ts's buildHeroNote, not a modification of it, since a
 * PDF-derived hero has a fundamentally thinner data shape (see
 * pdf-hero-types.ts). Shares every section renderer that both import paths
 * can produce identically (see note-model.ts) — the two remaining
 * differences are (1) the `## Kit`/Equipment section, which has no
 * ForgeSteel equivalent, and (2) that this never has `## Traits`/
 * `## Background Info` (no PDF equivalent yet — a known, accepted gap).
 *
 * Compendium lookups here (see pdf-compendium-resolver.ts) only ever fill an
 * actual data gap the sheet leaves open (Career/Kit note links, the Kit's
 * stat bonuses/equipment/Signature Ability) — never a whole matching note's
 * prose. Ancestry, Complication, and Culture aspects render as plain names
 * straight off the sheet, with no compendium lookup at all.
 *
 * An ability's numbers here (e.g. "Power Roll + 2") are already the hero's
 * final resolved values — the sheet itself computed them — so this needs no
 * equivalent of markdown-builder.ts's resolveTierText step.
 */

/**
 * Normalizes the sheet's action-type vocabulary ("Main"/"Move"/"Triggered"/
 * "Free Triggered") into the same display strings ForgeSteel abilities
 * already use ("Main Action"/"Move Action"/"Triggered Action") — this is
 * PDF-specific (the two sources' raw vocabularies differ) and feeds
 * NoteAbility.usage, which the shared bucketing in note-model.ts matches
 * against. A bare "Free" (Free Strikes) is left as-is — it matches no
 * bucket and falls into "Other", same as before this refactor. Missing
 * `action` also falls into "Other" via an empty string.
 */
function normalizePdfAbilityUsage(action: string | undefined): string {
	if (!action) return "";
	const trimmed = action.trim();
	if (/^main$/i.test(trimmed)) return "Main Action";
	if (/^move(ment)?$/i.test(trimmed)) return "Move Action";
	if (/^triggered$/i.test(trimmed) || /^free triggered$/i.test(trimmed)) return "Triggered Action";
	return trimmed;
}

/** The sheet's ability grid only ever lists the hero's class abilities (there's no equivalent of ForgeSteel's multi-source Kit/Ancestry/Career ability grants on a PDF sheet), so every ability's Source line reads "Class — <className>" — matching ForgeSteel's own "*Class — Tactician*" convention for a hero's own class abilities. */
function toNoteAbility(ability: PdfAbility, resourceName: string | undefined, className: string | undefined): NoteAbility {
	return {
		name: ability.name,
		isSignature: ability.type?.toLowerCase() === "signature",
		cost: ability.cost !== undefined ? Number(ability.cost) : undefined,
		resourceName,
		keywords: ability.keywords,
		usage: normalizePdfAbilityUsage(ability.action),
		distance: ability.distance,
		target: ability.target,
		effects: ability.details ? [{ effect: ability.details }] : [],
		displaySource: `Class: ${className ?? "Unknown"}`,
	};
}

export function buildPdfHeroNote(pdfHero: PdfHeroData, compendium: ResolvedPdfCompendiumData): string {
	const characteristics = {
		Might: pdfHero.characteristics.might ?? 0,
		Agility: pdfHero.characteristics.agility ?? 0,
		Reason: pdfHero.characteristics.reason ?? 0,
		Intuition: pdfHero.characteristics.intuition ?? 0,
		Presence: pdfHero.characteristics.presence ?? 0,
	};
	// ForgeSteel's DsHero has no direct Free Strike field either — hero-stats.ts
	// computes it the same way, from the hero's own characteristics.
	const freeStrike = Math.max(characteristics.Might, characteristics.Agility, 0);

	const frontmatter = buildFrontmatter({
		name: pdfHero.name,
		ancestryName: pdfHero.ancestryName,
		className: pdfHero.className,
		level: pdfHero.level,
		characteristics,
		victories: pdfHero.victories ?? 0,
		xp: pdfHero.xp ?? 0,
		maxStamina: pdfHero.maxStamina ?? 0,
		speed: pdfHero.speed ?? 0,
	});

	const characteristicsBlock = buildCharacteristicsBlock(characteristics);

	const vitalsBlock = buildVitalsBlock({
		maxStamina: pdfHero.maxStamina ?? 0,
		currentStamina: pdfHero.currentStamina ?? pdfHero.maxStamina ?? 0,
		tempStamina: 0,
	});

	// Grouped 3-per-row to match markdown-builder.ts's Resources layout: Heroic
	// Resource/Surges/Victories, then XP/Renown/Wealth.
	const resourceEntries: [string, number][] = [];
	if (pdfHero.heroicResourceName) resourceEntries.push([pdfHero.heroicResourceName, pdfHero.heroicResourceValue ?? 0]);
	resourceEntries.push(
		["Surges", pdfHero.surges ?? 0],
		["Victories", pdfHero.victories ?? 0],
		["XP", pdfHero.xp ?? 0],
		["Renown", pdfHero.renown ?? 0],
		["Wealth", pdfHero.wealth ?? 0]
	);
	const resourcesBlock = buildResourcesBlock(resourceEntries);

	const statisticsBlock = buildStatisticsBlock({
		speed: pdfHero.speed ?? 0,
		stability: pdfHero.stability ?? 0,
		disengage: pdfHero.disengage ?? 0,
		freeStrike,
		size: pdfHero.size ?? "1M",
	});

	const skillsBlock = buildSkillsBlock(pdfHero.skills);

	const backgroundLines: { label: string; value: string }[] = [];
	if (pdfHero.cultureEnvironmentName || pdfHero.cultureOrganizationName || pdfHero.cultureUpbringingName) {
		// Matches markdown-builder.ts's Culture callout line: plain text, never
		// linked — ForgeSteel's own path doesn't resolve Culture links either.
		const parts = [pdfHero.cultureEnvironmentName, pdfHero.cultureOrganizationName, pdfHero.cultureUpbringingName].filter(
			(p): p is string => !!p
		);
		if (parts.length) backgroundLines.push({ label: "Culture", value: parts.join(", ") });
	}
	if (pdfHero.careerName) backgroundLines.push({ label: "Career", value: compendium.career?.link ?? pdfHero.careerName });
	if (pdfHero.kitName) backgroundLines.push({ label: "Kit", value: compendium.kit?.link ?? pdfHero.kitName });
	const backgroundCallout = buildBackgroundCallout(backgroundLines);

	const noteAbilities = pdfHero.abilities.map((a) => toNoteAbility(a, pdfHero.heroicResourceName, pdfHero.className));
	const actionsSection = noteAbilities.length ? `## Actions\n\n${renderActionsGroup(noteAbilities)}` : undefined;

	const signatureAbilitySection = compendium.kit?.signatureAbility
		? [
				"### Signature Ability",
				"",
				compendium.kit.signatureAbility.name ? `**${compendium.kit.signatureAbility.name}**` : undefined,
				compendium.kit.signatureAbility.powerRollText,
			]
				.filter((s): s is string => !!s)
				.join("\n\n")
		: undefined;

	const kitBonuses = compendium.kit?.bonuses;
	const kitBonusLines = kitBonuses
		? Object.entries(kitBonuses)
				.filter(([, v]) => v !== undefined)
				.map(([k, v]) => `- **${k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}:** ${v}`)
		: [];
	const kitBonusesSection = kitBonusLines.length ? ["### Kit Bonuses", "", kitBonusLines.join("\n")].join("\n") : undefined;

	const equipmentLines: string[] = [];
	if (pdfHero.armorName) equipmentLines.push(`- **Armor:** ${pdfHero.armorName}`);
	if (pdfHero.weaponName) equipmentLines.push(`- **Weapon/Implement:** ${pdfHero.weaponName}`);
	if (compendium.kit?.equipment) equipmentLines.push(`- **Kit Equipment:** ${compendium.kit.equipment}`);
	const equipmentSection = equipmentLines.length ? ["### Equipment", "", equipmentLines.join("\n")].join("\n") : undefined;

	const kitSection = kitBonusesSection || signatureAbilitySection || equipmentSection
		? `## Kit\n\n${[kitBonusesSection, equipmentSection, signatureAbilitySection].filter((s): s is string => !!s).join("\n\n")}`
		: undefined;

	const languages = pdfHero.cultureLanguageName
		? pdfHero.cultureLanguageName.split("\n").map((l) => l.trim()).filter(Boolean)
		: [];
	const detailsSection = languages.length ? `## Details\n\n### Languages\n\n${languages.map((l) => `- ${l}`).join("\n")}` : undefined;

	const notesSection = pdfHero.otherNotes ? `## Notes\n\n${pdfHero.otherNotes}` : undefined;

	const sections = [
		`---\n${frontmatter}\n---`,
		`# ${pdfHero.name}`,
		`*Level ${pdfHero.level} ${pdfHero.ancestryName ?? ""} ${pdfHero.className ?? ""}*`.trim(),
		backgroundCallout,
		`## Characteristics\n\n${characteristicsBlock}`,
		`## Vitals\n\n${vitalsBlock}`,
		`## Resources\n\n${resourcesBlock}`,
		`## Statistics\n\n${statisticsBlock}`,
		skillsBlock ? `## Skills\n\n${skillsBlock}` : undefined,
		actionsSection,
		kitSection,
		detailsSection,
		notesSection,
	]
		.filter((s): s is string => !!s)
		.map((s) => (s.startsWith("## ") ? `${s}\n\n<hr>` : s));

	return sections.join("\n\n");
}
