import {
	DsAbility,
	DsAbilityFeatureData,
	DsBonusData,
	DsChoiceSelectionData,
	DsCharacteristicBonusData,
	DsClassAbilityData,
	DsConditionImmunityData,
	DsDomain,
	DsDomainSelectionData,
	DsFeature,
	DsHero,
	DsHeroClass,
	DsHeroicResourceData,
	DsKit,
	DsKitData,
	DsLanguageChoiceData,
	DsMultipleFeaturesData,
	DsSkillChoiceData,
} from "./ds-hero-types";

export type FlatFeature =
	| { kind: "text"; source: string; displaySource: string; name: string; description: string }
	| { kind: "ability"; source: string; displaySource: string; ability: DsAbility }
	| {
			kind: "resource";
			source: string;
			displaySource: string;
			name: string;
			details: string;
			/** The hero's current banked amount of this resource (e.g. Wrath currently at 0), read directly from the hero's state — not derived. */
			currentValue: number;
			gains: { trigger: string; value: string; frequency: string }[];
	  }
	| { kind: "immunity"; source: string; displaySource: string; name: string; conditions: string[] };

export interface FlattenResult {
	features: FlatFeature[];
	bonuses: DsBonusData[];
	/** Per-characteristic totals from "Characteristic Bonus" features granted at or below the hero's level, keyed by characteristic name (e.g. "Might"). Not folded into class.characteristics by ForgeSteel — see computeHeroStats. */
	characteristicBonuses: Record<string, number>;
	skills: string[];
	languages: string[];
	kits: DsKit[];
	domains: DsDomain[];
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
		characteristicBonuses: {},
		skills: [],
		languages: [],
		kits: [],
		domains: [],
	};

	// A single underlying feature (e.g. a domain's level-1 feature) can be reachable
	// through more than one path in the tree — a "Domain" feature's own
	// featuresByLevel, and a separate "Domain Feature" choice that re-selects the
	// same thing. Guard on id so it only gets displayed once.
	const visitedIds = new Set<string>();

	// `displaySource` normally matches `source` (both describe where a feature
	// came from), but they diverge for a subclass's own features: `source`
	// stays "Class: <ClassName>" so they still group under Actions/Traits
	// alongside the base class's features, while `displaySource` names the
	// actual doctrine/order/aspect (e.g. "Tactical Doctrine: Vanguard") so the
	// Source line on each block stays meaningful once everything is merged.
	const visit = (feature: DsFeature, source: string, cls: DsHeroClass | null, displaySource: string = source) => {
		if (!feature) return;
		if (feature.id) {
			if (visitedIds.has(feature.id)) return;
			visitedIds.add(feature.id);
		}
		// `feature.data`'s real shape depends entirely on `feature.type` (ForgeSteel
		// doesn't discriminate it in the export itself), so every branch below casts
		// through `unknown` to the shape that type actually carries.
		const data = feature.data ?? {};
		const dataAs = <T>() => data as unknown as T;

		switch (feature.type) {
			case "Bonus":
				result.bonuses.push(dataAs<DsBonusData>());
				return;

			case "Characteristic Bonus": {
				// Despite the name, ForgeSteel does NOT fold this into
				// class.characteristics — that array only ever holds the
				// hero's starting (level-1) scores. Each level-4/7/10
				// Characteristic Increase class feature is exported as one of
				// these per characteristic instead, so the running total has
				// to be reconstructed here; see computeHeroStats.
				const bonus = dataAs<DsCharacteristicBonusData>();
				result.characteristicBonuses[bonus.characteristic] = (result.characteristicBonuses[bonus.characteristic] ?? 0) + bonus.value;
				return;
			}

			case "Skill Choice":
				(dataAs<DsSkillChoiceData>().selected ?? []).forEach((s) => result.skills.push(s));
				return;

			case "Language Choice":
				(dataAs<DsLanguageChoiceData>().selected ?? []).forEach((s) => result.languages.push(s));
				return;

			case "Text":
				if (feature.description) {
					result.features.push({
						kind: "text",
						source,
						displaySource,
						name: feature.name,
						description: feature.description,
					});
				}
				return;

			case "Ability": {
				const ability = dataAs<DsAbilityFeatureData>().ability;
				if (ability) {
					result.features.push({ kind: "ability", source, displaySource, ability });
				}
				return;
			}

			case "Heroic Resource": {
				const resource = dataAs<DsHeroicResourceData>();
				result.features.push({
					kind: "resource",
					source,
					displaySource,
					name: feature.name,
					details: resource.details ?? "",
					currentValue: resource.value ?? 0,
					gains: resource.gains ?? [],
				});
				return;
			}

			case "Heroic Resource Gain":
				// Modifies an existing resource's gain rate; not surfaced as its own block in v1.
				return;

			case "Condition Immunity":
				result.features.push({
					kind: "immunity",
					source,
					displaySource,
					name: feature.name,
					conditions: dataAs<DsConditionImmunityData>().conditions ?? [],
				});
				return;

			case "Multiple Features":
				(dataAs<DsMultipleFeaturesData>().features ?? []).forEach((f) => visit(f, source, cls, displaySource));
				return;

			case "Choice":
			case "Perk":
			case "Domain Feature":
				(dataAs<DsChoiceSelectionData>().selected ?? []).forEach((f) => visit(f, source, cls, displaySource));
				return;

			case "Kit":
				(dataAs<DsKitData>().selected ?? []).forEach((kit: DsKit) => {
					result.kits.push(kit);
					(kit.features ?? []).forEach((f: DsFeature) => visit(f, `Kit: ${kit.name}`, cls));
				});
				return;

			case "Domain":
				(dataAs<DsDomainSelectionData>().selected ?? []).forEach((domain) => {
					result.domains.push(domain);
					domain.featuresByLevel
						.filter((fl) => fl.level <= heroLevel)
						.forEach((fl) => fl.features.forEach((f) => visit(f, `Domain: ${domain.name}`, cls)));
				});
				return;

			case "Class Ability": {
				const ids = dataAs<DsClassAbilityData>().selectedIDs ?? [];
				ids.forEach((id) => {
					const ability = cls?.abilities.find((a) => a.id === id);
					if (ability) {
						result.features.push({ kind: "ability", source, displaySource, ability });
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
						displaySource,
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

		// A hero's chosen subclass (e.g. a Tactician's Tactical Doctrine) has its
		// own featuresByLevel tree, separate from hero.class.featuresByLevel —
		// doctrine/order/domain-style features and any Characteristic Bonus they
		// grant only exist here, not duplicated into the main class tree.
		hero.class.subclasses
			.filter((s) => s.selected)
			.forEach((s) => {
				// A "Class Ability" feature resolves by id against `cls.abilities` (see
				// the "Class Ability" case below) — merge in the subclass's own
				// abilities so an id referencing a doctrine-only ability still resolves.
				const clsWithSubclassAbilities: DsHeroClass = { ...hero.class!, abilities: [...hero.class!.abilities, ...s.abilities] };
				const subclassDisplaySource = `${hero.class!.subclassName}: ${s.name}`;
				s.featuresByLevel
					.filter((fl) => fl.level <= heroLevel)
					.forEach((fl) =>
						fl.features.forEach((f) => visit(f, `Class: ${hero.class!.name}`, clsWithSubclassAbilities, subclassDisplaySource))
					);
			});
	}

	if (hero.complication) {
		hero.complication.features.forEach((f) => visit(f, `Complication: ${hero.complication!.name}`, hero.class));
	}

	hero.features.forEach((f) => visit(f, "Custom", hero.class));

	result.skills = Array.from(new Set(result.skills));
	result.languages = Array.from(new Set(result.languages));

	return result;
}
