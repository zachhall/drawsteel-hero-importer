import * as yaml from "js-yaml";
import { BackgroundLinks } from "./compendium-links";
import { DsAbility, DsAbilityDistance, DsAbilitySection, DsHero } from "./ds-hero-types";
import { FlatFeature, FlattenResult } from "./feature-flatten";
import { HeroStats } from "./hero-stats";
import { findKnownUnsupportedSkillGroup, findOfficialSkill } from "./skill-data";

const FENCE = "~~~";

const CHARACTERISTIC_SHORTHAND: Record<string, string> = {
	M: "Might",
	A: "Agility",
	R: "Reason",
	I: "Intuition",
	P: "Presence",
};

/**
 * Tier text (e.g. "5 + P psychic damage") uses single-letter characteristic
 * shorthand for the hero's own bonus damage — only ever appearing right after
 * a "+", sometimes as a choice like "M or A damage" (use whichever is
 * higher). Elsewhere in the same string a letter can appear as part of a
 * potency check instead (e.g. "P < [weak]", meaning "the target resists
 * unless their Presence is less than your weak potency value") — that's left
 * untouched by only matching the "+ <letter>" addition shape; see
 * resolvePotencyThresholds for the "[weak]"/etc. half of that.
 *
 * Per the user's explicit request: substitute the shorthand with the hero's
 * actual characteristic value, but don't fold it into the base damage number
 * — keep them as separate addends so the player can still see how much of
 * the total came from their characteristic.
 */
function resolveDamageBonusShorthand(text: string | undefined, characteristics: Record<string, number>): string | undefined {
	if (!text) return text;
	return text.replace(/\+ ([MARIP])(?:\s+or\s+([MARIP]))?(?=[^a-zA-Z]|$)/g, (match, c1: string, c2?: string) => {
		const value1 = characteristics[CHARACTERISTIC_SHORTHAND[c1]] ?? 0;
		if (!c2) return `+ ${value1}`;
		const value2 = characteristics[CHARACTERISTIC_SHORTHAND[c2]] ?? 0;
		return `+ ${Math.max(value1, value2)}`;
	});
}

/**
 * "[weak]"/"[average]"/"[strong]" placeholders (e.g. "I < [weak]") stand for
 * the hero's potency values, per the Draw Steel rules: weak = highest
 * characteristic score − 2, average = highest − 1, strong = highest —
 * always based on the hero's single highest characteristic, regardless of
 * which characteristic the target resists with. Once resolved to numbers a
 * player can read the check directly (e.g. "I < 0") without doing the math
 * at the table.
 */
function resolvePotencyThresholds(text: string | undefined, characteristics: Record<string, number>): string | undefined {
	if (!text) return text;
	const highest = Math.max(...Object.values(characteristics), 0);
	const POTENCY_VALUES: Record<string, number> = {
		weak: highest - 2,
		average: highest - 1,
		strong: highest,
	};
	return text.replace(/\[(weak|average|strong)\]/gi, (match, tier: string) => String(POTENCY_VALUES[tier.toLowerCase()]));
}

function resolveTierText(text: string | undefined, characteristics: Record<string, number>): string | undefined {
	return resolvePotencyThresholds(resolveDamageBonusShorthand(text, characteristics), characteristics);
}

function dsBlock(language: string, body: Record<string, unknown>): string {
	const clean = stripUndefined(body);
	const dump = yaml.dump(clean, { lineWidth: -1, noRefs: true }).trimEnd();
	return `${FENCE}${language}\n${dump}\n${FENCE}`;
}

function stripUndefined<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map(stripUndefined) as unknown as T;
	}
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			if (v === undefined) continue;
			out[k] = stripUndefined(v);
		}
		return out as T;
	}
	return value;
}

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

function costDisplay(ability: DsAbility, resourceName: string | undefined): { cost?: string; ability_type?: string } {
	if (ability.cost === "signature") {
		return { ability_type: "Signature Ability" };
	}
	if (typeof ability.cost === "number" && ability.cost > 0) {
		return { cost: resourceName ? `${ability.cost} ${resourceName}` : String(ability.cost) };
	}
	return {};
}

/**
 * Appended as the last two `effects` entries on every ds-feature block, so
 * that once Abilities/Traits from many sources (Class, Subclass, Ancestry,
 * Kit, etc.) are merged together under one heading (## Actions, ## Traits),
 * each block still says where it came from — rendered as e.g.
 * "**Source:** *Kit — Rapid Fire*". ds-feature has no dedicated "source"
 * field, and its `metadata` property isn't rendered by the
 * draw-steel-elements plugin at all (it only reproduces the object as
 * frontmatter when a block is exported to its own note), so it can't be
 * used for this — an effect entry (the "Source" name still gets the
 * plugin's normal bold-key treatment, same as "Trigger:" or a "Spend" cost)
 * is the only field that actually renders.
 *
 * A leading "---" divider entry is included because the plugin's own
 * effect-to-effect spacing is otherwise too tight to read the Source line as
 * clearly separate from the ability's actual effect text — an hr renders as
 * its own block with real margin, which nothing in the YAML data alone
 * (e.g. blank lines inside the effect string) reliably achieves.
 */
function sourceEffects(displaySource: string): Record<string, unknown>[] {
	// displaySource is built elsewhere as "<Prefix>: <Name>" (e.g. "Kit:
	// Rapid Fire") for grouping purposes — swap that for an em dash here
	// purely for display, per the requested "Class — Tactician" style.
	const formatted = displaySource.replace(": ", " — ");
	return [{ effect: "---" }, { name: "Source", effect: `*${formatted}*` }];
}

function abilityToFeatureBlock(
	ability: DsAbility,
	resourceName: string | undefined,
	characteristics: Record<string, number>,
	displaySource: string
): Record<string, unknown> {
	const { cost, ability_type } = costDisplay(ability, resourceName);
	return {
		type: "feature",
		feature_type: "ability",
		name: ability.name,
		ability_type,
		cost,
		flavor: ability.description?.trim() || undefined,
		keywords: ability.keywords?.length ? ability.keywords : undefined,
		usage: ability.type.usage,
		distance: formatDistance(ability.distance),
		target: ability.target || undefined,
		trigger: ability.type.trigger || undefined,
		effects: [...mapSections(ability.sections, characteristics), ...sourceEffects(displaySource)],
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

/**
 * The ds-skills element's `skills` field only accepts official skill names —
 * it errors on anything else. A skill a hero picked during character
 * creation that ISN'T in the official list (e.g. one the player typed in
 * themselves) has to go in `custom_skills` instead, with its own name/group.
 */
function buildSkillsYaml(skillNames: string[]): Record<string, unknown> {
	const official: string[] = [];
	const custom: { name: string; has_skill: true; skill_group?: string }[] = [];

	skillNames.forEach((name) => {
		const match = findOfficialSkill(name);
		if (match) {
			official.push(match.name);
		} else {
			custom.push({ name, has_skill: true, skill_group: findKnownUnsupportedSkillGroup(name) });
		}
	});

	return {
		skills: official.length ? official : undefined,
		custom_skills: custom.length ? custom : undefined,
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
			return dsBlock("ds-feature", abilityToFeatureBlock(feature.ability, resourceName, characteristics, feature.displaySource));
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
 * Action-type buckets Class Feature abilities are organized under, in this
 * fixed order. Each is an H3 — Obsidian folds any heading by default, so
 * these are collapsible without any extra callout syntax. A bucket with no
 * matching abilities on a given hero is dropped entirely (see
 * renderClassFeaturesGroup) rather than rendered empty.
 *
 * "Move" here covers the rulebook's Move action type (e.g. the null's
 * level-5 ability Phase Leap, confirmed via drawsteel-assistant — no example
 * of this usage exists in the Hellic test fixture) — matched loosely as
 * "Move"/"Movement" since ForgeSteel data isn't necessarily consistent about
 * which spelling it exports, even though the heading itself reads "Move
 * Action" to match the style of the other three.
 */
const ABILITY_USAGE_GROUPS: { title: string; match: (usage: string) => boolean }[] = [
	{ title: "Main Action", match: (u) => /main action/i.test(u) },
	{ title: "Maneuver", match: (u) => /maneuver/i.test(u) },
	{ title: "Move Action", match: (u) => /^move(ment)?( action)?$/i.test(u.trim()) },
	{ title: "Triggered Action", match: (u) => /triggered action/i.test(u) },
];

/**
 * Orders abilities within one action-type bucket: Signature Abilities first,
 * then zero-cost abilities (e.g. Barerhit's "Strike Now!", which costs
 * nothing — distinct from a signature ability), then everything else by
 * ascending Heroic Resource cost (a 3-cost ability before a 7-cost one),
 * whatever that class's Heroic Resource happens to be named (Focus, Wrath,
 * etc. — cost is a plain number on DsAbility, unrelated to the resource's
 * display name). A non-numeric, non-"signature" cost (unseen in practice)
 * sorts to the end of its tier rather than crashing the sort.
 */
function abilitySortKey(f: Extract<FlatFeature, { kind: "ability" }>): [number, number] {
	const cost = f.ability.cost;
	if (cost === "signature") return [0, 0];
	if (typeof cost === "number" && cost <= 0) return [1, 0];
	const numericCost = typeof cost === "number" ? cost : Number(cost);
	return [2, Number.isFinite(numericCost) ? numericCost : Infinity];
}

/**
 * Renders the Actions group (the class's own abilities plus any migrated in
 * from a Kit/Domain/Complication — see migrateGrantedAbilitiesToActions):
 * trait features are pulled out to the Note's own "## Traits" section (see
 * extractActionsTraits) before this runs, so only Ability features (split out
 * under H3 action-type headings — Main Action / Maneuver / Move Action /
 * Triggered Action, plus an "Other" catch-all for any usage string that
 * doesn't match one of those, each ordered by abilitySortKey) and any other
 * non-ability, non-trait feature (e.g. an immunity line) land here.
 */
function renderActionsGroup(items: FlatFeature[], resourceName: string | undefined, characteristics: Record<string, number>): string {
	const abilities = items.filter((f): f is Extract<FlatFeature, { kind: "ability" }> => f.kind === "ability");
	const others = items.filter((f) => f.kind !== "ability");

	const parts: string[] = others.map((f) => renderFeature(f, resourceName, characteristics));

	const buckets = ABILITY_USAGE_GROUPS.map((g) => ({ title: g.title, items: [] as typeof abilities }));
	const otherAbilities: typeof abilities = [];
	abilities.forEach((f) => {
		const bucket = ABILITY_USAGE_GROUPS.find((g) => g.match(f.ability.type.usage));
		if (bucket) {
			buckets.find((b) => b.title === bucket.title)!.items.push(f);
		} else {
			otherAbilities.push(f);
		}
	});
	if (otherAbilities.length) buckets.push({ title: "Other", items: otherAbilities });

	buckets.forEach((b) => b.items.sort((a, c) => {
		const [aTier, aValue] = abilitySortKey(a);
		const [cTier, cValue] = abilitySortKey(c);
		return aTier - cTier || aValue - cValue;
	}));

	buckets
		.filter((b) => b.items.length > 0)
		.forEach((b) => {
			parts.push(`### ${b.title}\n\n${b.items.map((f) => renderFeature(f, resourceName, characteristics)).join("\n\n")}`);
		});

	return parts.join("\n\n");
}

/**
 * Culture, Career, the hero's subclass pick (e.g. a Censor's Order), Domain,
 * and Kit often carry no ability/feature of their own to hang a ds-feature
 * block on, so without this they'd be invisible in the Note despite being
 * real, chosen parts of the build. Rendered as a single collapsed Obsidian
 * callout (`- ` right after the callout type folds it closed by default) so
 * this stays available without adding to the Note's default scroll depth —
 * a plain heading would be foldable too, but only after the reader folds it
 * themselves each time the Note is regenerated.
 *
 * `links` (see compendium-links.ts) supplies whichever DS Compendium
 * wikilinks could be resolved against the vault's actual notes — a field
 * renders as plain text when there's nothing to link it to.
 */
function buildBackgroundCallout(hero: DsHero, flat: FlattenResult, links: BackgroundLinks | undefined): string | undefined {
	const lines: string[] = [];

	if (hero.culture) {
		lines.push(`**Culture:** ${hero.culture.name}${hero.culture.type ? ` (${hero.culture.type})` : ""}`);
	}
	if (hero.career) {
		lines.push(`**Career:** ${links?.career ?? hero.career.name}`);
	}
	const subclassLabel = hero.class?.subclassName;
	const selectedSubclasses = hero.class?.subclasses?.filter((s) => s.selected).map((s) => s.name) ?? [];
	if (subclassLabel && selectedSubclasses.length) {
		lines.push(`**${links?.subclassLabel ?? subclassLabel}:** ${selectedSubclasses.join(", ")}`);
	}
	if (flat.domains.length) {
		lines.push(`**${links?.domainLabel ?? "Domain"}:** ${flat.domains.map((d) => d.name).join(", ")}`);
	}
	if (flat.kits.length) {
		const kitText = flat.kits.map((kit, i) => links?.kits[i] ?? kit.name).join(", ");
		lines.push(`**Kit:** ${kitText}`);
	}

	if (!lines.length) return undefined;

	return ["> [!info]- Background", ...lines.map((l) => `> - ${l}`)].join("\n");
}

export function buildHeroNote(hero: DsHero, stats: HeroStats, flat: FlattenResult, links?: BackgroundLinks): string {
	const resourceFeature = flat.features.find((f): f is Extract<FlatFeature, { kind: "resource" }> => f.kind === "resource");

	// Frontmatter is Director-facing reference data meant to populate a Base/
	// Dataview view across every PC — not a mirror of the whole Note. Culture
	// and Career stay body-only (not useful to filter/sort a Director's PC
	// list on). Of the numeric stats, only ones that don't fluctuate mid-
	// encounter are included (e.g. Victories/XP, not Surges/the Heroic
	// Resource's current value, which reset/change constantly in play).
	const frontmatter = yaml
		.dump(
			stripUndefined({
				ds_hero: true,
				name: hero.name,
				ancestry: hero.ancestry?.name,
				class: hero.class?.name,
				level: stats.level,
				might: stats.characteristics["Might"] ?? 0,
				agility: stats.characteristics["Agility"] ?? 0,
				reason: stats.characteristics["Reason"] ?? 0,
				intuition: stats.characteristics["Intuition"] ?? 0,
				presence: stats.characteristics["Presence"] ?? 0,
				victories: hero.state.victories ?? 0,
				xp: hero.state.xp ?? 0,
				max_stamina: stats.stamina,
				speed: stats.speed,
			})
		)
		.trimEnd();

	const characteristicsBlock = dsBlock("ds-characteristics", {
		might: stats.characteristics["Might"] ?? 0,
		agility: stats.characteristics["Agility"] ?? 0,
		reason: stats.characteristics["Reason"] ?? 0,
		intuition: stats.characteristics["Intuition"] ?? 0,
		presence: stats.characteristics["Presence"] ?? 0,
	});

	// current_stamina/temp_stamina reflect the hero's actual condition at
	// export time (state.staminaDamage/staminaTemp), not always a full bar —
	// a fresh import with no damage taken naturally comes out equal to max.
	const vitalsBlock = dsBlock("ds-stamina", {
		collapsible: true,
		collapse_default: false,
		max_stamina: stats.stamina,
		current_stamina: stats.stamina - (hero.state.staminaDamage ?? 0),
		temp_stamina: hero.state.staminaTemp ?? 0,
		height: 1,
		style: "default",
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

	// Grouped 3-per-row (rather than left to wrap naturally at whatever width
	// the note pane happens to be) so the row always reads Heroic
	// Resource/Surges/Victories, then XP/Renown/Wealth. Each row needs its own
	// dedicated parent to CSS-grid against — the counters otherwise share no
	// container but the whole Note body, so styles.css can't grid-lay them out
	// 3-wide without this wrapper; see the ds-counter section there.
	const RESOURCE_ROW_SIZE = 3;
	const resourceRows: [string, number][][] = [];
	for (let i = 0; i < resourceEntries.length; i += RESOURCE_ROW_SIZE) {
		resourceRows.push(resourceEntries.slice(i, i + RESOURCE_ROW_SIZE));
	}
	const resourcesBlock = resourceRows
		.map((row) => {
			const counters = row.map(([name, value]) => dsBlock("ds-counter", { name, current_value: value, min_value: 0 })).join("\n\n");
			return `<div class="dshi-resource-row">\n\n${counters}\n\n</div>`;
		})
		.join("\n\n");

	const statisticsBlock = dsBlock("ds-values-row", {
		values: [
			{ Speed: stats.speed },
			{ Stability: stats.stability },
			{ Disengage: stats.disengage },
			{ "Free Strike": stats.freeStrike },
			{ Size: stats.size },
		],
	});

	const skillsBlock = flat.skills.length ? dsBlock("ds-skills", buildSkillsYaml(flat.skills)) : undefined;

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
			? renderActionsGroup(g.items, resourceFeature?.name, stats.characteristics)
			: g.items.map((f) => renderFeature(f, resourceFeature?.name, stats.characteristics)).join("\n\n");

	const featureSections = mainGroups.map((g) => `## ${g.title}\n\n${renderGroupBody(g)}`);

	const traitsSection = traitItems.length
		? `## Traits\n\n${traitItems.map((f) => renderFeature(f, resourceFeature?.name, stats.characteristics)).join("\n\n")}`
		: undefined;

	const backgroundInfoSection = backgroundInfoGroups.length
		? `## Background Info\n\n${backgroundInfoGroups.map((g) => `### ${g.title}\n\n${renderGroupBody(g)}`).join("\n\n")}`
		: undefined;

	const detailsParts: string[] = [];
	if (flat.languages.length) {
		detailsParts.push(`### Languages\n\n${flat.languages.map((l) => `- ${l}`).join("\n")}`);
	}
	if (resourceFeature) {
		detailsParts.push(`### Heroic Resource\n\n${renderFeature(resourceFeature, undefined, stats.characteristics, "####")}`);
	}
	const detailsSection = detailsParts.length ? `## Details\n\n${detailsParts.join("\n\n")}` : undefined;

	const notesSection = hero.state.notes ? `## Notes\n\n${hero.state.notes}` : undefined;

	const backgroundCallout = buildBackgroundCallout(hero, flat, links);

	const sections = [
		`---\n${frontmatter}\n---`,
		`# ${hero.name}`,
		`*Level ${stats.level} ${hero.ancestry?.name ?? ""} ${hero.class?.name ?? ""}*`.trim(),
		backgroundCallout,
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
		// A section for a top-level ## heading (Background Info's nested ###
		// groups included — the <hr> marks the end of the whole section, not
		// each subgroup within it) gets a trailing divider so the Note reads as
		// clearly separated blocks; the title/subtitle/Background callout above
		// Characteristics aren't headed sections themselves, so they're left alone.
		.map((s) => (s.startsWith("## ") ? `${s}\n\n<hr>` : s));

	return sections.join("\n\n");
}
