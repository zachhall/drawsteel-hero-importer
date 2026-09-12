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
 * map. Recoveries aren't mapped at all — the ForgeSteel-derived note doesn't
 * render a Recoveries counter either (see markdown-builder.ts), so this
 * feature doesn't surface it either, to keep the two import paths' output
 * matching.
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
	complicationName: "Complication", // unverified — blank on the sample sheet; a hero legitimately has no complication until one's chosen, so a blank value is never treated as a missing compendium match
	className: "Class", // confirmed
	// unverified: no single "kit name" field exists on the sheet — it bakes in
	// the kit's resulting bonuses directly (Melee Weapon Damage/Stamina
	// Modifier/Armor/Weapon fields) instead. "Modifier Name" held the kit's
	// name ("Guisarmier") on the sample sheet, alongside a "Modifier Kit"
	// checkbox, but this is a guess at what that field represents generally.
	kitName: "Modifier Name",
	might: "Might", // confirmed
	agility: "Agility", // confirmed
	reason: "Reason", // confirmed
	intuition: "Intuition", // confirmed
	presence: "Presence", // confirmed
	currentStamina: "Current Stamina", // confirmed
	maxStamina: "stamina max", // confirmed (field name is lowercase on the real sheet)
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
};
