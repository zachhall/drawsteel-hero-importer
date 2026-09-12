// Dev utility, not a test: regenerates barerhit.golden.md by running the
// real .ds-hero pipeline against tests/fixtures/barerhit.ds-hero.json — no
// live Obsidian vault needed, since buildHeroNote/flattenHeroFeatures/
// computeHeroStats are all pure functions. Re-run this (and manually review
// the output) whenever barerhit.ds-hero.json itself changes; otherwise the
// fixture is committed as-is and this script doesn't run as part of
// `npm test`.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../helpers.mjs";
import { importTs } from "../ts-loader.mjs";

const { flattenHeroFeatures } = await importTs(join(ROOT, "src/feature-flatten.ts"));
const { computeHeroStats } = await importTs(join(ROOT, "src/hero-stats.ts"));
const { buildHeroNote } = await importTs(join(ROOT, "src/markdown-builder.ts"));

const hero = JSON.parse(readFileSync(join(ROOT, "tests/fixtures/barerhit.ds-hero.json"), "utf8"));

const flat = flattenHeroFeatures(hero, hero.class?.level ?? 1);
const stats = computeHeroStats(hero, flat.bonuses, flat.kits, flat.characteristicBonuses);
const note = buildHeroNote(hero, stats, flat);

writeFileSync(join(ROOT, "tests/fixtures/barerhit.golden.md"), note);
console.log(`Wrote ${note.length} chars to tests/fixtures/barerhit.golden.md`);
