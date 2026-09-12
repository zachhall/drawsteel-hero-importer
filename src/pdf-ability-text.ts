/**
 * Turns a PDF ability's free-text "Details" blob (see pdf-ability-grid.ts —
 * one field per grid cell, containing the whole ability's rules text exactly
 * as filled on the sheet) into the same structured `effects` shape
 * ForgeSteel abilities already get from markdown-builder.ts's mapSections —
 * a `roll`/`tier1`/`tier2`/`tier3` entry per power roll, plain `{effect}`
 * entries for prose, `{name, cost, effect}` for a "Spend N: ..." benefit, and
 * a top-level `trigger` string pulled out of a leading "Trigger: ..." line.
 * Confirmed against a real filled sheet (a level 1 Censor "Hellic") compared
 * directly to that same hero's independently-built ForgeSteel golden fixture
 * (tests/fixtures/hellic.golden.md) — every shape here was checked against
 * that ground truth, not just checked for "doesn't crash" structural
 * validity, after an initial version of the PDF import path shipped the
 * whole Details blob as one opaque `{effect}` string and lost the tier
 * roll's clickable-roll behavior entirely.
 *
 * Unlike ForgeSteel's export (which already hands sections apart as typed
 * JSON — see DsAbilitySection), a PDF sheet's Details field is unstructured
 * prose, so this parses it: paragraphs (blank-line-separated blocks) are the
 * unit of structure, since every distinct clause on the sheet (a Trigger
 * line, a roll formula, a tier list, an "Effect:"/"Spend N:" clause, a plain
 * paragraph) reliably sits in its own paragraph.
 */

const ROLL_LINE = /^Power Roll\s*\+/i;
const TIER_LINE = /^Tier\s*([123])\s*:\s*(.*)$/i;
/** A short "Word:" (or "Two Words:") line with nothing else on it — the label ("Melee:"/"Ranged:") a multi-variant power roll uses ahead of its own Tier 1/2/3 lines (see Purifying Fire in the doc comment above). */
const LABEL_LINE = /^([A-Za-z][\w /]{0,20}):\s*$/;
const SPEND_LINE = /^Spend\s+(\d+)\s*:\s*([\s\S]+)$/i;
const EFFECT_LABEL = /^Effect:\s*/i;
const TRIGGER_LABEL = /^Trigger:\s*/i;
/** A short, punctuation-free line shaped like a sub-heading (e.g. "Judgment Order Benefit") — see looksLikeHeading below for the Title Case check that actually gates on this, since the punctuation-free shape alone also matches an ordinary short imperative sentence with no terminal period (e.g. "Enemy is knocked prone"). Deliberately excludes ":" so it never matches a LABEL_LINE, and excludes normal sentence punctuation. */
const HEADING_SHAPE = /^[A-Z][A-Za-z0-9 '’()-]{2,59}$/;

/**
 * A real sub-heading in this rules text is conventionally Title Case (every
 * significant word capitalized, e.g. "Judgment Order Benefit") — an ordinary
 * declarative sentence only capitalizes its first word (e.g. "Enemy is
 * knocked prone"), which HEADING_SHAPE's punctuation-free check alone can't
 * tell apart from a real heading. Requiring most words to start with a
 * capital catches that case without needing terminal punctuation as the only
 * signal. Single-word "headings" are deliberately never matched here — with
 * no second capitalized word to confirm Title Case, there's no reliable way
 * to tell one from a short sentence, so it's left as plain prose instead.
 */
function looksLikeHeading(line: string): boolean {
	if (!HEADING_SHAPE.test(line)) return false;
	const words = line.split(/\s+/);
	if (words.length < 2) return false;
	const capitalizedWords = words.filter((w) => /^[A-Z]/.test(w)).length;
	return capitalizedWords >= words.length - 1;
}

function cleanParagraph(text: string): string {
	return text
		.split("\n")
		.map((l) => l.trim())
		.join("\n")
		.trim();
}

function splitParagraphs(text: string): string[] {
	return text
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);
}

/**
 * Scans a tier-group paragraph's lines for one or more label+Tier-1/2/3
 * groups. Most abilities have exactly one unlabeled group (just three "Tier
 * N:" lines); a multi-distance ability (e.g. Purifying Fire's Melee/Ranged
 * split) has two, each preceded by its own "Melee:"/"Ranged:" label line —
 * folded into the `roll` text itself (e.g. "Melee — Power Roll + 2") since
 * ds-feature's schema has no separate field for it. Returns undefined if the
 * paragraph doesn't actually start with a recognizable tier group, so the
 * caller can fall back to keeping the roll line as plain text rather than
 * silently dropping it.
 */
function parseTierGroups(paragraph: string, rollText: string): Record<string, unknown>[] | undefined {
	const lines = paragraph.split("\n").map((l) => l.trim());
	const groups: Record<string, unknown>[] = [];
	let i = 0;

	while (i < lines.length) {
		let label: string | undefined;
		const labelMatch = LABEL_LINE.exec(lines[i]);
		if (labelMatch && TIER_LINE.test(lines[i + 1] ?? "")) {
			label = labelMatch[1];
			i++;
		}

		const t1 = TIER_LINE.exec(lines[i] ?? "");
		if (!t1 || t1[1] !== "1") break;
		const t2 = TIER_LINE.exec(lines[i + 1] ?? "");
		const t3 = TIER_LINE.exec(lines[i + 2] ?? "");
		if (!t2 || t2[1] !== "2" || !t3 || t3[1] !== "3") break;

		groups.push({
			roll: label ? `${label} — ${rollText}` : rollText,
			tier1: t1[2].trim(),
			tier2: t2[2].trim(),
			tier3: t3[2].trim(),
		});
		i += 3;
	}

	if (!groups.length) return undefined;

	// Anything left after the last recognized tier group (e.g. a trailing
	// clause glued directly onto Tier 3 with no blank line of its own) would
	// otherwise be silently discarded — the caller consumes this whole
	// paragraph once any groups come back, trailing lines included.
	const trailing = lines.slice(i).join("\n").trim();
	if (trailing) groups.push({ effect: trailing });

	return groups;
}

export interface ParsedPdfAbilityText {
	trigger?: string;
	effects: Record<string, unknown>[];
}

export function parsePdfAbilityText(details: string | undefined): ParsedPdfAbilityText {
	if (!details) return { effects: [] };

	const paragraphs = splitParagraphs(details);

	let trigger: string | undefined;
	if (paragraphs.length && TRIGGER_LABEL.test(paragraphs[0])) {
		trigger = cleanParagraph(paragraphs.shift()!.replace(TRIGGER_LABEL, ""));
	}

	const effects: Record<string, unknown>[] = [];
	for (let i = 0; i < paragraphs.length; i++) {
		const paragraph = paragraphs[i];
		const lines = paragraph.split("\n");

		if (lines.length === 1 && ROLL_LINE.test(paragraph)) {
			const rollText = paragraph.trim();
			const groups = paragraphs[i + 1] ? parseTierGroups(paragraphs[i + 1], rollText) : undefined;
			if (groups) {
				effects.push(...groups);
				i++; // also consumed the tier-group paragraph
			} else {
				// No recognizable tier group followed — keep the roll line as plain text rather than lose it.
				effects.push({ effect: rollText });
			}
			continue;
		}

		const spendMatch = SPEND_LINE.exec(paragraph);
		if (spendMatch) {
			effects.push({ name: "Spend", cost: spendMatch[1], effect: cleanParagraph(spendMatch[2]) });
			continue;
		}

		// A short sub-heading as its own standalone paragraph (e.g. "Judgment
		// Order Benefit" on its own line, blank-line-separated both sides) names
		// the *next* paragraph — confirmed against a real sheet, where this is
		// the actual shape (not glued onto the previous paragraph, as an
		// earlier reading of the raw field text had wrongly assumed).
		if (lines.length === 1 && looksLikeHeading(paragraph) && paragraphs[i + 1]) {
			const next = paragraphs[++i];
			effects.push({ name: paragraph, effect: cleanParagraph(next.replace(EFFECT_LABEL, "")) });
			continue;
		}

		// A sub-heading glued onto the end of the previous paragraph with no
		// blank line of its own — split it off as its own named entry over the
		// *next* paragraph, rather than leaving it buried mid-string inside one
		// giant `effect` blob. Kept alongside the standalone case above since a
		// different sheet, or a different field, may format it either way.
		const lastLine = lines[lines.length - 1].trim();
		if (lines.length > 1 && looksLikeHeading(lastLine) && paragraphs[i + 1]) {
			const body = cleanParagraph(lines.slice(0, -1).join("\n"));
			if (body) effects.push({ effect: body });
			const next = paragraphs[++i];
			effects.push({ name: lastLine, effect: cleanParagraph(next.replace(EFFECT_LABEL, "")) });
			continue;
		}

		effects.push({ effect: cleanParagraph(paragraph.replace(EFFECT_LABEL, "")) });
	}

	return { trigger, effects };
}

/**
 * Splits a Complication's Benefit/Drawback prose into two separate named
 * trait entries when the text is labeled that way — matches ForgeSteel's own
 * shape for a hero's actual Complication feature data (two separate
 * ds-feature blocks, "<name> Benefit"/"<name> Drawback"), confirmed against
 * a real Hellic .ds-hero export's golden fixture. Falls back to one `name`
 * entry holding the whole text verbatim when it isn't labeled that way.
 */
export function splitComplicationSections(name: string, details: string | undefined): { name: string; description?: string }[] {
	if (!details) return [{ name }];

	const labeled = splitParagraphs(details)
		.map((p) => /^(Benefit|Drawback)\s*:\s*([\s\S]*)$/i.exec(p))
		.filter((m): m is RegExpExecArray => !!m)
		.map((m) => ({ label: m[1], text: cleanParagraph(m[2]) }));

	if (!labeled.length) return [{ name, description: details.trim() }];

	return labeled.map(({ label, text }) => ({
		name: `${name} ${label[0].toUpperCase()}${label.slice(1).toLowerCase()}`,
		description: text,
	}));
}
