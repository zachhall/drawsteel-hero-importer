import { RawPdfFields } from "./pdf-field-extractor";
import { PdfAbility } from "./pdf-hero-types";

/**
 * The MCDM sheet lays abilities out as a grid — "Ability Name.<row>.<col>"
 * plus parallel "Ability Action/Cost/Target/Distance/Keywords/Details.<row>.
 * <col>" fields — rather than a flat numbered list, so this scans that grid
 * shape directly instead of going through PDF_FIELD_MAP's simple name->value
 * lookup. The per-ability resource category (e.g. "Signature", "Heroic",
 * "Free Strike") is its own oddly-named field, confirmed against a real
 * filled sheet (a level 1 Censor "Hellic"): row 0 is "Ability Type.<col>",
 * row 1 is "Ability Type1.<col>", row 2 is "Ability Type2.<col>" — the row
 * number is folded into the field-name prefix instead of forming a shared
 * ".<row>." infix the way every other grid field does, and it's genuinely
 * per-cell, not one label applied to the whole row (that sample sheet has
 * three different types within a single row).
 *
 * Bounded generously past the 3x3 grid seen on the one sample sheet
 * available so far, in case another class's sheet has more rows/columns;
 * a cell with no "Ability Name" entry is simply absent, not an empty ability.
 */
const MAX_GRID_SIZE = 6;

export function extractAbilities(raw: RawPdfFields): PdfAbility[] {
	const abilities: PdfAbility[] = [];

	for (let row = 0; row < MAX_GRID_SIZE; row++) {
		const typePrefix = row === 0 ? "Ability Type" : `Ability Type${row}`;
		for (let col = 0; col < MAX_GRID_SIZE; col++) {
			const name = raw.get(`Ability Name.${row}.${col}`);
			if (!name) continue;

			const keywordsText = raw.get(`Ability Keywords.${row}.${col}`);
			abilities.push({
				name,
				type: raw.get(`${typePrefix}.${col}`),
				action: raw.get(`Ability Action.${row}.${col}`),
				cost: raw.get(`Ability Cost.${row}.${col}`),
				target: raw.get(`Ability Target.${row}.${col}`),
				distance: raw.get(`Ability Distance.${row}.${col}`),
				keywords: keywordsText
					? keywordsText.split(",").map((k) => k.trim()).filter(Boolean)
					: undefined,
				details: raw.get(`Ability Details.${row}.${col}`),
			});
		}
	}

	return abilities;
}
