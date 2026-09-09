import { DsAbility, DsBonusData, DsFeature, DsHero, DsHeroClass, DsKit } from "./ds-hero-types";

export type FlatFeature =
	| { kind: "text"; source: string; name: string; description: string }
	| { kind: "ability"; source: string; ability: DsAbility }
	| {
			kind: "resource";
			source: string;
			name: string;
			details: string;
			gains: { trigger: string; value: string; frequency: string }[];
	  }
	| { kind: "immunity"; source: string; name: string; conditions: string[] };

export interface FlattenResult {
	features: FlatFeature[];
	bonuses: DsBonusData[];
	skills: string[];
	languages: string[];
	kits: DsKit[];
}

/**
 * Walks every feature tree on a hero (ancestry/culture/career/class/complication/
 * custom) and resolves "container" feature types (Choice, Multiple Features,
 * Domain, Class Ability, Perk, Kit, Domain Feature) down to a flat list of
 * displayable features, plus the raw stat Bonuses and skill/language picks
 * that HeroStats consumes separately.
 *
 * Only features actually granted at or below `heroLevel`, and only the
 * hero's *selected* choices, are included — nothing the hero could have
 * picked but didn't.
 */
export function flattenHeroFeatures(hero: DsHero, heroLevel: number): FlattenResult {
	const result: FlattenResult = {
		features: [],
		bonuses: [],
		skills: [],
		languages: [],
		kits: [],
	};

	// A single underlying feature (e.g. a domain's level-1 feature) can be reachable
	// through more than one path in the tree — a "Domain" feature's own
	// featuresByLevel, and a separate "Domain Feature" choice that re-selects the
	// same thing. Guard on id so it only gets displayed once.
	const visitedIds = new Set<string>();

	const visit = (feature: DsFeature, source: string, cls: DsHeroClass | null) => {
		if (!feature) return;
		if (feature.id) {
			if (visitedIds.has(feature.id)) return;
			visitedIds.add(feature.id);
		}
		const data = feature.data ?? {};

		switch (feature.type) {
			case "Bonus":
				result.bonuses.push(data as DsBonusData);
				return;

			case "Characteristic Bonus":
				// Already folded into class.characteristics by ForgeSteel.
				return;

			case "Skill Choice":
				(data.selected ?? []).forEach((s: string) => result.skills.push(s));
				return;

			case "Language Choice":
				(data.selected ?? []).forEach((s: string) => result.languages.push(s));
				return;

			case "Text":
				if (feature.description) {
					result.features.push({
						kind: "text",
						source,
						name: feature.name,
						description: feature.description,
					});
				}
				return;

			case "Ability":
				if (data.ability) {
					result.features.push({ kind: "ability", source, ability: data.ability as DsAbility });
				}
				return;

			case "Heroic Resource":
				result.features.push({
					kind: "resource",
					source,
					name: feature.name,
					details: data.details ?? "",
					gains: data.gains ?? [],
				});
				return;

			case "Heroic Resource Gain":
				// Modifies an existing resource's gain rate; not surfaced as its own block in v1.
				return;

			case "Condition Immunity":
				result.features.push({
					kind: "immunity",
					source,
					name: feature.name,
					conditions: data.conditions ?? [],
				});
				return;

			case "Multiple Features":
				(data.features ?? []).forEach((f: DsFeature) => visit(f, source, cls));
				return;

			case "Choice":
			case "Perk":
			case "Domain Feature":
				(data.selected ?? []).forEach((f: DsFeature) => visit(f, source, cls));
				return;

			case "Kit":
				(data.selected ?? []).forEach((kit: DsKit) => {
					result.kits.push(kit);
					(kit.features ?? []).forEach((f: DsFeature) => visit(f, `Kit: ${kit.name}`, cls));
				});
				return;

			case "Domain":
				(data.selected ?? []).forEach((domain: { name: string; featuresByLevel: { level: number; features: DsFeature[] }[] }) => {
					domain.featuresByLevel
						.filter((fl) => fl.level <= heroLevel)
						.forEach((fl) => fl.features.forEach((f) => visit(f, `Domain: ${domain.name}`, cls)));
				});
				return;

			case "Class Ability": {
				const ids: string[] = data.selectedIDs ?? [];
				ids.forEach((id) => {
					const ability = cls?.abilities.find((a) => a.id === id);
					if (ability) {
						result.features.push({ kind: "ability", source, ability });
					}
				});
				return;
			}

			case "Package Content":
				// References a shared ability package from the sourcebook compendium,
				// not present in the .ds-hero export — skipped in v1.
				return;

			default:
				if (feature.description) {
					result.features.push({
						kind: "text",
						source,
						name: feature.name,
						description: feature.description,
					});
				}
				return;
		}
	};

	if (hero.ancestry) {
		hero.ancestry.features.forEach((f) => visit(f, `Ancestry: ${hero.ancestry!.name}`, hero.class));
	}

	if (hero.culture) {
		const cultureSource = `Culture: ${hero.culture.name}`;
		[hero.culture.language, hero.culture.environment, hero.culture.organization, hero.culture.upbringing]
			.filter(Boolean)
			.forEach((f) => visit(f, cultureSource, hero.class));
	}

	if (hero.career) {
		hero.career.features.forEach((f) => visit(f, `Career: ${hero.career!.name}`, hero.class));
	}

	if (hero.class) {
		hero.class.featuresByLevel
			.filter((fl) => fl.level <= heroLevel)
			.forEach((fl) => fl.features.forEach((f) => visit(f, `Class: ${hero.class!.name}`, hero.class)));
	}

	if (hero.complication) {
		hero.complication.features.forEach((f) => visit(f, `Complication: ${hero.complication!.name}`, hero.class));
	}

	hero.features.forEach((f) => visit(f, "Custom", hero.class));

	result.skills = Array.from(new Set(result.skills));
	result.languages = Array.from(new Set(result.languages));

	return result;
}
