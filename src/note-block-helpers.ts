import * as yaml from "js-yaml";

/**
 * Low-level building blocks shared by markdown-builder.ts (ForgeSteel .ds-hero
 * import) and pdf-note-builder.ts (PDF import) so both emit byte-identical
 * Draw Steel Elements codeblock syntax without either module depending on the
 * other's hero-shape-specific logic.
 */

export const FENCE = "~~~";

export const CHARACTERISTIC_SHORTHAND: Record<string, string> = {
	M: "Might",
	A: "Agility",
	R: "Reason",
	I: "Intuition",
	P: "Presence",
};

export function dsBlock(language: string, body: Record<string, unknown>): string {
	const clean = stripUndefined(body);
	const dump = yaml.dump(clean, { lineWidth: -1, noRefs: true }).trimEnd();
	return `${FENCE}${language}\n${dump}\n${FENCE}`;
}

export function stripUndefined<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map(stripUndefined) as unknown as T;
	}
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			if (v === undefined) continue;
			out[k] = stripUndefined(v);
		}
		return out as T;
	}
	return value;
}

/**
 * Tier text (e.g. "5 + P psychic damage") uses single-letter characteristic
 * shorthand for the hero's own bonus damage — only ever appearing right after
 * a "+", sometimes as a choice like "M or A damage" (use whichever is
 * higher). Elsewhere in the same string a letter can appear as part of a
 * potency check instead (e.g. "P < [weak]", meaning "the target resists
 * unless their Presence is less than your weak potency value") — that's left
 * untouched by only matching the "+ <letter>" addition shape; see
 * resolvePotencyThresholds for the "[weak]"/etc. half of that.
 *
 * Per the user's explicit request: substitute the shorthand with the hero's
 * actual characteristic value, but don't fold it into the base damage number
 * — keep them as separate addends so the player can still see how much of
 * the total came from their characteristic.
 */
export function resolveDamageBonusShorthand(text: string | undefined, characteristics: Record<string, number>): string | undefined {
	if (!text) return text;
	return text.replace(/\+ ([MARIP])(?:\s+or\s+([MARIP]))?(?=[^a-zA-Z]|$)/g, (match, c1: string, c2?: string) => {
		const value1 = characteristics[CHARACTERISTIC_SHORTHAND[c1]] ?? 0;
		if (!c2) return `+ ${value1}`;
		const value2 = characteristics[CHARACTERISTIC_SHORTHAND[c2]] ?? 0;
		return `+ ${Math.max(value1, value2)}`;
	});
}

/**
 * "[weak]"/"[average]"/"[strong]" placeholders (e.g. "I < [weak]") stand for
 * the hero's potency values, per the Draw Steel rules: weak = highest
 * characteristic score − 2, average = highest − 1, strong = highest —
 * always based on the hero's single highest characteristic, regardless of
 * which characteristic the target resists with. Once resolved to numbers a
 * player can read the check directly (e.g. "I < 0") without doing the math
 * at the table.
 */
export function resolvePotencyThresholds(text: string | undefined, characteristics: Record<string, number>): string | undefined {
	if (!text) return text;
	const highest = Math.max(...Object.values(characteristics), 0);
	const POTENCY_VALUES: Record<string, number> = {
		weak: highest - 2,
		average: highest - 1,
		strong: highest,
	};
	return text.replace(/\[(weak|average|strong)\]/gi, (match, tier: string) => String(POTENCY_VALUES[tier.toLowerCase()]));
}

export function resolveTierText(text: string | undefined, characteristics: Record<string, number>): string | undefined {
	return resolvePotencyThresholds(resolveDamageBonusShorthand(text, characteristics), characteristics);
}
