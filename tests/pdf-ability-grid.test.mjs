import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { ROOT } from "./helpers.mjs";
import { importTs } from "./ts-loader.mjs";

const { extractAbilities } = await importTs(join(ROOT, "src/pdf-ability-grid.ts"));

// Fixture modeled on a real filled sheet's raw field dump (a level 1 Tactician).
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
		"Ability Type.1": "Heroic",
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
