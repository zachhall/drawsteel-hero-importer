import { Notice } from "obsidian";
import { PDFCheckBox, PDFDocument, PDFDropdown, PDFField, PDFOptionList, PDFRadioGroup, PDFTextField } from "pdf-lib";

/** One AcroForm field's extracted value, normalized to a plain string regardless of field type (blank/unset fields are omitted, not mapped to ""). */
export type RawPdfFields = Map<string, string>;

/** A multi-line PDF text field's internal line breaks come through as bare "\r" (confirmed against a real filled sheet), not "\n" — left alone, that breaks anything downstream that splits on "\n" (e.g. the Languages field) and shows up as literal "\r" in a YAML-dumped ds-feature effect string. Every extracted value goes through this, not just ones expected to be multi-line, since a field's line-ending convention isn't knowable in advance. */
function normalizeLineEndings(value: string): string {
	return value.replace(/\r\n?/g, "\n");
}

function readFieldValue(field: PDFField): string | undefined {
	if (field instanceof PDFTextField) {
		const text = field.getText();
		return text ? normalizeLineEndings(text) : undefined;
	}
	if (field instanceof PDFCheckBox) return field.isChecked() ? "true" : undefined;
	if (field instanceof PDFDropdown) return field.getSelected()[0];
	if (field instanceof PDFRadioGroup) return field.getSelected();
	if (field instanceof PDFOptionList) return field.getSelected()[0];
	return undefined;
}

/**
 * Extracts every AcroForm field's value from a filled PDF into a flat
 * `fieldName -> value` map. Deliberately dumb — no Draw Steel domain
 * knowledge here; see pdf-hero-parser.ts for turning this into PdfHeroData
 * via the field-name mapping table in pdf-field-map.ts.
 */
export async function extractPdfFields(data: ArrayBuffer): Promise<RawPdfFields> {
	const doc = await PDFDocument.load(data);
	const form = doc.getForm();
	const result: RawPdfFields = new Map();

	for (const field of form.getFields()) {
		const value = readFieldValue(field);
		if (value !== undefined && value !== "") result.set(field.getName(), value);
	}

	return result;
}

/**
 * Dumps every extracted field name/value to the console and a Notice — the
 * only way to learn the MCDM sheet's real AcroForm field names until a
 * sample filled PDF is available (see pdf-field-map.ts). Not wired into the
 * normal import flow; only called when DSHI_PDF_DEBUG is on.
 */
export function debugDumpRawFields(fields: RawPdfFields): void {
	const lines = [...fields.entries()].map(([name, value]) => `${name} = ${value}`);
	console.error("Draw Steel Hero Importer: raw PDF field dump\n" + lines.join("\n"));
	new Notice(`Dumped ${fields.size} PDF field(s) to the console (Ctrl+Shift+I to view).`);
}
