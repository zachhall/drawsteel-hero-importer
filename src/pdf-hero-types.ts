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
 * Notes/Background Info) — not everything the sheet could theoretically
 * carry (e.g. it never surfaces Recoveries, since the ForgeSteel-derived
 * note doesn't render that either).
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
	/** Undefined when the sheet's Complication field is blank — a hero has no obligation to have picked one, so this is never treated as a missing/ambiguous match to resolve. */
	complicationName?: string;
	className?: string;
	kitName?: string;
	characteristics: {
		might?: number;
		agility?: number;
		reason?: number;
		intuition?: number;
		presence?: number;
	};
	currentStamina?: number;
	maxStamina?: number;
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
	| "complicationName"
	| "className"
	| "kitName"
	| "might"
	| "agility"
	| "reason"
	| "intuition"
	| "presence"
	| "currentStamina"
	| "maxStamina"
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
