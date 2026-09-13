# Documentation

Full detail behind [README.md](README.md)'s Features summary. Both import
paths produce the same Note shape wherever the source data allows it — see
"Shared rendering" below for exactly where they match and where they can't.

## `.ds-hero` import (ForgeSteel)

- Imports a `.ds-hero` export into one Note with Characteristics, Vitals
  (stamina bar), Resources, Statistics, Skills, Actions, Traits, Details, and
  a Background Info section.
- Only the hero's *selected* choices are imported — ancestry traits,
  culture/career features, chosen class abilities and domain features, the
  active kit's granted ability, the complication. Unselected/available
  options are left out.
- Abilities are grouped under Actions by action type (Main Action, Maneuver,
  Move Action, Triggered Action). Abilities granted by a Kit, Domain, or
  Complication are merged into the same groups rather than getting their own
  heading.
- Non-ability traits (Ancestry perks, class passives) get their own `##
  Traits` section, between Actions and Details.
- `## Background Info` collects Culture, Career, the hero's subclass/Order
  pick, Domain, and Kit as plain reference lines, plus nested `### Ancestry` /
  `### Career` / `### Domain` / `### Complication` groups for any of their own
  traits or granted features. All rendered as plain text — no compendium
  wikilinks are generated (that's [drawsteel-rule-term-linker](https://github.com/zachhall/drawsteel-rule-term-linker)'s
  job, not this plugin's).

## PDF import (filled MCDM character sheet)

A filled sheet carries a thinner, flatter data shape than a ForgeSteel
export — no rules-tree structure, just named picks and a handful of numbers —
so this path does more work to reach the same output. See
[FILLABLE PDF BEST PRACTICES.md](FILLABLE%20PDF%20BEST%20PRACTICES.md) for
which PDF to use and how to fill it out for the best result:

- **Ability text parsing.** A sheet's ability "Details" field is one free-text
  blob per ability. It's parsed into the same structured form ForgeSteel
  abilities get: `Power Roll + N` / `Tier 1-3` lines become a clickable
  `roll`/`tier1-3` block (including a dual Melee/Ranged split, when an ability
  has one); a leading `Trigger: ...` line becomes the ability's own trigger
  field; a `Spend N: ...` clause becomes a named cost entry; a short
  Title-Case sub-heading line (e.g. "Judgment Order Benefit") splits into its
  own named entry instead of being buried in one paragraph.
- **Ability source attribution.** The sheet's four ability-type checkboxes
  (Free Strike / Signature / Heroic / Other) are the class's own categories —
  an ability marked "Other" isn't the class's own ability at all. Its real
  source (Career, Kit, or Complication) is found by cross-referencing the
  ability's name against the Career Benefit ("Perk: ..."), Modifier Benefits
  ("Features: ..."), and Complication Details text. An "Other" ability that
  matches none of them (e.g. an Ancestry-granted ability, which the sheet
  gives no cross-reference for at all) is attributed to "Unknown" rather than
  defaulting to Class. A Kit's own Signature Ability is also cross-referenced
  this way — the sheet's "Signature" checkbox only ever marks the class's
  Signature Ability — and is skipped from `### Signature Ability` if it's
  already listed under Actions, so it isn't shown twice.
- **Compendium lookups**, against the folder set in **DS compendium folder**:
  - **Kit** — resolved by name against `Rules/Kits/<name>.md` to fill in stat
    bonuses, Equipment, and Signature Ability text (the sheet only states the
    kit's *name*, not what it grants).
  - **Ancestry Traits** and **Class Features** — the sheet only ever names
    these (e.g. "Bloodfire Rush"), with no description text. Each name is
    resolved against `Rules/Ancestries/<name>.md` / `Rules/Classes/<name>.md`
    (one note per Ancestry/Class, every trait/feature as its own heading) to
    fill in the real description. A name with no matching heading, or no file
    at all, renders name-only rather than failing the import. The class's own
    Heroic Resource (e.g. "Wrath") is filtered out of Class Features, since
    it's already shown as its own Resources counter.
  - Lookups only ever fill an actual data gap the sheet leaves open — never a
    whole matching note's prose. Career, Culture aspects, and the
    Subclass/Domain pick render as plain names straight off the sheet, with no
    lookup and no wikilink.
- **Complication.** Benefit/Drawback prose is already complete on the sheet,
  no lookup needed — split into two separate named entries
  ("`<name>` Benefit" / "`<name>` Drawback") when the text is labeled that
  way, matching how a ForgeSteel-exported Complication's own feature data
  renders. Falls back to one entry with the text verbatim when it isn't
  labeled.
- **Subclass/Domain.** A sheet's Subclass field often combines both picks in
  one string (e.g. "Exorcist - Domain: Fate" for a Censor). Split into
  separate Background Info lines when it matches that pattern; rendered
  verbatim as one line otherwise.
- **Career Benefits / Kit Benefits.** The sheet's own free-text summary of
  what a Career or Kit grants (skills, language, Renown, a perk name / kit
  proficiencies and its granted ability) is shown as a single-line reference
  blurb under Background Info — it restates data the Note already shows in
  more structured form elsewhere (Skills, Languages, the Renown counter, the
  granted ability's own card), so treat it as a cross-reference, not a
  primary source.
- `## Kit` — PDF-only, no ForgeSteel equivalent (a `.ds-hero` export already
  carries its kit data inline via the normal feature list). Heading includes
  the Kit's name, e.g. `## Kit — Mountain`.

## Shared rendering

Both import paths render through the same section builders wherever the data
shapes can match: Characteristics, Vitals, Resources, Statistics, Skills, the
Actions grouping/sorting, and named-feature (`ds-feature` trait) blocks. What
differs is only what each source can *provide*: ForgeSteel's export already
carries full rules text and a proper feature tree; a PDF sheet is flatter and
leans on the DS Compendium lookups above to reach the same depth.

## Frontmatter sync

Victories and XP frontmatter properties stay in sync with their `ds-counter`
blocks under Resources — editing a counter (in Reading view or the block's own
YAML) updates the matching frontmatter property automatically, in either
direction.

## Re-import and archiving

Re-importing a hero always keeps `Name.md` as the current file — no failure
case, and no separate "Name - Level N.md" file per version. If a Note with
that name already exists, its prior content is copied into a timestamped file
in the **Archive folder** first, then the current file is updated in place
(same path/identity), so any `[[HeroName]]` links elsewhere in the vault keep
resolving to whatever's current. Use **Clean up old Hero Notes** in Settings
to delete every archived version except the most recent one, per hero.

## Styling

Ships a `styles.css` with additive visual styling for `ds-characteristics`,
`ds-values-row`, `ds-counter`, and `ds-skills`.
