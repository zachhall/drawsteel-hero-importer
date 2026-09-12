import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { ROOT } from "./helpers.mjs";
import { importTs } from "./ts-loader.mjs";

const { extractAbilities } = await importTs(join(ROOT, "src/pdf-ability-grid.ts"));

// Fixture modeled on real filled sheets' raw field dumps (a level 1 Tactician,
// then a level 1 Censor "Hellic" that confirmed the "Ability Type" field's
// real naming: row 0 is "Ability Type.<col>", row 1 is "Ability Type1.<col>",
// row 2 "Ability Type2.<col>" — not one label per whole row.
function rawFields(entries) {
	return new Map(Object.entries(entries));
}

test("extractAbilities reads the grid into one entry per filled 'Ability Name' cell", () => {
	const raw = rawFields({
		"Ability Type.0": "Signature",
		"Ability Name.0.0": "Untold Aggression",
		"Ability Action.0.0": "Main",
		"Ability Target.0.0": "One creature or object",
		"Ability Distance.0.0": "Melee 2",
		"Ability Keywords.0.0": "Charge, Melee, Strike, Weapon",
		"Ability Details.0.0": "Power Roll + 2\nTier 1: 7 damage",
		"Ability Type1.1": "Heroic",
		"Ability Name.1.1": "Mark",
		"Ability Cost.1.1": undefined,
	});

	const abilities = extractAbilities(raw);
	assert.equal(abilities.length, 2);

	const [first, second] = abilities;
	assert.equal(first.name, "Untold Aggression");
	assert.equal(first.type, "Signature");
	assert.equal(first.action, "Main");
	assert.deepEqual(first.keywords, ["Charge", "Melee", "Strike", "Weapon"]);
	assert.match(first.details, /Power Roll \+ 2/);

	assert.equal(second.name, "Mark");
	assert.equal(second.type, "Heroic");
});

test("extractAbilities skips cells with no name", () => {
	const raw = rawFields({ "Ability Action.0.0": "Main" });
	assert.deepEqual(extractAbilities(raw), []);
});

test("extractAbilities reads each cell's own type within a row, not one label for the whole row", () => {
	// Regression for a real bug: three abilities in the same row on the
	// Hellic sample sheet had three different types (Signature/Other/Heroic),
	// but the grid's "Ability Type" fields fold the row number into the field
	// name prefix rather than the shared ".<row>." infix every other grid
	// field uses, so a naive `Ability Type.${row}` lookup silently grabbed a
	// different cell's type and applied it to the entire row.
	const raw = rawFields({
		"Ability Name.0.0": "Every Step ... Death!",
		"Ability Type.0": "Signature",
		"Ability Name.0.1": "Pain for Pain",
		"Ability Type.1": "Other",
		"Ability Name.0.2": "Repent!",
		"Ability Type.2": "Heroic",
	});

	const [a, b, c] = extractAbilities(raw);
	assert.equal(a.type, "Signature");
	assert.equal(b.type, "Other");
	assert.equal(c.type, "Heroic");
});
