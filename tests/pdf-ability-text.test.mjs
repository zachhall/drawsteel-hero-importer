import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { ROOT } from "./helpers.mjs";
import { importTs } from "./ts-loader.mjs";

const { parsePdfAbilityText, splitComplicationSections } = await importTs(join(ROOT, "src/pdf-ability-text.ts"));

// Fixtures are real sheet text (a level 1 Censor "Hellic") checked directly
// against that hero's independently-built ForgeSteel golden fixture
// (tests/fixtures/hellic.golden.md) — see pdf-ability-text.ts's own doc
// comment for why that comparison matters here specifically.

test("a simple roll + three tiers + trailing Effect becomes roll/tier1-3 then a plain effect, Effect: label stripped", () => {
	const details =
		"Power Roll + 2\n\nTier 1: 7 psychic damage\nTier 2: 9 psychic damage\nTier 3: 12 psychic damage\n\nEffect: Each time the target willingly moves before the end of your next turn, they take 1 psychic damage for each square they move.";
	const { effects, trigger } = parsePdfAbilityText(details);
	assert.equal(trigger, undefined);
	assert.deepEqual(effects, [
		{ roll: "Power Roll + 2", tier1: "7 psychic damage", tier2: "9 psychic damage", tier3: "12 psychic damage" },
		{ effect: "Each time the target willingly moves before the end of your next turn, they take 1 psychic damage for each square they move." },
	]);
});

test("a roll with no trailing prose produces just the one roll/tier1-3 entry", () => {
	const details = "Power Roll + 2\n\nTier 1: 7 holy damage; I<0 dazed (save ends)\nTier 2: 10 holy damage; I<1 dazed (save ends)\nTier 3: 13 holy damage; I<2 dazed (save ends)";
	const { effects } = parsePdfAbilityText(details);
	assert.equal(effects.length, 1);
	assert.equal(effects[0].roll, "Power Roll + 2");
	assert.equal(effects[0].tier3, "13 holy damage; I<2 dazed (save ends)");
});

test("a Melee/Ranged-labeled dual tier group produces two labeled roll entries", () => {
	const details =
		"Power Roll + 2\n\nMelee:\nTier 1: 7 holy damage; M<0 weak 3\nTier 2: 11 holy damage; M<1 weak 5\nTier 3: 18 holy damage; M<2 weak 7\nRanged: \nTier 1: 7 holy damage; M<0 weak 3\nTier 2: 11 holy damage; M<1 weak 5\nTier 3: 14 holy damage; M<2 weak 7\n\nWhile the target has fire weakness, etc.";
	const { effects } = parsePdfAbilityText(details);
	assert.equal(effects.length, 3);
	assert.equal(effects[0].roll, "Melee — Power Roll + 2");
	assert.equal(effects[0].tier3, "18 holy damage; M<2 weak 7");
	assert.equal(effects[1].roll, "Ranged — Power Roll + 2");
	assert.equal(effects[1].tier3, "14 holy damage; M<2 weak 7");
	assert.deepEqual(effects[2], { effect: "While the target has fire weakness, etc." });
});

test("a trailing clause glued directly onto Tier 3 with no blank line is kept, not silently dropped", () => {
	const details = "Power Roll + 2\n\nTier 1: 7 damage\nTier 2: 9 damage\nTier 3: 12 damage\nAdditional effect: the target is also dazed.";
	const { effects } = parsePdfAbilityText(details);
	assert.deepEqual(effects, [
		{ roll: "Power Roll + 2", tier1: "7 damage", tier2: "9 damage", tier3: "12 damage" },
		{ effect: "Additional effect: the target is also dazed." },
	]);
});

test("an ordinary punctuation-free short sentence isn't misread as a heading (only first word capitalized, not Title Case)", () => {
	const { effects } = parsePdfAbilityText("Enemy is knocked prone\n\nSome following unrelated text.");
	assert.deepEqual(effects, [{ effect: "Enemy is knocked prone" }, { effect: "Some following unrelated text." }]);
});

test("a single capitalized word standing alone is never treated as a heading (no second word to confirm Title Case)", () => {
	const { effects } = parsePdfAbilityText("Wrath\n\nSome following text.");
	assert.deepEqual(effects, [{ effect: "Wrath" }, { effect: "Some following text." }]);
});

test("a roll line with no recognizable tier group after it is kept as plain text, not dropped", () => {
	const { effects } = parsePdfAbilityText("Power Roll + 2\n\nSomething unexpected here.");
	assert.deepEqual(effects, [{ effect: "Power Roll + 2" }, { effect: "Something unexpected here." }]);
});

test("a leading 'Trigger: ...' paragraph becomes the top-level trigger, not an effect", () => {
	const details =
		"Trigger: The target starts their turn or takes damage.\n\nYou spend a Recovery and the target regains Stamina equal to 10.\n\nSpend 1: You can end one effect on the target that is ended by a saving throw or that ends at the end of their turn, or a prone target can stand up.";
	const { trigger, effects } = parsePdfAbilityText(details);
	assert.equal(trigger, "The target starts their turn or takes damage.");
	assert.deepEqual(effects, [
		{ effect: "You spend a Recovery and the target regains Stamina equal to 10." },
		{
			name: "Spend",
			cost: "1",
			effect: "You can end one effect on the target that is ended by a saving throw or that ends at the end of their turn, or a prone target can stand up.",
		},
	]);
});

test("a heading-like line as its own standalone paragraph names the next paragraph (the actual shape on a real sheet)", () => {
	const details =
		"You can choose only one free triggered action option at a time, even if multiple options are triggered by the same effect.\n\nJudgment Order Benefit\n\nThe first time on a turn that you use your Judgment ability to judge a creature, you can teleport up to a number of squares equal to 4.";
	const { effects } = parsePdfAbilityText(details);
	assert.deepEqual(effects, [
		{ effect: "You can choose only one free triggered action option at a time, even if multiple options are triggered by the same effect." },
		{ name: "Judgment Order Benefit", effect: "The first time on a turn that you use your Judgment ability to judge a creature, you can teleport up to a number of squares equal to 4." },
	]);
});

test("a heading-like line glued onto the end of a paragraph splits into a plain effect plus a named entry over the next paragraph", () => {
	const details =
		"You can choose only one free triggered action option at a time, even if multiple options are triggered by the same effect.\nJudgment Order Benefit\n\nThe first time on a turn that you use your Judgment ability to judge a creature, you can teleport up to a number of squares equal to 4.";
	const { effects } = parsePdfAbilityText(details);
	assert.deepEqual(effects, [
		{ effect: "You can choose only one free triggered action option at a time, even if multiple options are triggered by the same effect." },
		{ name: "Judgment Order Benefit", effect: "The first time on a turn that you use your Judgment ability to judge a creature, you can teleport up to a number of squares equal to 4." },
	]);
});

test("an ordinary short single-line paragraph is never mistaken for a heading", () => {
	const { effects } = parsePdfAbilityText("Short line.\n\nAnother paragraph.");
	assert.deepEqual(effects, [{ effect: "Short line." }, { effect: "Another paragraph." }]);
});

test("undefined/empty details produce no effects and no trigger", () => {
	assert.deepEqual(parsePdfAbilityText(undefined), { effects: [] });
	assert.deepEqual(parsePdfAbilityText(""), { effects: [] });
});

test("splitComplicationSections splits labeled Benefit/Drawback text into two named entries", () => {
	const sections = splitComplicationSections(
		"War Dog Collar",
		"Benefit: Even if you are a war dog yourself, other war dogs can't use their Posthumous Promotion ability on you while you wear your collar.\n\nDrawback: Each time you use your Posthumous Retirement ability, the Director can spend 3 Malice to make your collar malfunction."
	);
	assert.deepEqual(sections, [
		{ name: "War Dog Collar Benefit", description: "Even if you are a war dog yourself, other war dogs can't use their Posthumous Promotion ability on you while you wear your collar." },
		{ name: "War Dog Collar Drawback", description: "Each time you use your Posthumous Retirement ability, the Director can spend 3 Malice to make your collar malfunction." },
	]);
});

test("splitComplicationSections falls back to one entry when the text isn't labeled", () => {
	assert.deepEqual(splitComplicationSections("War Dog Collar", "Some freeform text."), [
		{ name: "War Dog Collar", description: "Some freeform text." },
	]);
});

test("splitComplicationSections with no details returns a name-only entry", () => {
	assert.deepEqual(splitComplicationSections("War Dog Collar", undefined), [{ name: "War Dog Collar" }]);
});
