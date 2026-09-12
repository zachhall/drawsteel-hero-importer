import { DsAbility, DsAbilityDistance, DsAbilitySection, DsHero } from "./ds-hero-types";
import { FlatFeature, FlattenResult } from "./feature-flatten";
import { HeroStats } from "./hero-stats";
import { dsBlock, resolveTierText } from "./note-block-helpers";
import {
	abilityToFeatureBlock,
	buildBackgroundInfoLines as renderBackgroundInfoLines,
	buildCharacteristicsBlock,
	buildFrontmatter,
	buildResourcesBlock,
	buildSkillsBlock,
	buildStatisticsBlock,
	buildVitalsBlock,
	NoteAbility,
	renderActionsGroup,
	sourceEffects,
} from "./note-model";

function formatDistance(distances: DsAbilityDistance[]): string | undefined {
	if (!distances?.length) return undefined;
	return distances
		.map((d) => {
			switch (d.type) {
				case "Melee":
					return `Melee ${d.value}`;
				case "Ranged":
					return `Ranged ${d.value}`;
				case "Aura":
					return `Aura ${d.value}`;
				case "Burst":
					return `${d.value} burst`;
				case "Cube":
					return `${d.value} cube${d.within ? ` within ${d.within}` : ""}`;
				case "Self":
					return "Self";
				default:
					return `${d.type} ${d.value}`;
			}
		})
		.join(", ");
}

function mapSections(sections: DsAbilitySection[], characteristics: Record<string, number>): Record<string, unknown>[] {
	const mapped: (Record<string, unknown> | undefined)[] = sections.map((s) => {
		if (s.type === "roll" && s.roll) {
			// An ability listing multiple characteristics (e.g. "Might/Agility") uses
			// whichever is highest, per the Draw Steel rules. power-roll-detector only
			// makes a roll clickable when it sees a literal number after "Power Roll +",
			// so the characteristic name has to be resolved to the hero's actual value
			// here rather than left as a name.
			const best = Math.max(...s.roll.characteristic.map((c) => characteristics[c] ?? 0));
			const total = best + (s.roll.bonus ?? 0);
			return {
				roll: `Power Roll + ${total}`,
				tier1: resolveTierText(s.roll.tier1, characteristics),
				tier2: resolveTierText(s.roll.tier2, characteristics),
				tier3: resolveTierText(s.roll.tier3, characteristics),
			};
		}
		if (s.type === "text" && s.text) {
			return { effect: resolveTierText(s.text.trim(), characteristics) };
		}
		if (s.type === "field") {
			return {
				name: s.name,
				cost: s.value !== undefined ? String(s.value) : undefined,
				effect: resolveTierText(s.effect?.trim(), characteristics),
			};
		}
		// 'package' sections reference the sourcebook compendium and can't be
		// resolved from the .ds-hero export alone — omitted in v1.
		return undefined;
	});

	return mapped.filter((x): x is Record<string, unknown> => !!x);
}

/** Maps a ForgeSteel DsAbility into the shared NoteAbility shape (see note-model.ts) — this is the one place resolveTierText's shorthand-resolution runs (via mapSections) for the ForgeSteel path, since a PDF-sourced ability's text is already fully resolved on the sheet. */
function toNoteAbility(ability: DsAbility, resourceName: string | undefined, characteristics: Record<string, number>, displaySource: string): NoteAbility {
	return {
		name: ability.name,
		isSignature: ability.cost === "signature",
		cost: typeof ability.cost === "number" ? ability.cost : undefined,
		resourceName,
		keywords: ability.keywords,
		flavor: ability.description?.trim() || undefined,
		usage: ability.type.usage,
		distance: formatDistance(ability.distance),
		target: ability.target || undefined,
		trigger: ability.type.trigger || undefined,
		effects: mapSections(ability.sections, characteristics),
		displaySource,
	};
}

function textToFeatureBlock(name: string, description: string, displaySource: string): Record<string, unknown> {
	return {
		type: "feature",
		feature_type: "trait",
		name,
		effects: [{ effect: description.trim() }, ...sourceEffects(displaySource)],
	};
}

const SOURCE_GROUPS: { title: string; prefix: string }[] = [
	{ title: "Ancestry", prefix: "Ancestry:" },
	{ title: "Culture", prefix: "Culture:" },
	{ title: "Career", prefix: "Career:" },
	{ title: "Actions", prefix: "Class:" },
	{ title: "Kit", prefix: "Kit:" },
	{ title: "Domain", prefix: "Domain:" },
	{ title: "Complication", prefix: "Complication:" },
];

/** Groups combined under one collapsible "## Background Info" section at the end of the Note, rather than each getting its own top-level heading in build order. */
const BACKGROUND_INFO_GROUP_TITLES = new Set(["Ancestry", "Career", "Domain", "Complication"]);

function groupFeatures(features: FlatFeature[]): { title: string; items: FlatFeature[] }[] {
	const groups: { title: string; items: FlatFeature[] }[] = SOURCE_GROUPS.map((g) => ({ title: g.title, items: [] as FlatFeature[] }));
	const other: FlatFeature[] = [];

	features.forEach((f) => {
		const group = SOURCE_GROUPS.find((g) => f.source.startsWith(g.prefix));
		if (group) {
			groups.find((g) => g.title === group.title)!.items.push(f);
		} else {
			other.push(f);
		}
	});

	if (other.length) groups.push({ title: "Other", items: other });

	return groups.filter((g) => g.items.length > 0);
}

/**
 * Pulls "trait" (kind: "text") features out of the Actions group and into
 * their own list, mutating the group's items in place — the Actions section
 * is meant to hold only the class's Abilities (see renderActionsGroup); its
 * trait features (perks, "Master of Arms"-style passive upgrades, etc.) get
 * their own top-level "## Traits" section instead, between Actions and
 * Details. Non-trait, non-ability items (e.g. an immunity line) stay put.
 */
function extractActionsTraits(groups: { title: string; items: FlatFeature[] }[]): FlatFeature[] {
	const actionsGroup = groups.find((g) => g.title === "Actions");
	if (!actionsGroup) return [];

	const traits = actionsGroup.items.filter((f) => f.kind === "text");
	actionsGroup.items = actionsGroup.items.filter((f) => f.kind !== "text");
	return traits;
}

/**
 * Abilities granted by an Ancestry, Career, Kit, Domain, or Complication
 * belong under the same action-type H3s as the class's own abilities (see
 * renderActionsGroup) rather than getting a separate un-bucketed listing
 * under their own heading — retagging their `source` to "Class:" before
 * grouping is enough to relocate them, since `source` is only ever read for
 * grouping (never displayed). Traits and other non-ability features from
 * these sources are untouched and keep rendering under their own heading
 * (Ancestry/Career under Background Info, Kit/Domain/Complication under
 * their own top-level heading); if migrating an ability empties one of those
 * groups entirely, groupFeatures already drops an empty group on its own.
 */
const ABILITY_SOURCE_PREFIXES_MIGRATED_TO_CLASS = ["Ancestry:", "Career:", "Kit:", "Domain:", "Complication:"];

function migrateGrantedAbilitiesToActions(features: FlatFeature[]): FlatFeature[] {
	return features.map((f) => {
		if (f.kind === "ability" && ABILITY_SOURCE_PREFIXES_MIGRATED_TO_CLASS.some((p) => f.source.startsWith(p))) {
			return { ...f, source: `Class: ${f.source}` };
		}
		return f;
	});
}

function renderFeature(
	feature: FlatFeature,
	resourceName: string | undefined,
	characteristics: Record<string, number>,
	headingLevel = "###"
): string {
	switch (feature.kind) {
		case "ability":
			return dsBlock("ds-feature", abilityToFeatureBlock(toNoteAbility(feature.ability, resourceName, characteristics, feature.displaySource)));
		case "text":
			return dsBlock("ds-feature", textToFeatureBlock(feature.name, feature.description, feature.displaySource));
		case "resource": {
			const lines = [`${headingLevel} ${feature.name}`];
			if (feature.details) lines.push(feature.details);
			feature.gains.forEach((g) => lines.push(`- **${g.trigger}**: +${g.value} (${g.frequency})`));
			return lines.join("\n");
		}
		case "immunity":
			return `- **${feature.name}**: Immunity to ${feature.conditions.join(", ")}`;
	}
}

/**
 * Splits an Actions group's items (the class's own abilities plus any
 * migrated in from a Kit/Domain/Complication — see
 * migrateGrantedAbilitiesToActions) into NoteAbility[] plus any other,
 * already-rendered non-ability feature (e.g. an immunity line) — trait
 * features are pulled out to the Note's own "## Traits" section (see
 * extractActionsTraits) before this runs. The actual bucketing/sorting/
 * rendering (Main Action/Maneuver/Move Action/Triggered Action/Other, each
 * ordered signature-first-then-ascending-cost) is shared with the PDF
 * import path — see renderActionsGroup in note-model.ts.
 */
function renderActionsSection(items: FlatFeature[], resourceName: string | undefined, characteristics: Record<string, number>): string {
	const abilityFeatures = items.filter((f): f is Extract<FlatFeature, { kind: "ability" }> => f.kind === "ability");
	const others = items.filter((f) => f.kind !== "ability");

	const abilities = abilityFeatures.map((f) => toNoteAbility(f.ability, resourceName, characteristics, f.displaySource));
	const otherRendered = others.map((f) => renderFeature(f, resourceName, characteristics));

	return renderActionsGroup(abilities, otherRendered);
}

/**
 * Culture, Career, the hero's subclass pick (e.g. a Censor's Order), Domain,
 * and Kit often carry no ability/feature of their own to hang a ds-feature
 * block on, so without this they'd be invisible in the Note despite being
 * real, chosen parts of the build. Rendered as plain text at the top of
 * "## Background Info" (see buildHeroNote), above its "### Ancestry"/etc.
 * groups — previously its own collapsed Obsidian callout near the top of
 * the Note, dropped in favor of living alongside the rest of the hero's
 * background info in one place.
 *
 * Values render as plain names, not compendium wikilinks — this plugin used
 * to resolve them against the vault's DS Compendium notes (see git history,
 * compendium-links.ts's now-removed resolveBackgroundLinks), but that was
 * dropped: linking rule terms is a different plugin's job
 * (drawsteel-rule-term-linker), not something a Note generator should also
 * be doing.
 */
function buildBackgroundInfoLines(hero: DsHero, flat: FlattenResult): string | undefined {
	const lines: { label: string; value: string }[] = [];

	if (hero.culture) {
		lines.push({ label: "Culture", value: `${hero.culture.name}${hero.culture.type ? ` (${hero.culture.type})` : ""}` });
	}
	if (hero.career) {
		lines.push({ label: "Career", value: hero.career.name });
	}
	const subclassLabel = hero.class?.subclassName;
	const selectedSubclasses = hero.class?.subclasses?.filter((s) => s.selected).map((s) => s.name) ?? [];
	if (subclassLabel && selectedSubclasses.length) {
		lines.push({ label: subclassLabel, value: selectedSubclasses.join(", ") });
	}
	if (flat.domains.length) {
		lines.push({ label: "Domain", value: flat.domains.map((d) => d.name).join(", ") });
	}
	if (flat.kits.length) {
		lines.push({ label: "Kit", value: flat.kits.map((kit) => kit.name).join(", ") });
	}

	return renderBackgroundInfoLines(lines);
}

export function buildHeroNote(hero: DsHero, stats: HeroStats, flat: FlattenResult): string {
	const resourceFeature = flat.features.find((f): f is Extract<FlatFeature, { kind: "resource" }> => f.kind === "resource");

	const characteristics = {
		Might: stats.characteristics["Might"] ?? 0,
		Agility: stats.characteristics["Agility"] ?? 0,
		Reason: stats.characteristics["Reason"] ?? 0,
		Intuition: stats.characteristics["Intuition"] ?? 0,
		Presence: stats.characteristics["Presence"] ?? 0,
	};

	const frontmatter = buildFrontmatter({
		name: hero.name,
		ancestryName: hero.ancestry?.name,
		className: hero.class?.name,
		level: stats.level,
		characteristics,
		victories: hero.state.victories ?? 0,
		xp: hero.state.xp ?? 0,
		maxStamina: stats.stamina,
		speed: stats.speed,
	});

	const characteristicsBlock = buildCharacteristicsBlock(characteristics);

	// current_stamina/temp_stamina reflect the hero's actual condition at
	// export time (state.staminaDamage/staminaTemp), not always a full bar —
	// a fresh import with no damage taken naturally comes out equal to max.
	const vitalsBlock = buildVitalsBlock({
		maxStamina: stats.stamina,
		currentStamina: stats.stamina - (hero.state.staminaDamage ?? 0),
		tempStamina: hero.state.staminaTemp ?? 0,
		maxRecoveries: stats.recoveries,
		currentRecoveries: stats.recoveries - (hero.state.recoveriesUsed ?? 0),
		recoveryValue: stats.recoveryValue,
	});

	// Wrath/Surges/Victories/XP/Renown/Wealth are all state the hero already
	// has a running total for — read straight from hero.state (and the
	// Heroic Resource feature's own current value for the first entry), not
	// derived from Bonus features the way Statistics below is. Each is its
	// own ds-counter (rather than one ds-values-row) so the player can click
	// +/- to track them during play.
	const resourceEntries: [string, number][] = [];
	if (resourceFeature) resourceEntries.push([resourceFeature.name, resourceFeature.currentValue]);
	resourceEntries.push(
		["Surges", hero.state.surges ?? 0],
		["Victories", hero.state.victories ?? 0],
		["XP", hero.state.xp ?? 0],
		["Renown", hero.state.renown ?? 0],
		["Wealth", hero.state.wealth ?? 0]
	);
	const resourcesBlock = buildResourcesBlock(resourceEntries);

	const statisticsBlock = buildStatisticsBlock({
		speed: stats.speed,
		stability: stats.stability,
		disengage: stats.disengage,
		freeStrike: stats.freeStrike,
		size: stats.size,
	});

	const skillsBlock = buildSkillsBlock(flat.skills);

	const nonResourceFeatures = migrateGrantedAbilitiesToActions(flat.features.filter((f) => f.kind !== "resource"));
	const featureGroups = groupFeatures(nonResourceFeatures);
	const traitItems = extractActionsTraits(featureGroups);

	// Ancestry/Career/Domain/Complication are rarely referenced during play —
	// bundled into one "Background Info" section (as H3s) at the very end of
	// the Note instead of each getting its own top-level heading in the
	// middle, so folding that one heading collapses all of them together.
	// The Actions group can end up empty here if extractActionsTraits pulled
	// out its only items (an all-trait class with no abilities yet).
	const mainGroups = featureGroups.filter((g) => !BACKGROUND_INFO_GROUP_TITLES.has(g.title) && g.items.length > 0);
	const backgroundInfoGroups = featureGroups.filter((g) => BACKGROUND_INFO_GROUP_TITLES.has(g.title));

	const renderGroupBody = (g: { title: string; items: FlatFeature[] }) =>
		g.title === "Actions"
			? renderActionsSection(g.items, resourceFeature?.name, stats.characteristics)
			: g.items.map((f) => renderFeature(f, resourceFeature?.name, stats.characteristics)).join("\n\n");

	const featureSections = mainGroups.map((g) => `## ${g.title}\n\n${renderGroupBody(g)}`);

	const traitsSection = traitItems.length
		? `## Traits\n\n${traitItems.map((f) => renderFeature(f, resourceFeature?.name, stats.characteristics)).join("\n\n")}`
		: undefined;

	// Culture/Career/Subclass/Domain/Kit lines (see buildBackgroundInfoLines)
	// come first, above whichever ### group happens to be first — plain text,
	// not its own subsection, so it reads as this section's own lead-in.
	const backgroundInfoLines = buildBackgroundInfoLines(hero, flat);
	const backgroundInfoBody = [backgroundInfoLines, ...backgroundInfoGroups.map((g) => `### ${g.title}\n\n${renderGroupBody(g)}`)]
		.filter((s): s is string => !!s)
		.join("\n\n");
	const backgroundInfoSection = backgroundInfoBody ? `## Background Info\n\n${backgroundInfoBody}` : undefined;

	const detailsParts: string[] = [];
	if (flat.languages.length) {
		detailsParts.push(`### Languages\n\n${flat.languages.map((l) => `- ${l}`).join("\n")}`);
	}
	if (resourceFeature) {
		detailsParts.push(`### Heroic Resource\n\n${renderFeature(resourceFeature, undefined, stats.characteristics, "####")}`);
	}
	const detailsSection = detailsParts.length ? `## Details\n\n${detailsParts.join("\n\n")}` : undefined;

	const notesSection = hero.state.notes ? `## Notes\n\n${hero.state.notes}` : undefined;

	const sections = [
		`---\n${frontmatter}\n---`,
		`# ${hero.name}`,
		`*Level ${stats.level} ${hero.ancestry?.name ?? ""} ${hero.class?.name ?? ""}*`.trim(),
		`## Characteristics\n\n${characteristicsBlock}`,
		`## Vitals\n\n${vitalsBlock}`,
		`## Resources\n\n${resourcesBlock}`,
		`## Statistics\n\n${statisticsBlock}`,
		skillsBlock ? `## Skills\n\n${skillsBlock}` : undefined,
		...featureSections,
		traitsSection,
		detailsSection,
		notesSection,
		backgroundInfoSection,
	]
		.filter((s): s is string => !!s)
		// A section for a top-level ## heading (Background Info's lead-in lines
		// plus its nested ### groups included — the <hr> marks the end of the
		// whole section, not each subgroup within it) gets a trailing divider
		// so the Note reads as clearly separated blocks; the title/subtitle
		// above Characteristics aren't headed sections themselves, so they're
		// left alone.
		.map((s) => (s.startsWith("## ") ? `${s}\n\n<hr>` : s));

	return sections.join("\n\n");
}
