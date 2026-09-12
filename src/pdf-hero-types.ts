/**
 * Flat, PDF-native hero shape — deliberately not forced into DsHero's rich
 * nested feature-tree shape (see ds-hero-types.ts), since a filled MCDM
 * character sheet PDF only ever carries flat named picks and a handful of
 * numbers, never ForgeSteel's underlying rules-tree structure. Everything
 * this doesn't carry (full ability text, kit stat bonuses, ancestry/career/
 * complication prose) is looked up separately from the DS Compendium vault
 * folder — see compendium-note-parser.ts and pdf-compendium-resolver.ts.
 *
 * Field selection here is deliberately scoped to what pdf-note-builder.ts
 * needs to render a note matching markdown-builder.ts's section layout
 * (Characteristics/Vitals/Resources/Statistics/Skills/Actions/Kit/Details/
 * Notes/Background Info).
 */
export interface PdfAbility {
	name: string;
	/** The ability's resource category, e.g. "Signature", "Heroic", "Free Strike" — read from the grid row's own type label. */
	type?: string;
	/** Action type, e.g. "Main", "Maneuver", "Triggered", "Free Triggered". */
	action?: string;
	cost?: string;
	target?: string;
	distance?: string;
	keywords?: string[];
	/** Full rules text, tiers included, exactly as filled on the sheet — already the hero's final resolved numbers, unlike ForgeSteel's "+ M" shorthand. */
	details?: string;
}

export interface PdfHeroData {
	name: string;
	level: number;
	ancestryName?: string;
	cultureEnvironmentName?: string;
	cultureOrganizationName?: string;
	cultureUpbringingName?: string;
	/** Free text, possibly multiple languages one per line — not resolved against the compendium like the other culture aspects. */
	cultureLanguageName?: string;
	careerName?: string;
	/** Flavor text, no compendium concept of its own — appended to the Career Background Info line rather than getting its own. */
	careerIncitingIncident?: string;
	/** The sheet's own free-text summary of what the Career grants (Skills/Language/Renown/Perk) — duplicates data this Note already renders elsewhere in structured form (Skills section, Languages, the Renown counter, and the Perk ability itself as a full ability card from the grid), but is kept as a plain reference blurb since it's what the sheet itself says. */
	careerBenefitText?: string;
	/** Undefined when the sheet's Complication field is blank — a hero has no obligation to have picked one, so this is never treated as a missing/ambiguous match to resolve. */
	complicationName?: string;
	/** The Complication's own Benefit/Drawback prose, already complete on the sheet — no compendium lookup needed, unlike Ancestry Traits/Class Features (which the sheet only ever names). */
	complicationDetails?: string;
	className?: string;
	/** Free text combining the hero's subclass pick and Domain choice (e.g. "Exorcist - Domain: Fate" for a Censor) — split on " - Domain: " into separate Background Info lines when that pattern matches, otherwise rendered verbatim as one line (see pdf-note-builder.ts). */
	subclassName?: string;
	kitName?: string;
	/** The sheet's own free-text summary of the kit's benefits (equipment proficiencies, granted feature names) — duplicates armorName/weaponName and the granted ability's own full ability card, kept as a plain reference blurb for the same reason as careerBenefitText. */
	modifierBenefitsText?: string;
	/** Ancestry trait names from the sheet's "Perks 1" field (its own ancestry-name lead-in line is discarded — redundant with `ancestryName`) — name-only; each is resolved against the DS Compendium's `Ancestries/<name>.md` note to fill in the description the sheet doesn't carry (see pdf-compendium-resolver.ts). */
	ancestryTraitNames: string[];
	/** Class feature names from the sheet's "Class Features 1" field, same shape as ancestryTraitNames — includes the class's Heroic Resource by name (e.g. "Wrath"), which the note builder filters back out since that's already shown as its own Resources counter. */
	classFeatureNames: string[];
	characteristics: {
		might?: number;
		agility?: number;
		reason?: number;
		intuition?: number;
		presence?: number;
	};
	currentStamina?: number;
	maxStamina?: number;
	/** Class-specific base Recoveries pool (e.g. a Censor's 12 vs a Tactician's 10 — not a universal level-1 number, see the Compendium's own class entries). Recoveries used is assumed 0 on import — the sheet has no reliable field for it. Recovery Value (stamina restored per recovery) is computed the same way as the .ds-hero path (floor(maxStamina / 3)), not read off the sheet. */
	maxRecoveries?: number;
	heroicResourceName?: string;
	heroicResourceValue?: number;
	surges?: number;
	victories?: number;
	xp?: number;
	renown?: number;
	wealth?: number;
	speed?: number;
	stability?: number;
	disengage?: number;
	/** e.g. "1M" — matches HeroStats.size's format in hero-stats.ts. */
	size?: string;
	/** The sheet's Armor field (e.g. "Medium") — combined with weaponName and the kit's own compendium equipment listing under the note's Kit section. */
	armorName?: string;
	/** The sheet's "Weapon/Implement" field (e.g. "Polearm"). */
	weaponName?: string;
	abilities: PdfAbility[];
	/** Skill checkbox fields whose name matched the official skill list (see skill-data.ts) and were checked. */
	skills: string[];
	otherNotes?: string;
}

/** The logical fields this feature needs out of a filled PDF, independent of the sheet's actual AcroForm field names — see pdf-field-map.ts. */
export type PdfHeroField =
	| "heroName"
	| "level"
	| "ancestryName"
	| "cultureEnvironmentName"
	| "cultureOrganizationName"
	| "cultureUpbringingName"
	| "cultureLanguageName"
	| "careerName"
	| "careerIncitingIncident"
	| "careerBenefitText"
	| "complicationName"
	| "complicationDetails"
	| "className"
	| "subclassName"
	| "kitName"
	| "modifierBenefitsText"
	| "perks1"
	| "classFeatures1"
	| "might"
	| "agility"
	| "reason"
	| "intuition"
	| "presence"
	| "currentStamina"
	| "maxStamina"
	| "maxRecoveries"
	| "heroicResourceName"
	| "heroicResourceValue"
	| "surges"
	| "victories"
	| "xp"
	| "renown"
	| "wealth"
	| "speed"
	| "stability"
	| "disengage"
	| "size"
	| "armorName"
	| "weaponName"
	| "otherNotes";
