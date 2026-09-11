# Draw Steel Hero Importer

Obsidian plugin that imports a [ForgeSteel](https://forgesteel.net) `.ds-hero`
character export into a single Note formatted with
[Draw Steel Elements](https://github.com/SteelCompendium/draw-steel-elements)
codeblocks.

## Prerequisites

- **Obsidian ≥ 1.6.6**
- **[Draw Steel Elements](https://github.com/SteelCompendium/draw-steel-elements)** — required. The generated Note only renders correctly with this plugin installed and enabled, and only in Reading view (Draw Steel Elements doesn't support Live Preview).
- **[ForgeSteel](https://forgesteel.net)** — where `.ds-hero` files come from. Not a dependency to install; unaffiliated with this plugin.
- Optional: **[Power Roll Detector](https://github.com/zachhall/power-roll-detector)** — makes the Note's `Power Roll + N` values clickable dice rollers.

## Features

- Imports a `.ds-hero` file into one Note (`Name.md`) with Characteristics, Vitals (stamina bar), Resources, Statistics, Skills, Actions, Details, and a Background Info section.
- Only the hero's *selected* choices are imported (ancestry traits, culture/career features, chosen class abilities and domain features, the active kit's granted ability, the complication) — unselected/available options are not included.
- Abilities are grouped under Actions by action type (Main Action, Maneuver, Move Action, Triggered Action). Abilities granted by a Kit, Domain, or Complication are merged into the same groups.
- Ability Power Rolls and tier damage are resolved to the hero's actual characteristic and potency values (e.g. `Power Roll + 2`, `5 + 2 psychic damage`), not left as characteristic names — compatible with Power Roll Detector.
- A collapsible Background box links Culture, Career, subclass/Order, Domain, and Kit to matching notes in a `DS Compendium` vault folder, where one exists.
- Frontmatter properties (name, ancestry, class, level, characteristics, Victories, XP, max stamina, speed) are set for quick reference — e.g. a Base/Dataview view across every PC.
- Victories and XP frontmatter properties stay in sync with their `ds-counter` blocks under Resources — editing a counter (in Reading view or the block's own YAML) updates the matching property automatically.
- Re-importing a hero keeps `Name.md` as the current Note and archives the previous version into a timestamped file in an archive folder.
- Ships a `styles.css` with additive visual styling for `ds-characteristics`, `ds-values-row`, `ds-counter`, and `ds-skills`.

## Installation

### Recommended: BRAT

1. Install and enable the **BRAT** community plugin (Settings → Community plugins → Browse).
2. Open BRAT's settings (or run **BRAT: Add a beta plugin for testing**) and add this repo: `zachhall/drawsteel-hero-importer`.
3. BRAT downloads `main.js`, `manifest.json`, and `styles.css` from the latest [release](../../releases) and enables the plugin. Run **BRAT: Check for updates to all beta plugins** to pull in future releases.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from a [release](../../releases) (or build from source, below).
2. Copy them into `<your vault>/.obsidian/plugins/drawsteel-hero-importer/`.
3. Reload Obsidian and enable **Draw Steel Hero Importer** under Settings → Community plugins.

## Usage

1. Run the **Import Draw Steel Hero (.ds-hero)** command, click the ribbon icon, or use the **Choose .ds-hero file...** button in the plugin's settings tab.
2. Pick a `.ds-hero` file exported from ForgeSteel.
3. The Note opens automatically once imported.

## Settings

- **Destination folder** — vault folder new Hero Notes are created in. Defaults to the vault root.
- **Archive folder** — vault folder the previous version's content is copied to on re-import. Defaults to `hero-archive` in the vault root.

## Building from source

```
npm install
npm run dev    # watch build
npm run build  # production build
npm run lint   # eslint-plugin-obsidianmd (developer guideline checks)
npm test       # Obsidian community-directory compliance checks (tests/)
```

`esbuild.config.mjs` writes `main.js` into this folder, so if the repo lives in
your vault's `.obsidian/plugins/` directory, no copy step is needed — just reload
Obsidian.

## License

MIT
