import {
	buildBackgroundInfoLines,
	buildCharacteristicsBlock,
	buildFrontmatter,
	buildNamedFeatureBlocks,
	buildResourcesBlock,
	buildSkillsBlock,
	buildStatisticsBlock,
	buildVitalsBlock,
	NoteAbility,
	renderActionsGroup,
} from "./note-model";
import { parsePdfAbilityText, splitComplicationSections } from "./pdf-ability-text";
import { PdfAbility, PdfHeroData } from "./pdf-hero-types";
import { ResolvedPdfCompendiumData } from "./pdf-compendium-resolver";

/**
 * Renders a Hero Note from PDF-sourced data — parallel to
 * markdown-builder.ts's buildHeroNote, not a modification of it, since a
 * PDF-derived hero has a fundamentally thinner data shape (see
 * pdf-hero-types.ts). Shares every section renderer that both import paths
 * can produce identically (see note-model.ts) — the one remaining structural
 * difference is the `## Kit`/Equipment section, which has no ForgeSteel
 * equivalent (ForgeSteel's own export already carries kit data inline via its
 * normal feature list). `## Traits` and `## Background Info` (with its nested
 * `### Ancestry`/`### Complication` groups) now exist on this path too, once
 * a sample sheet (a level 1 Censor "Hellic") turned up the "Perks 1"/"Class
 * Features 1"/"Complication Details" fields that make them possible.
 *
 * Compendium lookups here (see pdf-compendium-resolver.ts) only ever fill an
 * actual data gap the sheet leaves open: Kit's stat bonuses/equipment/
 * Signature Ability (the sheet never states these), and Ancestry Trait/Class
 * Feature description text (the sheet only ever names these, e.g. "Bloodfire
 * Rush" with no further text — the compendium lookup is what makes a real
 * `## Traits`/`### Ancestry` section possible at all, not optional enrichment
 * of data already present). Career, Culture aspects, and the Subclass/Domain
 * pick render as plain names straight off the sheet, with no compendium
 * lookup and no wikilink at all — linking rule terms is
 * drawsteel-rule-term-linker's job, not this plugin's. The Complication's own
 * Benefit/Drawback text needs no lookup either — unlike Ancestry Traits/Class
 * Features, the sheet states it in full itself ("Complication Details").
 *
 * An ability's numbers here (e.g. "Power Roll + 2") are already the hero's
 * final resolved values — the sheet itself computed them — so this needs no
 * equivalent of markdown-builder.ts's resolveTierText step. It DOES still
 * need its own text-structure parsing, though (see pdf-ability-text.ts):
 * unlike ForgeSteel's already-typed JSON sections, a PDF ability's whole
 * rules text is one free-text field, and an early version of this file
 * simply dumped it into a single `{effect}` string — losing the clickable
 * `roll`/`tier1-3` structure entirely. Every shape produced here has been
 * checked directly against this same hero's independently-built ForgeSteel
 * golden fixture (tests/fixtures/hellic.golden.md), not just checked for
 * "doesn't crash" — that comparison is also how resolvePdfAbilitySource and
 * isPdfAbilitySignature below were derived, not guessed at.
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

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionsAbility(text: string | undefined, abilityName: string): boolean {
	return !!text && new RegExp(`\\b${escapeRegExp(abilityName)}\\b`, "i").test(text);
}

/**
 * The sheet's four ability-type checkboxes (Free Strike/Signature/Heroic/
 * Other) are the CLASS's own action-economy categories — an ability marked
 * "Other" isn't the class's own at all, confirmed against a real filled
 * sheet (a level 1 Censor "Hellic") compared to that hero's independently-
 * built ForgeSteel golden fixture: "Friend Catapult" (Other) is really a
 * Career perk, "Pain for Pain" (Other) is really the Kit's own ability,
 * "Posthumous Retirement" (Other) is really the Complication's ability. The
 * sheet has no field that names an ability's true source directly, but three
 * fields happen to *mention* a granted ability's name in passing — Career
 * Benefit's "Perk: <name>", Modifier Benefits' "Features: <name>", and the
 * Complication's own Benefit/Drawback prose (e.g. "...your Posthumous
 * Retirement ability...") — checked in that order. An "Other" ability
 * matching none of them (e.g. an Ancestry-granted ability, which this sheet
 * gives no cross-reference for at all) falls back to "Unknown" rather than
 * the misleading default of "Class".
 */
function resolvePdfAbilitySource(ability: PdfAbility, pdfHero: PdfHeroData): string {
	if (ability.type?.toLowerCase() !== "other") return `Class: ${pdfHero.className ?? "Unknown"}`;
	if (mentionsAbility(pdfHero.careerBenefitText, ability.name)) return `Career: ${pdfHero.careerName ?? "Unknown"}`;
	if (mentionsAbility(pdfHero.modifierBenefitsText, ability.name)) return `Kit: ${pdfHero.kitName ?? "Unknown"}`;
	if (mentionsAbility(pdfHero.complicationDetails, ability.name)) return `Complication: ${pdfHero.complicationName ?? "Unknown"}`;
	return "Unknown";
}

/**
 * The sheet's own "Signature" checkbox only ever marks the CLASS's Signature
 * Ability — a Kit also grants its own Signature Ability (see
 * pdf-compendium-resolver.ts's Kit resolution), which the sheet has no
 * checkbox for at all and so gets marked "Other" instead (confirmed: "Pain
 * for Pain" is Type=Other on the sheet but is genuinely the Mountain kit's
 * Signature Ability per both the DS Compendium and the ForgeSteel golden
 * fixture). Cross-referencing the already-resolved Kit Signature Ability's
 * name catches this; an Ancestry/Career/Complication-granted ability is
 * never a Signature Ability, so no further cross-reference is needed there.
 */
function isPdfAbilitySignature(ability: PdfAbility, compendium: ResolvedPdfCompendiumData): boolean {
	if (ability.type?.toLowerCase() === "signature") return true;
	const kitSignatureName = compendium.kit?.signatureAbility?.name;
	return !!kitSignatureName && kitSignatureName.toLowerCase() === ability.name.toLowerCase();
}

function toNoteAbility(ability: PdfAbility, resourceName: string | undefined, pdfHero: PdfHeroData, compendium: ResolvedPdfCompendiumData): NoteAbility {
	const { trigger, effects } = parsePdfAbilityText(ability.details);
	return {
		name: ability.name,
		isSignature: isPdfAbilitySignature(ability, compendium),
		cost: ability.cost !== undefined ? Number(ability.cost) : undefined,
		resourceName,
		keywords: ability.keywords,
		usage: normalizePdfAbilityUsage(ability.action),
		distance: ability.distance,
		target: ability.target,
		trigger,
		effects,
		displaySource: resolvePdfAbilitySource(ability, pdfHero),
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

	// Recoveries used is assumed 0 on import (the sheet has no reliable field
	// for it — see pdf-hero-types.ts); Recovery Value is computed the same
	// way as the .ds-hero path, not read off the sheet.
	const maxRecoveries = pdfHero.maxRecoveries ?? 0;
	const vitalsBlock = buildVitalsBlock({
		maxStamina: pdfHero.maxStamina ?? 0,
		currentStamina: pdfHero.currentStamina ?? pdfHero.maxStamina ?? 0,
		tempStamina: 0,
		maxRecoveries,
		currentRecoveries: maxRecoveries,
		recoveryValue: Math.floor((pdfHero.maxStamina ?? 0) / 3),
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

	// Turns a multi-line sheet field ("Skills: Heal, Swim\nLanguage: Szetch\n...")
	// into one line — these render as a plain reference blurb (see
	// careerBenefitText/modifierBenefitsText below), not parsed apart, so they
	// need to fit the same single-line "- **Label:** value" shape every other
	// Background Info line uses.
	const toSingleLine = (text: string): string =>
		text.split("\n").map((l) => l.trim()).filter(Boolean).join("; ");

	// A Censor's Subclass field reads "Exorcist - Domain: Fate" — one sheet
	// string for two picks ForgeSteel renders as two separate Background Info
	// lines (the subclass pick, then Domain). Split on that pattern when it
	// matches; otherwise the whole string renders as one "Subclass" line
	// rather than guess at a different class's sheet format.
	function splitSubclassLines(raw: string | undefined): { label: string; value: string }[] {
		if (!raw) return [];
		const match = /^(.*?)\s*-\s*Domain:\s*(.+)$/i.exec(raw.trim());
		if (!match) return [{ label: "Subclass", value: raw.trim() }];
		return [
			{ label: "Subclass", value: match[1].trim() },
			{ label: "Domain", value: match[2].trim() },
		];
	}

	const backgroundLines: { label: string; value: string }[] = [];
	if (pdfHero.cultureEnvironmentName || pdfHero.cultureOrganizationName || pdfHero.cultureUpbringingName) {
		// Matches markdown-builder.ts's Culture line: plain text, never linked —
		// ForgeSteel's own path doesn't resolve Culture links either.
		const parts = [pdfHero.cultureEnvironmentName, pdfHero.cultureOrganizationName, pdfHero.cultureUpbringingName].filter(
			(p): p is string => !!p
		);
		if (parts.length) backgroundLines.push({ label: "Culture", value: parts.join(", ") });
	}
	if (pdfHero.careerName) {
		const incident = pdfHero.careerIncitingIncident ? ` (Inciting Incident: ${pdfHero.careerIncitingIncident})` : "";
		backgroundLines.push({ label: "Career", value: `${pdfHero.careerName}${incident}` });
	}
	if (pdfHero.careerBenefitText) backgroundLines.push({ label: "Career Benefits", value: toSingleLine(pdfHero.careerBenefitText) });
	backgroundLines.push(...splitSubclassLines(pdfHero.subclassName));
	if (pdfHero.kitName) backgroundLines.push({ label: "Kit", value: pdfHero.kitName });
	if (pdfHero.modifierBenefitsText) backgroundLines.push({ label: "Kit Benefits", value: toSingleLine(pdfHero.modifierBenefitsText) });
	const backgroundInfoLines = buildBackgroundInfoLines(backgroundLines);

	const ancestryTraitsGroup = compendium.ancestryTraits?.length
		? `### Ancestry\n\n${buildNamedFeatureBlocks(compendium.ancestryTraits, `Ancestry: ${pdfHero.ancestryName ?? "Unknown"}`)}`
		: undefined;

	// The Complication's own name+details, not a compendium lookup — its
	// Benefit/Drawback text is already complete on the sheet (see this file's
	// own doc comment). Split into separate "<name> Benefit"/"<name> Drawback"
	// entries when the text is labeled that way, matching ForgeSteel's own
	// shape for this data (confirmed against the Hellic golden fixture).
	const complicationGroup = pdfHero.complicationName
		? `### Complication\n\n${buildNamedFeatureBlocks(
				splitComplicationSections(pdfHero.complicationName, pdfHero.complicationDetails),
				`Complication: ${pdfHero.complicationName}`
			)}`
		: undefined;

	const backgroundInfoBody = [backgroundInfoLines, ancestryTraitsGroup, complicationGroup]
		.filter((s): s is string => !!s)
		.join("\n\n");
	const backgroundInfoSection = backgroundInfoBody ? `## Background Info\n\n${backgroundInfoBody}` : undefined;

	// Class features (e.g. a Censor's "Oracular Visions") the sheet named but
	// the ability grid never lists — mirrors markdown-builder.ts's own
	// "## Traits" section for Class-sourced non-ability features. The Heroic
	// Resource's own name (e.g. "Wrath") is already filtered out of
	// compendium.classFeatures by resolvePdfCompendiumLinks, since it's already
	// shown as its own Resources counter.
	const traitsSection = compendium.classFeatures?.length
		? `## Traits\n\n${buildNamedFeatureBlocks(compendium.classFeatures, `Class: ${pdfHero.className ?? "Unknown"}`)}`
		: undefined;

	const noteAbilities = pdfHero.abilities.map((a) => toNoteAbility(a, pdfHero.heroicResourceName, pdfHero, compendium));
	const actionsSection = noteAbilities.length ? `## Actions\n\n${renderActionsGroup(noteAbilities)}` : undefined;

	// If the Kit's Signature Ability is already one of the abilities the grid
	// listed (confirmed against a real sheet: "Pain for Pain" is both a grid
	// ability AND the Mountain kit's compendium-resolved Signature Ability —
	// see isPdfAbilitySignature above), don't also import its compendium prose
	// here — that would show the same ability twice. Only Abilities can
	// double up like this; a Kit's stat bonuses/equipment have no equivalent
	// second listing anywhere else on the sheet.
	const kitSignatureAbilityName = compendium.kit?.signatureAbility?.name;
	const kitSignatureAbilityAlreadyListed =
		!!kitSignatureAbilityName && pdfHero.abilities.some((a) => a.name.toLowerCase() === kitSignatureAbilityName.toLowerCase());
	const signatureAbilitySection =
		compendium.kit?.signatureAbility && !kitSignatureAbilityAlreadyListed
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

	// The Kit's own name only otherwise appears as a single Background Info
	// line — put it in the heading too, so it's visible right where the rest
	// of the Kit's data (bonuses/equipment/Signature Ability) actually lives.
	const kitHeading = pdfHero.kitName ? `## Kit — ${pdfHero.kitName}` : "## Kit";
	const kitSection = kitBonusesSection || signatureAbilitySection || equipmentSection
		? `${kitHeading}\n\n${[kitBonusesSection, equipmentSection, signatureAbilitySection].filter((s): s is string => !!s).join("\n\n")}`
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
		`## Characteristics\n\n${characteristicsBlock}`,
		`## Vitals\n\n${vitalsBlock}`,
		`## Resources\n\n${resourcesBlock}`,
		`## Statistics\n\n${statisticsBlock}`,
		skillsBlock ? `## Skills\n\n${skillsBlock}` : undefined,
		actionsSection,
		traitsSection,
		kitSection,
		detailsSection,
		notesSection,
		backgroundInfoSection,
	]
		.filter((s): s is string => !!s)
		.map((s) => (s.startsWith("## ") ? `${s}\n\n<hr>` : s));

	return sections.join("\n\n");
}
