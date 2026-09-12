import { extractAbilities } from "./pdf-ability-grid";
import { RawPdfFields } from "./pdf-field-extractor";
import { PDF_FIELD_MAP } from "./pdf-field-map";
import { PdfHeroData, PdfHeroField } from "./pdf-hero-types";
import { findOfficialSkill } from "./skill-data";

/** Every raw field the sheet has checked ("true") whose name matches the official skill list (case-insensitive) — that's how skill proficiencies are represented on this sheet, as one checkbox per skill rather than a single "skills" field. Unrelated true/false toggles (e.g. "Modifier Kit") simply don't match any skill name. */
function extractSkills(raw: RawPdfFields): string[] {
	const skills: string[] = [];
	for (const [fieldName, value] of raw.entries()) {
		if (value !== "true") continue;
		const match = findOfficialSkill(fieldName);
		if (match) skills.push(match.name);
	}
	return skills;
}

function field(raw: RawPdfFields, name: PdfHeroField): string | undefined {
	return raw.get(PDF_FIELD_MAP[name]);
}

function numberField(raw: RawPdfFields, name: PdfHeroField): number | undefined {
	const value = field(raw, name);
	if (value === undefined) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/** Splits the sheet's "Label:\n- Item\n- Item" list fields (Perks 1/Class Features 1) into just the item names — the leading label line (an ancestry/class name) is discarded as redundant with ancestryName/className. */
function parseBulletNames(raw: string | undefined): string[] {
	if (!raw) return [];
	return raw
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.startsWith("-"))
		.map((line) => line.replace(/^-\s*/, "").trim())
		.filter(Boolean);
}

/**
 * Turns pdf-field-extractor.ts's raw `fieldName -> value` map into a
 * PdfHeroData, using PDF_FIELD_MAP to look up each logical field's real
 * AcroForm name. Missing hero name is the one hard failure — everything
 * else is optional, since a partially-filled sheet is still worth importing
 * (the compendium-resolution step surfaces anything it can't confidently
 * fill in via a modal, rather than this step silently guessing).
 */
export function parsePdfHeroData(raw: RawPdfFields): PdfHeroData {
	const name = field(raw, "heroName");
	if (!name) {
		throw new Error(
			`Couldn't find the hero's name field ("${PDF_FIELD_MAP.heroName}") in this PDF. ` +
				"The field-name mapping in pdf-field-map.ts may not match this sheet — see DSHI_PDF_DEBUG."
		);
	}

	return {
		name,
		level: numberField(raw, "level") ?? 1,
		ancestryName: field(raw, "ancestryName"),
		cultureEnvironmentName: field(raw, "cultureEnvironmentName"),
		cultureOrganizationName: field(raw, "cultureOrganizationName"),
		cultureUpbringingName: field(raw, "cultureUpbringingName"),
		cultureLanguageName: field(raw, "cultureLanguageName"),
		careerName: field(raw, "careerName"),
		careerIncitingIncident: field(raw, "careerIncitingIncident"),
		careerBenefitText: field(raw, "careerBenefitText"),
		complicationName: field(raw, "complicationName"),
		complicationDetails: field(raw, "complicationDetails"),
		className: field(raw, "className"),
		subclassName: field(raw, "subclassName"),
		kitName: field(raw, "kitName"),
		modifierBenefitsText: field(raw, "modifierBenefitsText"),
		characteristics: {
			might: numberField(raw, "might"),
			agility: numberField(raw, "agility"),
			reason: numberField(raw, "reason"),
			intuition: numberField(raw, "intuition"),
			presence: numberField(raw, "presence"),
		},
		currentStamina: numberField(raw, "currentStamina"),
		maxStamina: numberField(raw, "maxStamina"),
		maxRecoveries: numberField(raw, "maxRecoveries"),
		heroicResourceName: field(raw, "heroicResourceName"),
		heroicResourceValue: numberField(raw, "heroicResourceValue"),
		surges: numberField(raw, "surges"),
		victories: numberField(raw, "victories"),
		xp: numberField(raw, "xp"),
		renown: numberField(raw, "renown"),
		wealth: numberField(raw, "wealth"),
		speed: numberField(raw, "speed"),
		stability: numberField(raw, "stability"),
		disengage: numberField(raw, "disengage"),
		size: field(raw, "size"),
		armorName: field(raw, "armorName"),
		weaponName: field(raw, "weaponName"),
		abilities: extractAbilities(raw),
		skills: extractSkills(raw),
		otherNotes: field(raw, "otherNotes"),
		ancestryTraitNames: parseBulletNames(field(raw, "perks1")),
		classFeatureNames: parseBulletNames(field(raw, "classFeatures1")),
	};
}
