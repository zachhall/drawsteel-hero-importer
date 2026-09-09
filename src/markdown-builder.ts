import * as yaml from "js-yaml";
import { DsAbility, DsAbilityDistance, DsAbilitySection, DsHero } from "./ds-hero-types";
import { FlatFeature, FlattenResult } from "./feature-flatten";
import { HeroStats } from "./hero-stats";
import { findKnownUnsupportedSkillGroup, findOfficialSkill } from "./skill-data";

const FENCE = "~~~";

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

function mapSections(sections: DsAbilitySection[]): Record<string, unknown>[] {
	const mapped: (Record<string, unknown> | undefined)[] = sections.map((s) => {
		if (s.type === "roll" && s.roll) {
			const characteristic = s.roll.characteristic.join("/");
			const bonus = s.roll.bonus ? ` + ${s.roll.bonus}` : "";
			return {
				roll: `Power Roll + ${characteristic}${bonus}`,
				tier1: s.roll.tier1,
				tier2: s.roll.tier2,
				tier3: s.roll.tier3,
			};
		}
		if (s.type === "text" && s.text) {
			return { effect: s.text };
		}
		if (s.type === "field") {
			return {
				name: s.name,
				cost: s.value !== undefined ? String(s.value) : undefined,
				effect: s.effect,
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

function abilityToFeatureBlock(ability: DsAbility, resourceName: string | undefined): Record<string, unknown> {
	const { cost, ability_type } = costDisplay(ability, resourceName);
	return {
		type: "feature",
		feature_type: "ability",
		name: ability.name,
		ability_type,
		cost,
		flavor: ability.description || undefined,
		keywords: ability.keywords?.length ? ability.keywords : undefined,
		usage: ability.type.usage,
		distance: formatDistance(ability.distance),
		target: ability.target || undefined,
		trigger: ability.type.trigger || undefined,
		effects: mapSections(ability.sections),
	};
}

function textToFeatureBlock(name: string, description: string): Record<string, unknown> {
	return {
		type: "feature",
		feature_type: "trait",
		name,
		effects: [{ effect: description }],
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
	{ title: "Class Features", prefix: "Class:" },
	{ title: "Kit", prefix: "Kit:" },
	{ title: "Domain", prefix: "Domain:" },
	{ title: "Complication", prefix: "Complication:" },
];

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

function renderFeature(feature: FlatFeature, resourceName: string | undefined): string {
	switch (feature.kind) {
		case "ability":
			return dsBlock("ds-feature", abilityToFeatureBlock(feature.ability, resourceName));
		case "text":
			return dsBlock("ds-feature", textToFeatureBlock(feature.name, feature.description));
		case "resource": {
			const lines = [`### ${feature.name}`];
			if (feature.details) lines.push(feature.details);
			feature.gains.forEach((g) => lines.push(`- **${g.trigger}**: +${g.value} (${g.frequency})`));
			return lines.join("\n");
		}
		case "immunity":
			return `- **${feature.name}**: Immunity to ${feature.conditions.join(", ")}`;
	}
}

export function buildHeroNote(hero: DsHero, stats: HeroStats, flat: FlattenResult): string {
	const resourceFeature = flat.features.find((f): f is Extract<FlatFeature, { kind: "resource" }> => f.kind === "resource");

	const frontmatter = yaml
		.dump(
			stripUndefined({
				ds_hero: true,
				name: hero.name,
				ancestry: hero.ancestry?.name,
				culture: hero.culture?.name,
				career: hero.career?.name,
				class: hero.class?.name,
				level: stats.level,
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

	const combatValues = [
		{ Level: stats.level },
		{ Stamina: stats.stamina },
		{ Recoveries: stats.recoveries },
		{ "Recovery Value": stats.recoveryValue },
		{ Speed: stats.speed },
		{ Stability: stats.stability },
		{ Disengage: stats.disengage },
		{ "Free Strike": stats.freeStrike },
		{ Size: stats.size },
		...stats.otherBonuses.map((b) => ({ [b.field]: b.value })),
	];
	const combatStatsBlock = dsBlock("ds-values-row", { values: combatValues });

	const skillsBlock = flat.skills.length ? dsBlock("ds-skills", buildSkillsYaml(flat.skills)) : undefined;

	const languagesSection = flat.languages.length ? `## Languages\n\n${flat.languages.map((l) => `- ${l}`).join("\n")}` : undefined;

	const featureGroups = groupFeatures(flat.features.filter((f) => f.kind !== "resource"));
	const featureSections = featureGroups.map((g) => `## ${g.title}\n\n${g.items.map((f) => renderFeature(f, resourceFeature?.name)).join("\n\n")}`);

	const resourceSection = resourceFeature ? `## Heroic Resource\n\n${renderFeature(resourceFeature, undefined)}` : undefined;

	const notesSection = hero.state.notes ? `## Notes\n\n${hero.state.notes}` : undefined;

	const sections = [
		`---\n${frontmatter}\n---`,
		`# ${hero.name}`,
		`*Level ${stats.level} ${hero.ancestry?.name ?? ""} ${hero.class?.name ?? ""}*`.trim(),
		`## Characteristics\n\n${characteristicsBlock}`,
		`## Combat Stats\n\n${combatStatsBlock}`,
		skillsBlock ? `## Skills\n\n${skillsBlock}` : undefined,
		languagesSection,
		resourceSection,
		...featureSections,
		notesSection,
	].filter((s): s is string => !!s);

	return sections.join("\n\n");
}
