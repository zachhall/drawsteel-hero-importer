import { parseYaml, stringifyYaml } from "obsidian";

/**
 * Runtime (in-app) schema for a `~~~dshi-counter-row~~~` codeblock — 2-3
 * counters rendered as real DOM siblings in one container this plugin fully
 * controls, so Reading View lays them out in one row without any post-render
 * DOM patching (see src/counter-row-view.ts and styles.css's `.dshi-counter-
 * row` section for why this replaced an earlier, more fragile approach).
 *
 * Field names and defaulting deliberately mirror draw-steel-elements' own
 * `ds-counter` schema (confirmed against its compiled `Counter.parse` in
 * main.js — `current_value`/`min_value` default to 0, `max_value` stays
 * optional/undefined) so this reads as "multiple ds-counters," not a
 * competing schema shape.
 */
export interface CounterRowEntry {
	name: string;
	current_value: number;
	min_value: number;
	max_value?: number;
}

export interface CounterRowData {
	counters: CounterRowEntry[];
}

export function parseCounterRow(source: string): CounterRowData {
	const data = parseYaml(source) as { counters?: unknown } | undefined;
	if (!data || !Array.isArray(data.counters) || data.counters.length === 0) {
		throw new Error("A dshi-counter-row block needs a non-empty `counters` list.");
	}

	const counters: CounterRowEntry[] = (data.counters as Record<string, unknown>[]).map((c) => ({
		name: typeof c.name === "string" ? c.name : "",
		current_value: typeof c.current_value === "number" ? c.current_value : 0,
		min_value: typeof c.min_value === "number" ? c.min_value : 0,
		max_value: typeof c.max_value === "number" ? c.max_value : undefined,
	}));

	return { counters };
}

/** Uses Obsidian's own YAML stringifier (matching draw-steel-elements' own write-back, `stringifyYaml`) rather than js-yaml — this module only runs inside the app, never at Note-generation time (see note-model.ts, which builds the initial block via dsBlock/js-yaml instead). */
export function stringifyCounterRow(data: CounterRowData): string {
	return stringifyYaml(data).trim();
}
