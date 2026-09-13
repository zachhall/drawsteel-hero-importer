# Fillable PDF best practices

How to fill out a character sheet PDF for the best import result. See
[DOCUMENTATION.md](DOCUMENTATION.md) for what the import path actually does
with this data once it's read.

## Which PDF to use

This importer has only been tested against **MCDM Productions' official
Standard Character Sheet**, free at
[mcdmproductions.com/draw-steel-resources](https://www.mcdmproductions.com/draw-steel-resources).
It will probably not work with any other fillable PDF, including MCDM's own
official **Alternative** or **Expanded** character sheets, or any
third-party/community-made sheet — field names are matched exactly against
the Standard sheet's own form fields, and other sheets use entirely different
field naming.

## Filling it out

Examples below use a level 1 Orc Censor ("Hellic") as sample data — not the
actual PDF, just illustrating the expected text shape for each field.

- **Subclass** — combine your subclass/Order pick and Domain (if your class
  has one) as `<pick> - Domain: <domain>`, e.g. `Exorcist - Domain: Fate`. The
  importer looks specifically for `" - Domain: "` to split this into two
  separate lines. No Domain concept for your class? Just fill in the
  subclass/Order name on its own.
- **Perks** (the Ancestry Traits list) — first line names your Ancestry,
  followed by one `- Trait Name` bullet per line:
  ```
  Orc:
  - Bloodfire Rush
  - Glowing Recovery
  - Relentless
  ```
  Only the trait *name* needs to be typed — the importer looks up the full
  description from your DS Compendium vault folder by name. Spell it exactly
  as it appears in the Compendium (matching its own heading) or it imports
  name-only, with no description.
- **Class Features** — same `- Feature Name` bullet format as Perks. Your
  class's Heroic Resource name (e.g. "Wrath") is fine to include; the
  importer filters it out automatically since it's already shown as its own
  Resources counter.
- **Career Benefit** — fill normally (Skills/Language/Renown/Perk). If the
  Perk names a granted ability (e.g. `Perk: Friend Catapult (Maneuver)`),
  spell that ability's name exactly as it appears in the Ability grid — the
  importer cross-references this text to attribute an "Other"-type ability to
  your Career instead of leaving its source unknown.
- **Modifier Benefits** (Kit) — same idea as Career Benefit: a
  `Features: <ability name>` mention here, matching an ability in the grid
  exactly by name, attributes that ability to your Kit.
- **Complication Details** — write it as two separate paragraphs, each
  starting with its own label, blank line between them:
  ```
  Benefit: ...

  Drawback: ...
  ```
  The importer splits these into two separate Note entries. Anything else
  (no labels, or one paragraph) imports as a single entry with the text
  verbatim.
- **Ability grid** — each ability's Type checkbox (Free Strike / Signature /
  Heroic / Other) matters: an "Other" ability is cross-referenced against
  Career Benefit / Modifier Benefits / Complication Details (see above) to
  find its real source. If its name doesn't appear in any of those three
  fields, it imports with source "Unknown" rather than a guess.
  - **Details field** — write the ability's full rules text the way the
    rulebook/Compendium presents it:
    - `Power Roll + N` on its own line, blank line, then `Tier 1: ...`,
      `Tier 2: ...`, `Tier 3: ...` — each its own line, no blank lines between
      tiers.
    - An ability with separate Melee/Ranged tier tables: label each with its
      own `Melee:` / `Ranged:` line immediately before its three Tier lines
      (no blank line in between the label and its tiers).
    - A `Trigger: ...` line as the very first paragraph becomes the
      ability's trigger.
    - A `Spend N: ...` paragraph becomes a spendable-cost benefit entry.
    - A short, Title Case sub-heading as its own paragraph (e.g. "Judgment
      Order Benefit") splits into its own named entry over the paragraph that
      follows it.

## What this can't fix

- Field names must match the Standard sheet's own form fields exactly — a
  renamed or re-saved PDF (even one that looks identical) will import blank
  or fail outright.
- Typos or formatting slips in the sheet's own text carry straight through —
  the importer doesn't correct or guess at malformed source text.
