import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./helpers.mjs";
import { importTs } from "./ts-loader.mjs";

/**
 * Golden-file regression tests: buildHeroNote's current output IS the spec
 * (see the "shared rendering layer" plan) — these fixtures are real,
 * human-approved Hero Notes (Hellic.md, Barerhit.md), used as-is throughout
 * this plugin's development. Any future change to markdown-builder.ts,
 * feature-flatten.ts, or hero-stats.ts that alters their output must be
 * caught here immediately, not by re-reading a diff by eye.
 */

const { flattenHeroFeatures } = await importTs(join(ROOT, "src/feature-flatten.ts"));
const { computeHeroStats } = await importTs(join(ROOT, "src/hero-stats.ts"));
const { buildHeroNote } = await importTs(join(ROOT, "src/markdown-builder.ts"));

function loadFixture(base) {
	const hero = JSON.parse(readFileSync(join(ROOT, `tests/fixtures/${base}.ds-hero.json`), "utf8"));
	const golden = readFileSync(join(ROOT, `tests/fixtures/${base}.golden.md`), "utf8");
	const links = JSON.parse(readFileSync(join(ROOT, `tests/fixtures/${base}.background-links.json`), "utf8"));
	return { hero, golden, links };
}

// Normalizes only line-ending convention and a single trailing-EOF newline
// difference (routine editor/git churn) — never trims or collapses
// whitespace inside content, since exact spacing (e.g. inside a ds-feature
// YAML block) is itself part of what this test verifies.
function normalize(s) {
	return s.replace(/\r\n/g, "\n").replace(/\n+$/, "\n");
}

for (const base of ["hellic", "barerhit"]) {
	test(`buildHeroNote matches golden fixture: ${base}`, () => {
		const { hero, golden, links } = loadFixture(base);
		const flat = flattenHeroFeatures(hero, hero.class?.level ?? 1);
		const stats = computeHeroStats(hero, flat.bonuses, flat.kits, flat.characteristicBonuses);
		const actual = buildHeroNote(hero, stats, flat, links);
		assert.equal(normalize(actual), normalize(golden));
	});
}
