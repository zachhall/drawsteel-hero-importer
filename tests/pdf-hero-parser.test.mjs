import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { ROOT } from "./helpers.mjs";
import { importTs } from "./ts-loader.mjs";

const { parsePdfHeroData } = await importTs(join(ROOT, "src/pdf-hero-parser.ts"));

function rawFields(entries) {
	return new Map(Object.entries(entries));
}

test("Perks 1 / Class Features 1 parse into name-only lists, discarding the ancestry/class label line", () => {
	const hero = parsePdfHeroData(
		rawFields({
			"Character Name": "Hellic",
			Ancestry: "Orc",
			"Perks 1": "Orc:\n- Bloodfire Rush\n- Glowing Recovery\n- Relentless",
			Class: "Censor",
			"Class Features 1": "Censor\n- Oracular Visions\n- Wrath",
		})
	);
	assert.deepEqual(hero.ancestryTraitNames, ["Bloodfire Rush", "Glowing Recovery", "Relentless"]);
	assert.deepEqual(hero.classFeatureNames, ["Oracular Visions", "Wrath"]);
});

test("missing Perks 1 / Class Features 1 yields empty arrays, not undefined", () => {
	const hero = parsePdfHeroData(rawFields({ "Character Name": "Hellic" }));
	assert.deepEqual(hero.ancestryTraitNames, []);
	assert.deepEqual(hero.classFeatureNames, []);
});

test("Complication Name/Details, Career Inciting Incident/Benefit, Subclass, and Modifier Benefits all pass through", () => {
	const hero = parsePdfHeroData(
		rawFields({
			"Character Name": "Hellic",
			"Complication Name": "War Dog Collar",
			"Complication Details": "Benefit: ...\nDrawback: ...",
			"Career Inciting Incident": "New Challenges",
			"Career Benefit": "Skills: Heal, Swim",
			Subclass: "Exorcist - Domain: Fate",
			"Modifier Benefits": "Uses: Heavy Armor",
		})
	);
	assert.equal(hero.complicationName, "War Dog Collar");
	assert.equal(hero.complicationDetails, "Benefit: ...\nDrawback: ...");
	assert.equal(hero.careerIncitingIncident, "New Challenges");
	assert.equal(hero.careerBenefitText, "Skills: Heal, Swim");
	assert.equal(hero.subclassName, "Exorcist - Domain: Fate");
	assert.equal(hero.modifierBenefitsText, "Uses: Heavy Armor");
});
