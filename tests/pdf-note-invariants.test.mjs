import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import * as yaml from "js-yaml";
import { ROOT } from "./helpers.mjs";
import { importTs } from "./ts-loader.mjs";

const { buildPdfHeroNote } = await importTs(join(ROOT, "src/pdf-note-builder.ts"));

/**
 * Structural/invariant tests for the PDF import path — hand-built fixtures,
 * no real PDF binary. Once buildPdfHeroNote calls the same shared
 * note-model.ts functions the golden-tested ForgeSteel path uses, most of
 * what would otherwise need testing here (resource-row grouping, skills
 * split, ability bucketing/sorting) is already covered by that shared
 * code's own tests (note-model.test.mjs) and transitively proven correct by
 * golden-notes.test.mjs. What's left to check here is PDF-specific: the
 * data actually reaches those shared functions, and known past bugs
 * (literal "\r" in output) don't regress.
 */

function basePdfHero(overrides = {}) {
	return {
		name: "Test Hero",
		level: 1,
		characteristics: { might: 2, agility: -1, reason: 1, intuition: 0, presence: 3 },
		abilities: [],
		skills: [],
		...overrides,
	};
}

test("no literal carriage return anywhere in the rendered note", () => {
	const note = buildPdfHeroNote(
		basePdfHero({
			abilities: [
				{ name: "Test Ability", type: "Signature", action: "Main", details: "Power Roll + 2\nTier 1: 7 damage", effects: [] },
			],
			cultureLanguageName: "Axiomatic\nVhoric",
		}),
		{}
	);
	assert.doesNotMatch(note, /\r/);
});

test("resources section renders a ds-counter for each resource", () => {
	const note = buildPdfHeroNote(basePdfHero({ heroicResourceName: "Focus", heroicResourceValue: 3, surges: 1 }), {});
	assert.match(note, /name: Focus/);
	assert.match(note, /name: Surges/);
});

test("every ds-feature block YAML-parses with required keys", () => {
	const note = buildPdfHeroNote(
		basePdfHero({
			abilities: [
				{ name: "Untold Aggression", type: "Signature", action: "Main", target: "One creature", distance: "Melee 2", details: "Power Roll + 2" },
				{ name: "Mark: Trigger", type: "Heroic", action: "Free Triggered", cost: "1", details: "Gain a benefit." },
			],
		}),
		{}
	);

	const blocks = [...note.matchAll(/~~~ds-feature\n([\s\S]*?)\n~~~/g)].map((m) => yaml.load(m[1]));
	assert.equal(blocks.length, 2);
	blocks.forEach((block) => {
		assert.equal(block.type, "feature");
		assert.equal(block.feature_type, "ability");
		assert.ok(block.name);
	});
});

test("action-type normalization: 'Free Triggered' and 'Triggered' both bucket under Triggered Action; bare 'Free' falls to Other", () => {
	const note = buildPdfHeroNote(
		basePdfHero({
			abilities: [
				{ name: "A", type: "Heroic", action: "Triggered", details: "x" },
				{ name: "B", type: "Heroic", action: "Free Triggered", cost: "1", details: "x" },
				{ name: "C", type: "Heroic", action: "Free", details: "x" },
			],
		}),
		{}
	);
	assert.match(note, /### Triggered Action/);
	assert.match(note, /### Other/);
	// Both A and B should land before the "### Other" heading (same bucket, Triggered Action).
	const triggeredIdx = note.indexOf("### Triggered Action");
	const otherIdx = note.indexOf("### Other");
	assert.ok(triggeredIdx < otherIdx);
	assert.ok(note.indexOf("name: A") < otherIdx);
	assert.ok(note.indexOf("'Mark: Trigger'") === -1); // sanity: this test's own fixture doesn't reuse that name
});

test("missing action falls into Other", () => {
	const note = buildPdfHeroNote(basePdfHero({ abilities: [{ name: "No Action Type", details: "x" }] }), {});
	assert.match(note, /### Other/);
});

test("blank Complication is never surfaced as a background line", () => {
	const note = buildPdfHeroNote(basePdfHero(), {});
	assert.doesNotMatch(note, /Complication/);
});

test("Recoveries: max comes from the sheet, current assumes 0 used, Recovery Value is computed as floor(maxStamina / 3)", () => {
	const note = buildPdfHeroNote(basePdfHero({ maxStamina: 27, maxRecoveries: 10 }), {});
	assert.match(note, /max_value: 10/);
	assert.match(note, /current_value: 10/); // Recoveries counter assumes none used yet
	assert.match(note, /Max Recoveries: 10/);
	assert.match(note, /Recovery Value: 9/); // floor(27 / 3)
});

test("missing maxRecoveries defaults to 0 rather than throwing", () => {
	const note = buildPdfHeroNote(basePdfHero(), {});
	assert.match(note, /max_value: 0/);
});

test("Career Inciting Incident is appended to the Career Background Info line", () => {
	const note = buildPdfHeroNote(basePdfHero({ careerName: "Gladiator", careerIncitingIncident: "New Challenges" }), {});
	assert.match(note, /\*\*Career:\*\* Gladiator \(Inciting Incident: New Challenges\)/);
});

test("Career/Kit Benefits render as single-line reference blurbs, multi-line sheet text joined with '; '", () => {
	const note = buildPdfHeroNote(
		basePdfHero({
			careerBenefitText: "Skills: Heal, Swim\nLanguage: Szetch\nRenown: +2",
			kitName: "Mountain",
			modifierBenefitsText: "Uses: Heavy Armor\nFeatures: Pain For Pain",
		}),
		{}
	);
	assert.match(note, /\*\*Career Benefits:\*\* Skills: Heal, Swim; Language: Szetch; Renown: \+2/);
	assert.match(note, /\*\*Kit Benefits:\*\* Uses: Heavy Armor; Features: Pain For Pain/);
});

test("Subclass splits into Subclass/Domain lines when it matches '<pick> - Domain: <domain>'", () => {
	const note = buildPdfHeroNote(basePdfHero({ subclassName: "Exorcist - Domain: Fate" }), {});
	assert.match(note, /\*\*Subclass:\*\* Exorcist/);
	assert.match(note, /\*\*Domain:\*\* Fate/);
});

test("Subclass renders verbatim as one line when it doesn't match the '<pick> - Domain: <domain>' pattern", () => {
	const note = buildPdfHeroNote(basePdfHero({ subclassName: "Some Other Class's Format" }), {});
	assert.match(note, /\*\*Subclass:\*\* Some Other Class's Format/);
	assert.doesNotMatch(note, /\*\*Domain:\*\*/);
});

test("Background Info is the last section, after Kit/Details/Notes", () => {
	const note = buildPdfHeroNote(
		basePdfHero({ careerName: "Gladiator", armorName: "Heavy Armor", cultureLanguageName: "Common", otherNotes: "Some notes" }),
		{}
	);
	const backgroundIdx = note.indexOf("## Background Info");
	assert.ok(backgroundIdx > note.indexOf("## Kit"));
	assert.ok(backgroundIdx > note.indexOf("## Details"));
	assert.ok(backgroundIdx > note.indexOf("## Notes"));
});

test("Ancestry Traits render as a nested '### Ancestry' group under Background Info, with description when resolved and name-only when not", () => {
	const note = buildPdfHeroNote(basePdfHero({ ancestryName: "Orc" }), {
		ancestryTraits: [
			{ name: "Bloodfire Rush", description: "Speed bonus text." },
			{ name: "Unresolved Trait" },
		],
	});
	assert.match(note, /### Ancestry/);
	assert.match(note, /name: Bloodfire Rush/);
	assert.match(note, /Speed bonus text\./);
	assert.match(note, /name: Unresolved Trait/);
	assert.match(note, /\*Ancestry — Orc\*/);
});

test("Class Features render as a top-level '## Traits' section", () => {
	const note = buildPdfHeroNote(basePdfHero({ className: "Censor" }), {
		classFeatures: [{ name: "Oracular Visions", description: "Fate points text." }],
	});
	assert.match(note, /## Traits/);
	assert.match(note, /name: Oracular Visions/);
	assert.match(note, /Fate points text\./);
	assert.match(note, /\*Class — Censor\*/);
});

test("no Traits section when there are no class features to render", () => {
	const note = buildPdfHeroNote(basePdfHero(), {});
	assert.doesNotMatch(note, /## Traits/);
});

test("Complication with labeled Benefit/Drawback text splits into two named blocks, no compendium lookup involved", () => {
	const note = buildPdfHeroNote(
		basePdfHero({ complicationName: "War Dog Collar", complicationDetails: "Benefit: You gain X.\n\nDrawback: You suffer Y." }),
		{}
	);
	assert.match(note, /### Complication/);
	assert.match(note, /name: War Dog Collar Benefit/);
	assert.match(note, /You gain X\./);
	assert.match(note, /name: War Dog Collar Drawback/);
	assert.match(note, /You suffer Y\./);
});

test("Complication with unlabeled details renders as one block with the text verbatim", () => {
	const note = buildPdfHeroNote(
		basePdfHero({ complicationName: "War Dog Collar", complicationDetails: "Some freeform complication text." }),
		{}
	);
	assert.match(note, /name: War Dog Collar\n/);
	assert.match(note, /Some freeform complication text\./);
});

test("the Kit's name is appended to the '## Kit' heading, not just its own Background Info line", () => {
	const note = buildPdfHeroNote(basePdfHero({ kitName: "Mountain", armorName: "Heavy Armor" }), {});
	assert.match(note, /^## Kit — Mountain$/m);
});

test("'## Kit' has no name appended when the sheet has no Kit at all", () => {
	const note = buildPdfHeroNote(basePdfHero({ armorName: "Heavy Armor" }), {});
	assert.match(note, /^## Kit$/m);
});

test("a Kit's Signature Ability already listed in Actions isn't also imported into '### Signature Ability' — it would show twice", () => {
	const note = buildPdfHeroNote(
		basePdfHero({
			kitName: "Mountain",
			abilities: [{ name: "Pain for Pain", type: "Other", action: "Main", details: "Power Roll + 2\nTier 1: 3 damage" }],
		}),
		{ kit: { signatureAbility: { name: "Pain for Pain", powerRollText: "**Power Roll + Might:**\n- some text" } } }
	);
	assert.doesNotMatch(note, /### Signature Ability/);
	// Sanity: it's still there exactly once, from the Actions grid.
	assert.equal([...note.matchAll(/name: Pain for Pain/g)].length, 1);
});

test("a Kit's Signature Ability NOT already in Actions still renders under '### Signature Ability'", () => {
	const note = buildPdfHeroNote(basePdfHero({ kitName: "Mountain" }), {
		kit: { signatureAbility: { name: "Pain for Pain", powerRollText: "**Power Roll + Might:**\n- some text" } },
	});
	assert.match(note, /### Signature Ability/);
	assert.match(note, /\*\*Pain for Pain\*\*/);
});
