import { test } from "node:test";
import assert from "node:assert/strict";
import {
	extractSection,
	findNamedFeatureSection,
	parseBoldLabelLines,
	parseCareerInfo,
	parseGfmTable,
	parseKitBonuses,
	parseKitEquipment,
	parseSignatureAbility,
} from "../src/compendium-note-parser.ts";

// Fixtures modeled on the real DS Compendium notes (Rules/Kits/Arcane Archer.md, Rules/Careers/Agent.md).

const KIT_BODY = `
#### Arcane Archer

Some flavor text about the kit.

##### Kit Bonuses

**Speed Bonus:** +1
**Ranged Damage Bonus:** +2/+2/+2

##### Signature Ability

**Arcane Shot**

| Keywords | Action Type | Range | Target |
| --- | --- | --- | --- |
| Magic, Ranged | Main Action | 10 | One creature |

**Power Roll + Reason**
- 11 or lower: 2 damage
- 12-16: 4 damage
- 17+: 6 damage
`;

const CAREER_BODY = `
#### Agent

Some flavor text.

**Skills:** Alertness, Stealth
**Languages:** Common, one of your choice
**Perk:** Fast Talker

| Roll | Inciting Incident |
| --- | --- |
| 1 | You were a spy. |
| 2 | You were a informant. |
`;

test("parseBoldLabelLines extracts bold-label lines", () => {
	assert.deepEqual(parseBoldLabelLines("**Speed Bonus:** +1\n**Ranged Damage Bonus:** +2/+2/+2"), {
		"Speed Bonus": "+1",
		"Ranged Damage Bonus": "+2/+2/+2",
	});
});

test("extractSection slices between one heading and the next of the same or shallower level", () => {
	const section = extractSection(KIT_BODY, "Kit Bonuses");
	assert.match(section, /Speed Bonus/);
	assert.doesNotMatch(section, /Signature Ability/);
});

test("extractSection returns undefined when the heading isn't present", () => {
	assert.equal(extractSection(KIT_BODY, "Nonexistent Heading"), undefined);
});

test("parseGfmTable parses a pipe table's headers and rows", () => {
	const table = parseGfmTable(KIT_BODY);
	assert.deepEqual(table.headers, ["Keywords", "Action Type", "Range", "Target"]);
	assert.deepEqual(table.rows, [["Magic, Ranged", "Main Action", "10", "One creature"]]);
});

test("parseKitBonuses reads bold-label lines scoped to the Kit Bonuses section", () => {
	const bonuses = parseKitBonuses(KIT_BODY);
	assert.equal(bonuses.speedBonus, "+1");
	assert.equal(bonuses.rangedDamageBonus, "+2/+2/+2");
	assert.equal(bonuses.staminaBonus, undefined);
});

test("parseSignatureAbility reads the ability name, table, and power roll text", () => {
	const ability = parseSignatureAbility(KIT_BODY);
	assert.equal(ability.name, "Arcane Shot");
	assert.equal(ability.table.headers.length, 4);
	assert.match(ability.powerRollText, /Power Roll \+ Reason/);
	assert.match(ability.powerRollText, /17\+: 6 damage/);
});

test("parseKitEquipment reads whichever plausible equipment label is present", () => {
	assert.equal(parseKitEquipment("**Equipment:** Longbow, quiver of arrows"), "Longbow, quiver of arrows");
	assert.equal(parseKitEquipment("**Starting Equipment:** Shortsword"), "Shortsword");
	assert.equal(parseKitEquipment("no equipment line here"), undefined);
});

test("parseCareerInfo reads Skills/Languages/Perk bold-label lines", () => {
	const info = parseCareerInfo(CAREER_BODY);
	assert.equal(info.skillsText, "Alertness, Stealth");
	assert.equal(info.languagesText, "Common, one of your choice");
	assert.equal(info.perkText, "Fast Talker");
});

// Fixture modeled on the real DS Compendium notes Rules/Ancestries/Orc.md
// and Rules/Classes/Censor.md — the heading-noise findNamedFeatureSection
// has to strip is real, not hypothetical (see its own doc comment).
const ANCESTRY_BODY = `
### Orc Traits

#### Signature Trait: Relentless

Free strike text.

#### Purchased Orc Traits

##### Bloodfire Rush (1 Point)

Speed bonus text.

##### Glowing Recovery (2 Points)

Recovery text.
`;

const CLASS_BODY = `
#### Wrath

Resource text.

##### Wrath in Combat

Combat-only wrath text.

#### Judgment

Judgment text.
`;

test("findNamedFeatureSection matches a plain trait name against a 'Signature Trait: ' heading", () => {
	assert.match(findNamedFeatureSection(ANCESTRY_BODY, "Relentless"), /Free strike text/);
});

test("findNamedFeatureSection matches a plain trait name against a '(N Point(s))' heading", () => {
	assert.match(findNamedFeatureSection(ANCESTRY_BODY, "Bloodfire Rush"), /Speed bonus text/);
	assert.match(findNamedFeatureSection(ANCESTRY_BODY, "Glowing Recovery"), /Recovery text/);
});

test("findNamedFeatureSection matches a class feature heading as-is and stops at the next same-or-shallower heading", () => {
	const section = findNamedFeatureSection(CLASS_BODY, "Wrath");
	assert.match(section, /Resource text/);
	// "Wrath in Combat" is a deeper heading nested under "Wrath" — included.
	assert.match(section, /Combat-only wrath text/);
	// "Judgment" is the next heading at the same level as "Wrath" — excluded.
	assert.doesNotMatch(section, /Judgment text/);
});

test("findNamedFeatureSection returns undefined when no heading matches", () => {
	assert.equal(findNamedFeatureSection(ANCESTRY_BODY, "Nonexistent Trait"), undefined);
});
