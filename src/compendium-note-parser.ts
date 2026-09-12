/**
 * Scrapes structured data out of DS Compendium note bodies. These notes are
 * plain prose/markdown (bold-label lines, GFM tables) — NOT the plugin's own
 * ds-* codeblocks (see markdown-builder.ts) — so this is a standalone
 * scraper, not a reuse of that renderer's parsing.
 */

/** Slices `body` between the first heading line (any `#` level) `matches` accepts and the next heading of the same or shallower level, or the end of the body. */
function findHeadingSection(body: string, matches: (headingText: string) => boolean): string | undefined {
	const lines = body.split("\n");
	const startIndex = lines.findIndex((line) => {
		const match = /^(#+)\s+(.*)$/.exec(line.trim());
		return !!match && matches(match[2].trim());
	});
	if (startIndex === -1) return undefined;

	const startLevel = /^(#+)/.exec(lines[startIndex].trim())![1].length;
	let endIndex = lines.length;
	for (let i = startIndex + 1; i < lines.length; i++) {
		const match = /^(#+)\s+/.exec(lines[i].trim());
		if (match && match[1].length <= startLevel) {
			endIndex = i;
			break;
		}
	}

	return lines.slice(startIndex + 1, endIndex).join("\n").trim();
}

/** Slices `body` between one heading line matching `headingText` exactly (any `#` level, case-insensitive) and the next heading of the same or shallower level, or the end of the body. */
export function extractSection(body: string, headingText: string): string | undefined {
	return findHeadingSection(body, (h) => h.toLowerCase() === headingText.toLowerCase());
}

/**
 * DS Compendium Ancestry notes head each trait with extra text around the
 * bare trait name a PDF sheet's "Perks 1" field never carries — a
 * "Signature Trait: " prefix (e.g. "Signature Trait: Relentless") and a
 * trailing point cost (e.g. "Bloodfire Rush (1 Point)"). Class feature
 * headings (e.g. "Wrath", "Oracular Visions") already match as-is. Stripping
 * both lets one heading search work for either.
 */
function normalizeFeatureHeading(heading: string): string {
	return heading
		.replace(/^(?:signature trait|purchased [\w\s]+ traits?):?\s*/i, "")
		.replace(/\s*\(\d+\s*points?\)\s*$/i, "")
		.trim()
		.toLowerCase();
}

/**
 * Finds a named Ancestry trait or Class feature's own section in a DS
 * Compendium `Ancestries/<Name>.md` or `Classes/<Name>.md` note — both file
 * shapes are one note per Ancestry/Class with every trait/feature as its own
 * heading at whatever level it happens to sit at (see
 * normalizeFeatureHeading for why an Ancestry trait's heading text needs
 * normalizing first, unlike a class feature's). Returns undefined if no
 * heading matches `name` — the caller renders that item name-only rather
 * than treating a lookup miss as an error (see pdf-compendium-resolver.ts).
 */
export function findNamedFeatureSection(body: string, name: string): string | undefined {
	const target = name.trim().toLowerCase();
	return findHeadingSection(body, (h) => normalizeFeatureHeading(h) === target);
}

/** Parses `**Label:** value` lines anywhere in `body` into `{ Label: "value" }`. A label's value can run to the end of its line only — multi-line prose under a label isn't captured here. */
export function parseBoldLabelLines(body: string): Record<string, string> {
	const result: Record<string, string> = {};
	const pattern = /^\s*\*\*([^*:]+):?\*\*:?\s*(.+)$/gm;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(body))) {
		const label = match[1].trim();
		const value = match[2].trim();
		if (label && value) result[label] = value;
	}
	return result;
}

export interface ParsedTable {
	headers: string[];
	rows: string[][];
}

/** Parses the first GFM pipe-table found in `body` (kit Signature Ability stat block, career Inciting Incident chart, etc.). Returns undefined if no table is present. */
export function parseGfmTable(body: string): ParsedTable | undefined {
	const lines = body.split("\n").map((l) => l.trim());
	const headerIndex = lines.findIndex((line, i) => line.startsWith("|") && /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(lines[i + 1] ?? ""));
	if (headerIndex === -1) return undefined;

	const splitRow = (line: string): string[] =>
		line
			.replace(/^\|/, "")
			.replace(/\|$/, "")
			.split("|")
			.map((cell) => cell.trim());

	const headers = splitRow(lines[headerIndex]);
	const rows: string[][] = [];
	for (let i = headerIndex + 2; i < lines.length && lines[i].startsWith("|"); i++) {
		rows.push(splitRow(lines[i]));
	}

	return { headers, rows };
}

export interface ParsedKitBonuses {
	speedBonus?: string;
	staminaBonus?: string;
	stabilityBonus?: string;
	meleeDamageBonus?: string;
	rangedDamageBonus?: string;
	meleeDistanceBonus?: string;
	rangedDistanceBonus?: string;
	disengageBonus?: string;
}

/** Reads the "Kit Bonuses" section's bold-label lines (e.g. "**Speed Bonus:** +1") — kept as raw text (e.g. "+2/+2/+2" for tiered damage) rather than force-split, since nothing downstream needs the tiers separated yet. */
export function parseKitBonuses(body: string): ParsedKitBonuses {
	const section = extractSection(body, "Kit Bonuses") ?? body;
	const labels = parseBoldLabelLines(section);
	return {
		speedBonus: labels["Speed Bonus"],
		staminaBonus: labels["Stamina Bonus"],
		stabilityBonus: labels["Stability Bonus"],
		meleeDamageBonus: labels["Melee Damage Bonus"],
		rangedDamageBonus: labels["Ranged Damage Bonus"],
		meleeDistanceBonus: labels["Melee Distance Bonus"],
		rangedDistanceBonus: labels["Ranged Distance Bonus"],
		disengageBonus: labels["Disengage Bonus"],
	};
}

export interface ParsedSignatureAbility {
	name?: string;
	table?: ParsedTable;
	powerRollText?: string;
}

/** Reads a kit's "Signature Ability" section: its name (a standalone bold line or heading before the stat table), the stat table, and the "**Power Roll + ...**" bullet list that follows — kept as raw markdown since it's rendered as prose, not re-parsed into a ds-feature block (see pdf-note-builder.ts). */
export function parseSignatureAbility(body: string): ParsedSignatureAbility | undefined {
	const section = extractSection(body, "Signature Ability");
	if (!section) return undefined;

	const nameMatch = /^(?:#+\s+|\*\*)([^*\n]+?)(?:\*\*)?\s*$/m.exec(section);
	const table = parseGfmTable(section);
	const powerRollMatch = /\*\*Power Roll[^*]*\*\*[\s\S]*/i.exec(section);

	return {
		name: nameMatch?.[1]?.trim(),
		table,
		powerRollText: powerRollMatch?.[0]?.trim(),
	};
}

/** A kit note's own equipment listing (whatever gear that specific kit grants), if it has one — label wording isn't verified against a real kit note beyond "Kit Bonuses"/"Signature Ability", so this tries a few plausible labels rather than assuming one. */
export function parseKitEquipment(body: string): string | undefined {
	const labels = parseBoldLabelLines(body);
	return labels["Equipment"] ?? labels["Starting Equipment"] ?? labels["Kit Equipment"];
}

export interface ParsedCareerInfo {
	skillsText?: string;
	languagesText?: string;
	perkText?: string;
}

export function parseCareerInfo(body: string): ParsedCareerInfo {
	const labels = parseBoldLabelLines(body);
	return {
		skillsText: labels["Skills"],
		languagesText: labels["Languages"],
		perkText: labels["Perk"],
	};
}
