# Draw Steel Hero Importer

Obsidian plugin that imports a Draw Steel hero — from a
[ForgeSteel](https://forgesteel.net) `.ds-hero` export, or a filled official
MCDM Draw Steel character-sheet PDF — into a single Note formatted with
[Draw Steel Elements](https://github.com/SteelCompendium/draw-steel-elements)
codeblocks.

## Prerequisites

- **Obsidian ≥ 1.6.6**
- **[Draw Steel Elements](https://github.com/SteelCompendium/draw-steel-elements)** — required. The generated Note only renders correctly with this plugin installed and enabled, and only in Reading view (Draw Steel Elements doesn't support Live Preview). Unaffiliated with this plugin.
- **[ForgeSteel](https://forgesteel.net)** — where `.ds-hero` files come from. Not a dependency to install; unaffiliated with this plugin.
- A filled official MCDM Draw Steel character-sheet PDF — the other supported input format. Not affiliated with this plugin either. Only tested against MCDM's **Standard** character sheet ([free download](https://www.mcdmproductions.com/draw-steel-resources)); see [FILLABLE PDF BEST PRACTICES.md](FILLABLE%20PDF%20BEST%20PRACTICES.md) before filling one out.
- Optional: **[Power Roll Detector](https://github.com/zachhall/power-roll-detector)** — makes the Note's `Power Roll + N` values clickable dice rollers.

## Features

- Imports a `.ds-hero` file or a filled character-sheet PDF into one Note (`Name.md`) with Characteristics, Vitals, Resources, Statistics, Skills, Actions, Traits, Background Info, and Kit sections.
- Ability Power Rolls and tier damage are resolved to the hero's actual values (e.g. `Power Roll + 2`, `5 + 2 psychic damage`) — compatible with Power Roll Detector.
- PDF import looks up whatever the sheet doesn't carry (Kit bonuses/equipment/Signature Ability, Ancestry Trait and Class Feature descriptions) from a `DS Compendium` vault folder, where one exists.
- Frontmatter properties (name, ancestry, class, level, characteristics, Victories, XP, max stamina, speed) are set for quick reference — e.g. a Base/Dataview view across every PC — and Victories/XP stay in sync with their `ds-counter` blocks.
- Re-importing a hero keeps `Name.md` as the current Note (so existing `[[links]]` keep resolving) and archives the previous version into a timestamped file.

See [DOCUMENTATION.md](DOCUMENTATION.md) for full details on both import paths and exactly what each Note section contains.

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

1. Run the **Import Draw Steel Hero** command, click the ribbon icon, or use the **Choose file...** button in the plugin's settings tab.
2. Pick a `.ds-hero` file exported from ForgeSteel, or a filled character-sheet PDF.
3. The Note opens automatically once imported.

## Settings

- **Destination folder** — vault folder new Hero Notes are created in. Defaults to the vault root.
- **DS compendium folder** — vault folder your DS Compendium lives in, used only for PDF imports to look up data the sheet doesn't carry. Defaults to `DS Compendium`.
- **Archive folder** — vault folder the previous version's content is copied to on re-import. Defaults to `hero-archive`.
- **Clean up old Hero Notes** — deletes every archived version except the most recent one, for every hero. Never touches a hero's current Note.

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
