import * as yaml from "js-yaml";

/**
 * Frontmatter properties kept in sync with a same-named ds-counter block in
 * the Note body: key is the ds-counter's `name` field (as written by
 * markdown-builder.ts's Resources section), value is the frontmatter
 * property it mirrors. Add an entry here to sync another counter.
 */
export const FRONTMATTER_SYNCED_COUNTERS: Record<string, string> = {
	Victories: "victories",
	XP: "xp",
};

/**
 * Pulls every ds-counter block's `current_value` out of a Note's raw source,
 * keyed by its `name` field, so a vault "modify" listener can tell whether a
 * synced property (see FRONTMATTER_SYNCED_COUNTERS) needs to follow a change
 * — e.g. clicking a counter's +/- in Reading view rewrites the codeblock's
 * own YAML, not the frontmatter block, so nothing else keeps them in sync.
 */
export function extractDsCounterValues(content: string): Map<string, number> {
	const values = new Map<string, number>();
	const blockPattern = /~~~ds-counter\n([\s\S]*?)\n~~~/g;

	let match: RegExpExecArray | null;
	while ((match = blockPattern.exec(content))) {
		try {
			const data = yaml.load(match[1]) as { name?: string; current_value?: number } | undefined;
			if (data?.name && typeof data.current_value === "number") {
				values.set(data.name, data.current_value);
			}
		} catch {
			// Malformed YAML in a counter block isn't this function's problem to raise — skip it.
		}
	}

	return values;
}
