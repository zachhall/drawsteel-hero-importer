/**
 * The skill list the `draw-steel-elements` plugin's `ds-skills` element
 * actually validates against — copied from its own
 * `src/model/schemas/SkillsSchema.yaml` `skills` enum (case-insensitive;
 * the schema lowercases before checking).
 *
 * This is NOT quite the full official Draw Steel rules skill list: as of
 * this writing, draw-steel-elements' schema is missing "Carpentry" and
 * "Cooking" (Crafting) and "Strategy" (Lore) — all three are real skills
 * (confirmed against ForgeSteel's sourcebook data, and "Strategy" is one of
 * the hero's actual selections in our Hellic test fixture). Since the goal
 * here is a `ds-skills` block that renders without a validation error, we
 * match what the *consuming plugin* accepts, not the rulebook — anything
 * not in this list (including those three) is routed to `custom_skills`
 * instead. Revisit if/when draw-steel-elements adds them upstream.
 *
 * A .ds-hero file stores every chosen skill as a bare string, whether it's
 * one of these or a fully custom skill the player typed in during character
 * creation (ForgeSteel's `FeatureSkillChoiceData.selected` is just
 * `string[]` — there's no structural marker distinguishing the two). This
 * list is what lets the importer tell them apart.
 */
export const OFFICIAL_SKILLS: { name: string; group: string }[] = [
	{ name: "alchemy", group: "Crafting" },
	{ name: "architecture", group: "Crafting" },
	{ name: "blacksmithing", group: "Crafting" },
	{ name: "fletching", group: "Crafting" },
	{ name: "forgery", group: "Crafting" },
	{ name: "jewelry", group: "Crafting" },
	{ name: "mechanics", group: "Crafting" },
	{ name: "tailoring", group: "Crafting" },
	{ name: "climb", group: "Exploration" },
	{ name: "drive", group: "Exploration" },
	{ name: "endurance", group: "Exploration" },
	{ name: "gymnastics", group: "Exploration" },
	{ name: "heal", group: "Exploration" },
	{ name: "jump", group: "Exploration" },
	{ name: "lift", group: "Exploration" },
	{ name: "navigate", group: "Exploration" },
	{ name: "ride", group: "Exploration" },
	{ name: "swim", group: "Exploration" },
	{ name: "brag", group: "Interpersonal" },
	{ name: "empathize", group: "Interpersonal" },
	{ name: "flirt", group: "Interpersonal" },
	{ name: "gamble", group: "Interpersonal" },
	{ name: "handle animals", group: "Interpersonal" },
	{ name: "interrogate", group: "Interpersonal" },
	{ name: "intimidate", group: "Interpersonal" },
	{ name: "lead", group: "Interpersonal" },
	{ name: "lie", group: "Interpersonal" },
	{ name: "music", group: "Interpersonal" },
	{ name: "perform", group: "Interpersonal" },
	{ name: "persuade", group: "Interpersonal" },
	{ name: "read person", group: "Interpersonal" },
	{ name: "alertness", group: "Intrigue" },
	{ name: "conceal object", group: "Intrigue" },
	{ name: "disguise", group: "Intrigue" },
	{ name: "eavesdrop", group: "Intrigue" },
	{ name: "escape artist", group: "Intrigue" },
	{ name: "hide", group: "Intrigue" },
	{ name: "pick lock", group: "Intrigue" },
	{ name: "pick pocket", group: "Intrigue" },
	{ name: "sabotage", group: "Intrigue" },
	{ name: "search", group: "Intrigue" },
	{ name: "sneak", group: "Intrigue" },
	{ name: "track", group: "Intrigue" },
	{ name: "culture", group: "Lore" },
	{ name: "criminal underworld", group: "Lore" },
	{ name: "history", group: "Lore" },
	{ name: "magic", group: "Lore" },
	{ name: "monsters", group: "Lore" },
	{ name: "nature", group: "Lore" },
	{ name: "psionics", group: "Lore" },
	{ name: "religion", group: "Lore" },
	{ name: "rumors", group: "Lore" },
	{ name: "society", group: "Lore" },
	{ name: "timescape", group: "Lore" },
];

const OFFICIAL_SKILLS_BY_LOWER_NAME = new Map(OFFICIAL_SKILLS.map((s) => [s.name.toLowerCase(), s]));

/** Looks up a skill name against draw-steel-elements' accepted list, case-insensitively. */
export function findOfficialSkill(name: string): { name: string; group: string } | undefined {
	return OFFICIAL_SKILLS_BY_LOWER_NAME.get(name.trim().toLowerCase());
}

/**
 * Real Draw Steel skills that draw-steel-elements' schema doesn't accept yet
 * (see the note above). These still need to render as `custom_skills` to
 * avoid the validation error, but unlike a hero's actual invented skills we
 * know their real skill group, so they can be placed correctly instead of
 * falling into an unlabeled "Custom Skills" bucket.
 */
const KNOWN_UNSUPPORTED_SKILLS_BY_LOWER_NAME = new Map(
	[
		{ name: "Carpentry", group: "Crafting" },
		{ name: "Cooking", group: "Crafting" },
		{ name: "Strategy", group: "Lore" },
	].map((s) => [s.name.toLowerCase(), s])
);

/** Looks up the correct skill group for a real-but-unsupported skill (see above), if any. */
export function findKnownUnsupportedSkillGroup(name: string): string | undefined {
	return KNOWN_UNSUPPORTED_SKILLS_BY_LOWER_NAME.get(name.trim().toLowerCase())?.group;
}
