import * as yaml from "js-yaml";
import { dsBlock, stripUndefined } from "./note-block-helpers";
import { findKnownUnsupportedSkillGroup, findOfficialSkill } from "./skill-data";

/**
 * Shared, hero-shape-agnostic Note-section renderers — used by both
 * markdown-builder.ts (.ds-hero import) and pdf-note-builder.ts (PDF
 * import). Each builder maps its own rich data (DsHero+HeroStats+
 * FlattenResult, or PdfHeroData+ResolvedPdfCompendiumData) into the plain
 * inputs these functions take, so the two import paths render identical
 * output for anything both can produce — see the "shared rendering layer"
 * plan. Nothing here knows about DsHero or PdfHeroData specifically.
 */

export interface NoteCharacteristics {
	Might: number;
	Agility: number;
	Reason: number;
	Intuition: number;
	Presence: number;
}

/** Frontmatter is Director-facing reference data meant to populate a Base/Dataview view across every PC — not a mirror of the whole Note. Culture and Career stay body-only (not useful to filter/sort a Director's PC list on). Of the numeric stats, only ones that don't fluctuate mid-encounter are included (e.g. Victories/XP, not Surges/the Heroic Resource's current value, which reset/change constantly in play). */
export function buildFrontmatter(input: {
	name: string;
	ancestryName?: string;
	className?: string;
	level: number;
	characteristics: NoteCharacteristics;
	victories: number;
	xp: number;
	maxStamina: number;
	speed: number;
}): string {
	return yaml
		.dump(
			stripUndefined({
				ds_hero: true,
				name: input.name,
				ancestry: input.ancestryName,
				class: input.className,
				level: input.level,
				might: input.characteristics.Might,
				agility: input.characteristics.Agility,
				reason: input.characteristics.Reason,
				intuition: input.characteristics.Intuition,
				presence: input.characteristics.Presence,
				victories: input.victories,
				xp: input.xp,
				max_stamina: input.maxStamina,
				speed: input.speed,
			})
		)
		.trimEnd();
}

export function buildCharacteristicsBlock(characteristics: NoteCharacteristics): string {
	return dsBlock("ds-characteristics", {
		might: characteristics.Might,
		agility: characteristics.Agility,
		reason: characteristics.Reason,
		intuition: characteristics.Intuition,
		presence: characteristics.Presence,
	});
}

export function buildVitalsBlock(input: { maxStamina: number; currentStamina: number; tempStamina: number }): string {
	return dsBlock("ds-stamina", {
		collapsible: true,
		collapse_default: false,
		max_stamina: input.maxStamina,
		current_stamina: input.currentStamina,
		temp_stamina: input.tempStamina,
		height: 1,
		style: "default",
	});
}

/**
 * Grouped 3-per-row (rather than left to wrap naturally at whatever width
 * the note pane happens to be) so a row of counters reads as a coherent set
 * (e.g. Heroic Resource/Surges/Victories, then XP/Renown/Wealth). Each row
 * needs its own dedicated parent to CSS-grid against — the counters
 * otherwise share no container but the whole Note body, so styles.css can't
 * grid-lay them out 3-wide without this wrapper; see the ds-counter section
 * there.
 */
const RESOURCE_ROW_SIZE = 3;

export function buildResourcesBlock(entries: [string, number][]): string {
	const rows: [string, number][][] = [];
	for (let i = 0; i < entries.length; i += RESOURCE_ROW_SIZE) {
		rows.push(entries.slice(i, i + RESOURCE_ROW_SIZE));
	}
	return rows
		.map((row) => {
			const counters = row.map(([name, value]) => dsBlock("ds-counter", { name, current_value: value, min_value: 0 })).join("\n\n");
			return `<div class="dshi-resource-row">\n\n${counters}\n\n</div>`;
		})
		.join("\n\n");
}

export function buildStatisticsBlock(input: { speed: number; stability: number; disengage: number; freeStrike: number; size: string }): string {
	return dsBlock("ds-values-row", {
		values: [
			{ Speed: input.speed },
			{ Stability: input.stability },
			{ Disengage: input.disengage },
			{ "Free Strike": input.freeStrike },
			{ Size: input.size },
		],
	});
}

export interface NoteAbility {
	name: string;
	isSignature: boolean;
	/** Numeric cost in the hero's Heroic Resource, or undefined for free/signature. Kept numeric (not pre-formatted) so sorting stays a pure comparison. */
	cost?: number;
	/** Resource display name for cost formatting (e.g. "Wrath") — undefined renders a bare number. */
	resourceName?: string;
	keywords?: string[];
	flavor?: string;
	/** Normalized display string, e.g. "Main Action" — each source normalizes its own vocabulary into this shape before bucketing (see bucketAndSortAbilities). */
	usage: string;
	distance?: string;
	target?: string;
	trigger?: string;
	/** Already-resolved ds-feature `effects` entries (roll/tier1-3, or plain effect text) — ForgeSteel's mapper runs resolveTierText before constructing these; PDF's mapper passes its already-resolved text straight through. */
	effects: Record<string, unknown>[];
	/** "<Prefix>: <Name>" — used only for the trailing Source effect line (see sourceEffects), never for grouping. */
	displaySource: string;
}

/**
 * Appended as the last two `effects` entries on every ds-feature block, so
 * that once Abilities/Traits from many sources (Class, Subclass, Ancestry,
 * Kit, etc.) are merged together under one heading, each block still says
 * where it came from — rendered as e.g. "**Source:** *Kit — Rapid Fire*".
 * ds-feature has no dedicated "source" field, and its `metadata` property
 * isn't rendered by the draw-steel-elements plugin at all (it only
 * reproduces the object as frontmatter when a block is exported to its own
 * note), so it can't be used for this — an effect entry (the "Source" name
 * still gets the plugin's normal bold-key treatment, same as "Trigger:" or a
 * "Spend" cost) is the only field that actually renders.
 *
 * A leading "---" divider entry is included because the plugin's own
 * effect-to-effect spacing is otherwise too tight to read the Source line as
 * clearly separate from the ability's actual effect text — an hr renders as
 * its own block with real margin, which nothing in the YAML data alone
 * (e.g. blank lines inside the effect string) reliably achieves.
 */
export function sourceEffects(displaySource: string): Record<string, unknown>[] {
	// displaySource is built elsewhere as "<Prefix>: <Name>" (e.g. "Kit:
	// Rapid Fire") for grouping purposes — swap that for an em dash here
	// purely for display, per the requested "Class — Tactician" style.
	const formatted = displaySource.replace(": ", " — ");
	return [{ effect: "---" }, { name: "Source", effect: `*${formatted}*` }];
}

export function abilityToFeatureBlock(ability: NoteAbility): Record<string, unknown> {
	const cost = !ability.isSignature && ability.cost ? (ability.resourceName ? `${ability.cost} ${ability.resourceName}` : String(ability.cost)) : undefined;
	return {
		type: "feature",
		feature_type: "ability",
		name: ability.name,
		ability_type: ability.isSignature ? "Signature Ability" : undefined,
		cost,
		flavor: ability.flavor || undefined,
		keywords: ability.keywords?.length ? ability.keywords : undefined,
		usage: ability.usage,
		distance: ability.distance,
		target: ability.target,
		trigger: ability.trigger,
		effects: [...ability.effects, ...sourceEffects(ability.displaySource)],
	};
}

/**
 * Action-type buckets abilities are organized under, in this fixed order.
 * Each is an H3 — Obsidian folds any heading by default, so these are
 * collapsible without any extra callout syntax. A bucket with no matching
 * abilities on a given hero is dropped entirely rather than rendered empty.
 * Matched against each ability's already-normalized `usage` string (see
 * NoteAbility) — each source is responsible for normalizing its own raw
 * usage vocabulary into strings these patterns match (e.g. ForgeSteel's
 * "Main Action" already matches; PDF's "Main" must be normalized to "Main
 * Action" by its own mapper first).
 */
export const ABILITY_USAGE_GROUPS: { title: string; match: (usage: string) => boolean }[] = [
	{ title: "Main Action", match: (u) => /main action/i.test(u) },
	{ title: "Maneuver", match: (u) => /maneuver/i.test(u) },
	{ title: "Move Action", match: (u) => /^move(ment)?( action)?$/i.test(u.trim()) },
	{ title: "Triggered Action", match: (u) => /triggered action/i.test(u) },
];

/**
 * Orders abilities within one action-type bucket: Signature Abilities first,
 * then zero-cost abilities (distinct from a signature ability), then
 * everything else by ascending Heroic Resource cost. A non-numeric,
 * non-signature cost (unseen in practice) sorts to the end of its tier
 * rather than crashing the sort.
 */
export function noteAbilitySortKey(a: NoteAbility): [number, number] {
	if (a.isSignature) return [0, 0];
	if (!a.cost) return [1, 0];
	return [2, Number.isFinite(a.cost) ? a.cost : Infinity];
}

/**
 * Buckets abilities into ABILITY_USAGE_GROUPS (plus an "Other" catch-all for
 * anything that matches none of them), each sorted by noteAbilitySortKey,
 * rendered as ds-feature blocks under H3 headings — dropping any bucket
 * with nothing in it. `otherRendered` is prepended as-is (already-rendered
 * markdown strings) for any non-ability item that belongs in the same
 * section (e.g. ForgeSteel's Actions group can also carry a resource/
 * immunity line) — PDF has no such items today and passes an empty array.
 */
export function renderActionsGroup(abilities: NoteAbility[], otherRendered: string[] = []): string {
	const buckets = ABILITY_USAGE_GROUPS.map((g) => ({ title: g.title, items: [] as NoteAbility[] }));
	const other: NoteAbility[] = [];

	abilities.forEach((a) => {
		const bucket = ABILITY_USAGE_GROUPS.find((g) => g.match(a.usage));
		if (bucket) buckets.find((b) => b.title === bucket.title)!.items.push(a);
		else other.push(a);
	});
	if (other.length) buckets.push({ title: "Other", items: other });

	buckets.forEach((b) => b.items.sort((x, y) => {
		const [xTier, xValue] = noteAbilitySortKey(x);
		const [yTier, yValue] = noteAbilitySortKey(y);
		return xTier - yTier || xValue - yValue;
	}));

	const parts = [...otherRendered];
	buckets
		.filter((b) => b.items.length > 0)
		.forEach((b) => {
			parts.push(`### ${b.title}\n\n${b.items.map((a) => dsBlock("ds-feature", abilityToFeatureBlock(a))).join("\n\n")}`);
		});

	return parts.join("\n\n");
}

/**
 * Renders the "> [!info]- Background" callout wrapper + bullet formatting —
 * shared between both import paths. Which lines exist and in what order is
 * each caller's own concern (ForgeSteel includes Subclass/Domain lines that
 * have no PDF equivalent); this only renders whatever ordered label/value
 * pairs it's given. Returns undefined for an empty list, so a caller need
 * not guard for "no lines at all" itself.
 */
export function buildBackgroundCallout(lines: { label: string; value: string }[]): string | undefined {
	if (!lines.length) return undefined;
	return ["> [!info]- Background", ...lines.map((l) => `> - **${l.label}:** ${l.value}`)].join("\n");
}

/**
 * The ds-skills element's `skills` field only accepts official skill names —
 * it errors on anything else. A skill a hero picked that ISN'T in the
 * official list (e.g. one a player typed in themselves) has to go in
 * `custom_skills` instead, with its own name/group. Returns undefined for an
 * empty list, so both call sites can drop their own length-check guard.
 */
export function buildSkillsBlock(skillNames: string[]): string | undefined {
	if (!skillNames.length) return undefined;

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

	return dsBlock("ds-skills", {
		skills: official.length ? official : undefined,
		custom_skills: custom.length ? custom : undefined,
	});
}
