# Draw Steel Hero Importer

Obsidian plugin that imports a [ForgeSteel](https://forgesteel.net) `.ds-hero`
character export and creates a Note formatted with
[Draw Steel Elements](https://github.com/SteelCompendium/draw-steel-elements)
codeblocks (characteristics, stats, skills, features/abilities).

Requires the **Draw Steel Elements** plugin to be installed and enabled for
the generated Note to render (it only formats correctly in Reading view —
Draw Steel Elements doesn't support Live Preview yet).

## Usage

1. Run the **Import Draw Steel Hero (.ds-hero)** command (or click the ribbon icon).
2. Pick a `.ds-hero` file exported from ForgeSteel.
3. A Note named after the hero is created in the configured destination
   folder — set this in the plugin's settings tab; it defaults to the vault
   root. Re-importing the same hero keeps that Note as the current version
   and archives the previous content into a separate archive folder
   (`hero-archive` by default), timestamped — also configurable in settings.

Only the hero's *selected* choices are imported — ancestry traits, culture/
career features, chosen class abilities and domain features, the active
kit's granted ability, and the complication. Unselected/available-but-not-
taken options (e.g. other class abilities you could have picked) are not
included.

## Notes on accuracy

A `.ds-hero` file doesn't store derived combat stats (Stamina, Speed,
Stability, Recoveries, Free Strike) directly — ForgeSteel computes them from
`Bonus`-type features scattered across ancestry/culture/career/class/kit.
This plugin reimplements that computation independently (from the public
Draw Steel rules, not from ForgeSteel's GPL-3.0 source) in
`src/hero-stats.ts`. `class.level` and `class.characteristics`, however, are
stored directly in the export and are read as-is.

Ability "Power Roll" bonuses are displayed by characteristic name (e.g.
`Power Roll + Presence`) rather than as a precomputed number, since resolving
the exact bonus would require replicating ForgeSteel's full ability-bonus
logic.

## Development

```
npm install
npm run dev    # watch build
npm run build  # production build
```
