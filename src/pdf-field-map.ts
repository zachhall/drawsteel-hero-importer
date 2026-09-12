import { PdfHeroField } from "./pdf-hero-types";

/**
 * Maps this plugin's logical hero fields to the MCDM fillable character
 * sheet PDF's actual AcroForm field names.
 *
 * Verified against a real filled sheet's raw field dump (a level 1 Tactician
 * "Heskdry Orus") for every field marked (confirmed) below. Fields marked
 * (unverified) were blank on that sample — the dump omits blank fields
 * entirely, so their names are still a best guess pending a sample where
 * they're actually filled in.
 *
 * The ability grid (Ability Name/Action/Cost/Target/Distance/Keywords/
 * Details.<row>.<col>) isn't a simple name->value lookup, so it's handled
 * separately by extractAbilities() in pdf-ability-grid.ts, not through this
 * map. Recovery Value (stamina per recovery) also isn't mapped — it's
 * computed the same way as the .ds-hero path, not read off the sheet.
 *
 * To verify or fix a field: set DSHI_PDF_DEBUG = true, import a filled PDF,
 * and check the console for the raw field-name dump.
 */
export const DSHI_PDF_DEBUG = false;

export const PDF_FIELD_MAP: Record<PdfHeroField, string> = {
	heroName: "Character Name", // confirmed
	level: "Level", // confirmed
	ancestryName: "Ancestry", // confirmed
	cultureEnvironmentName: "Culture Environment", // confirmed
	cultureOrganizationName: "Culture Organization", // confirmed
	cultureUpbringingName: "Culture Upbringing", // confirmed
	cultureLanguageName: "Languages", // confirmed — can hold multiple languages, one per line
	careerName: "Career Name", // confirmed (a duplicate "Career" field also carries the same value)
	careerIncitingIncident: "Career Inciting Incident", // confirmed
	careerBenefitText: "Career Benefit", // confirmed — multi-line ("Skills: .../Language: .../Renown: .../Perk: ...")
	// confirmed against a real filled sheet (a level 1 Censor "Hellic") as
	// "Complication Name" — previously guessed as bare "Complication", which
	// doesn't exist on the sheet at all. A hero legitimately has no
	// complication until one's chosen, so a blank value is never treated as a
	// missing compendium match.
	complicationName: "Complication Name",
	complicationDetails: "Complication Details", // confirmed — Benefit/Drawback prose, already complete on the sheet
	className: "Class", // confirmed
	subclassName: "Subclass", // confirmed — free text, e.g. "Exorcist - Domain: Fate" (subclass pick + Domain combined)
	// unverified: no single "kit name" field exists on the sheet — it bakes in
	// the kit's resulting bonuses directly (Melee Weapon Damage/Stamina
	// Modifier/Armor/Weapon fields) instead. "Modifier Name" held the kit's
	// name ("Guisarmier") on the sample sheet, alongside a "Modifier Kit"
	// checkbox, but this is a guess at what that field represents generally.
	kitName: "Modifier Name",
	modifierBenefitsText: "Modifier Benefits", // confirmed — multi-line ("Uses: .../Features: ...")
	might: "Might", // confirmed
	agility: "Agility", // confirmed
	reason: "Reason", // confirmed
	intuition: "Intuition", // confirmed
	presence: "Presence", // confirmed
	currentStamina: "Current Stamina", // confirmed
	maxStamina: "stamina max", // confirmed (field name is lowercase on the real sheet)
	// confirmed present on the sample sheet as "Recoveries" (value 10, a
	// Tactician's class-specific base) — a duplicate "recov max" field also
	// carries the same value. This is a genuine per-class number (e.g. a
	// Censor's is 12 per the Compendium), not derivable from other fields.
	maxRecoveries: "Recoveries",
	heroicResourceName: "resource name", // confirmed (e.g. "Focus", "Wrath" — whatever the hero's class calls it)
	heroicResourceValue: "Resource Count", // confirmed
	surges: "Surges", // confirmed
	victories: "Victories", // unverified — blank (0) on the sample sheet
	xp: "XP", // confirmed
	renown: "Renown", // confirmed
	wealth: "Wealth", // confirmed
	speed: "Speed", // confirmed
	stability: "Stability", // confirmed
	disengage: "Disengage", // confirmed
	size: "Size", // confirmed (e.g. "1M")
	armorName: "Armor", // confirmed
	weaponName: "Weapon/Implement", // confirmed
	otherNotes: "Notes", // unverified — blank on the sample sheet
	// confirmed — a "Label:\n- Item\n- Item" list; the label line (the
	// ancestry/class name) is discarded by pdf-hero-parser.ts's parser since
	// it duplicates ancestryName/className.
	perks1: "Perks 1",
	classFeatures1: "Class Features 1",
};
