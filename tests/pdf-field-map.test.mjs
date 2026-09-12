import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { ROOT } from "./helpers.mjs";
import { importTs } from "./ts-loader.mjs";

const { PDF_FIELD_MAP } = await importTs(join(ROOT, "src/pdf-field-map.ts"));

// Structural sanity for the PDF_FIELD_MAP placeholder — see the file's own
// header comment for why this is a guess until a real filled MCDM PDF is
// available. This test guards against accidental hand-edit mistakes
// (duplicate targets, blanks), not against the mapping being wrong.

const EXPECTED_FIELDS = [
	"heroName",
	"level",
	"ancestryName",
	"cultureEnvironmentName",
	"cultureOrganizationName",
	"cultureUpbringingName",
	"cultureLanguageName",
	"careerName",
	"careerIncitingIncident",
	"careerBenefitText",
	"complicationName",
	"complicationDetails",
	"className",
	"subclassName",
	"kitName",
	"modifierBenefitsText",
	"perks1",
	"classFeatures1",
	"might",
	"agility",
	"reason",
	"intuition",
	"presence",
	"currentStamina",
	"maxStamina",
	"maxRecoveries",
	"heroicResourceName",
	"heroicResourceValue",
	"surges",
	"victories",
	"xp",
	"renown",
	"wealth",
	"speed",
	"stability",
	"disengage",
	"size",
	"armorName",
	"weaponName",
	"otherNotes",
];

test("PDF_FIELD_MAP covers every logical PdfHeroField", () => {
	assert.deepEqual(Object.keys(PDF_FIELD_MAP).sort(), [...EXPECTED_FIELDS].sort());
});

test("PDF_FIELD_MAP has no empty or duplicate target field names", () => {
	const targets = Object.values(PDF_FIELD_MAP);
	assert.ok(targets.every((t) => typeof t === "string" && t.trim().length > 0), "every target must be a non-empty string");
	assert.equal(new Set(targets).size, targets.length, "target field names must be unique");
});
