import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import * as yaml from "js-yaml";
import { ROOT } from "./helpers.mjs";
import { importTs } from "./ts-loader.mjs";

const {
	buildFrontmatter,
	buildCharacteristicsBlock,
	buildVitalsBlock,
	buildResourcesBlock,
	buildStatisticsBlock,
	buildSkillsBlock,
	sourceEffects,
	abilityToFeatureBlock,
	noteAbilitySortKey,
	renderActionsGroup,
} = await importTs(join(ROOT, "src/note-model.ts"));

const CHARACTERISTICS = { Might: 2, Agility: -1, Reason: 1, Intuition: 0, Presence: 3 };

test("buildFrontmatter includes exactly the expected key set", () => {
	const fm = buildFrontmatter({
		name: "Test Hero",
		ancestryName: "Orc",
		className: "Censor",
		level: 1,
		characteristics: CHARACTERISTICS,
		victories: 2,
		xp: 10,
		maxStamina: 30,
		speed: 5,
	});
	const parsed = yaml.load(fm);
	assert.deepEqual(Object.keys(parsed).sort(), [
		"agility",
		"ancestry",
		"class",
		"ds_hero",
		"intuition",
		"level",
		"might",
		"name",
		"presence",
		"reason",
		"speed",
		"victories",
		"xp",
		"max_stamina",
	].sort());
	assert.equal(parsed.name, "Test Hero");
	assert.equal(parsed.might, 2);
});

test("buildFrontmatter drops undefined ancestry/class rather than emitting null", () => {
	const fm = buildFrontmatter({
		name: "Test Hero",
		level: 1,
		characteristics: CHARACTERISTICS,
		victories: 0,
		xp: 0,
		maxStamina: 10,
		speed: 5,
	});
	const parsed = yaml.load(fm);
	assert.equal("ancestry" in parsed, false);
	assert.equal("class" in parsed, false);
});

test("buildCharacteristicsBlock and buildVitalsBlock produce their expected ds-* fence", () => {
	assert.match(buildCharacteristicsBlock(CHARACTERISTICS), /^~~~ds-characteristics\n/);
	assert.match(buildVitalsBlock({ maxStamina: 30, currentStamina: 25, tempStamina: 2 }), /^~~~ds-stamina\n/);
});

test("buildResourcesBlock chunks into rows of 3, with a partial final row", () => {
	const entries = [
		["A", 1],
		["B", 2],
		["C", 3],
		["D", 4],
		["E", 5],
	];
	const block = buildResourcesBlock(entries);
	const rowCount = (block.match(/dshi-resource-row/g) || []).length;
	assert.equal(rowCount, 2);
	assert.match(block, /name: A/);
	assert.match(block, /name: E/);
});

test("buildResourcesBlock handles exactly one row (boundary at 3)", () => {
	const block = buildResourcesBlock([
		["A", 1],
		["B", 2],
		["C", 3],
	]);
	const rowCount = (block.match(/dshi-resource-row/g) || []).length;
	assert.equal(rowCount, 1);
});

test("buildStatisticsBlock renders all five stats", () => {
	const block = buildStatisticsBlock({ speed: 5, stability: 1, disengage: 1, freeStrike: 2, size: "1M" });
	assert.match(block, /Speed: 5/);
	assert.match(block, /Size: 1M/);
});

test("buildSkillsBlock returns undefined for an empty list", () => {
	assert.equal(buildSkillsBlock([]), undefined);
});

test("buildSkillsBlock splits official vs custom skills", () => {
	const block = buildSkillsBlock(["Alertness", "Strategy"]);
	const parsed = yaml.load(block.replace(/^~~~ds-skills\n/, "").replace(/\n~~~$/, ""));
	assert.ok(parsed.skills.includes("alertness"));
	assert.ok(parsed.custom_skills.some((s) => s.name === "Strategy"));
});

test("sourceEffects formats the displaySource prefix as an em dash", () => {
	const effects = sourceEffects("Kit: Rapid Fire");
	assert.deepEqual(effects[0], { effect: "---" });
	assert.deepEqual(effects[1], { name: "Source", effect: "*Kit — Rapid Fire*" });
});

test("abilityToFeatureBlock formats cost with resourceName, omits it for signature abilities", () => {
	const signature = abilityToFeatureBlock({
		name: "Test Sig",
		isSignature: true,
		cost: 0,
		usage: "Main Action",
		effects: [],
		displaySource: "Class: Censor",
	});
	assert.equal(signature.ability_type, "Signature Ability");
	assert.equal(signature.cost, undefined);

	const costed = abilityToFeatureBlock({
		name: "Test Costed",
		isSignature: false,
		cost: 3,
		resourceName: "Wrath",
		usage: "Main Action",
		effects: [],
		displaySource: "Class: Censor",
	});
	assert.equal(costed.cost, "3 Wrath");
	assert.equal(costed.ability_type, undefined);
});

test("noteAbilitySortKey: signature first, then zero-cost, then ascending cost", () => {
	const sig = { isSignature: true, cost: undefined };
	const free = { isSignature: false, cost: undefined };
	const cheap = { isSignature: false, cost: 3 };
	const expensive = { isSignature: false, cost: 7 };
	const keys = [expensive, cheap, sig, free].map(noteAbilitySortKey);
	const sorted = [...keys].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	assert.deepEqual(sorted, [noteAbilitySortKey(sig), noteAbilitySortKey(free), noteAbilitySortKey(cheap), noteAbilitySortKey(expensive)]);
});

test("renderActionsGroup buckets by usage and drops empty buckets", () => {
	const abilities = [
		{ name: "A", isSignature: true, usage: "Main Action", effects: [], displaySource: "Class: Censor" },
		{ name: "B", isSignature: false, cost: 3, usage: "Maneuver", effects: [], displaySource: "Class: Censor" },
		{ name: "C", isSignature: false, usage: "Something Weird", effects: [], displaySource: "Class: Censor" },
	];
	const rendered = renderActionsGroup(abilities);
	assert.match(rendered, /### Main Action/);
	assert.match(rendered, /### Maneuver/);
	assert.match(rendered, /### Other/);
	assert.doesNotMatch(rendered, /### Move Action/);
	assert.doesNotMatch(rendered, /### Triggered Action/);
});

test("renderActionsGroup prepends otherRendered content before the buckets", () => {
	const rendered = renderActionsGroup([{ name: "A", isSignature: true, usage: "Main Action", effects: [], displaySource: "Class: X" }], ["PREPENDED"]);
	assert.ok(rendered.startsWith("PREPENDED"));
});
