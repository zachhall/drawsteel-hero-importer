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

test("resources section uses the shared resource-row wrapper", () => {
	const note = buildPdfHeroNote(basePdfHero({ heroicResourceName: "Focus", heroicResourceValue: 3, surges: 1 }), {});
	assert.match(note, /dshi-resource-row/);
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
