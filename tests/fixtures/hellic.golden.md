---
ds_hero: true
name: Hellic
ancestry: Orc
class: Censor
level: 1
might: 2
agility: 2
reason: -1
intuition: -1
presence: 2
victories: 0
xp: 0
max_stamina: 30
speed: 5
---

# Hellic

*Level 1 Orc Censor*

> [!info]- Background
> - **Culture:** Mercenary Band (Professional)
> - **Career:** [[Gladiator]]
> - **[[Censor Order|Order]]:** Exorcist
> - **[[DS Compendium/Rules/Features/Censor/1st-Level Features/Deity and Domains|Domain]]:** Fate
> - **Kit:** [[Mountain]]

## Characteristics

~~~ds-characteristics
might: 2
agility: 2
reason: -1
intuition: -1
presence: 2
~~~

<hr>

## Vitals

~~~ds-stamina
collapsible: true
collapse_default: false
max_stamina: 30
current_stamina: 30
temp_stamina: 0
height: 1
style: default
~~~

<hr>

## Resources

<div class="dshi-resource-row">

~~~ds-counter
name: Wrath
current_value: 0
min_value: 0
~~~

~~~ds-counter
name: Surges
current_value: 0
min_value: 0
~~~

~~~ds-counter
name: Victories
current_value: 0
min_value: 0
~~~

</div>

<div class="dshi-resource-row">

~~~ds-counter
name: XP
current_value: 0
min_value: 0
~~~

~~~ds-counter
name: Renown
current_value: 0
min_value: 0
~~~

~~~ds-counter
name: Wealth
current_value: 1
min_value: 0
~~~

</div>

<hr>

## Statistics

~~~ds-values-row
values:
  - Speed: 5
  - Stability: 2
  - Disengage: 1
  - Free Strike: 2
  - Size: 1M
~~~

<hr>

## Skills

~~~ds-skills
skills:
  - intimidate
  - read person
  - alertness
  - heal
  - swim
  - persuade
  - interrogate
  - religion
custom_skills:
  - name: Strategy
    has_skill: true
    skill_group: Lore
~~~

<hr>

## Actions

### Main Action

~~~ds-feature
type: feature
feature_type: ability
name: Pain For Pain
ability_type: Signature Ability
flavor: An enemy who tagged you will pay for that.
keywords:
  - Melee
  - Strike
  - Weapon
usage: Main Action
distance: Melee 1
target: One creature
effects:
  - roll: Power Roll + 2
    tier1: 3 damage + 2 damage
    tier2: 5 damage + 2 damage
    tier3: 9 damage + 2 damage
  - effect: If the target dealt damage to you since the end of your last turn, this strike deals additional damage equal to your Might or Agility score (your choice).
  - effect: '---'
  - name: Source
    effect: '*Kit — Mountain*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: Every Step ... Death!
ability_type: Signature Ability
flavor: You show your foe a glimpse of their fate after death.
keywords:
  - Magic
  - Ranged
  - Strike
usage: Main Action
distance: Ranged 10
target: One creature
effects:
  - roll: Power Roll + 2
    tier1: 5 + 2 psychic damage
    tier2: 7 + 2 psychic damage
    tier3: 10 + 2 psychic damage
  - effect: Each time the target willingly moves before the end of your next turn, they take 1 psychic damage for each square they move.
  - effect: '---'
  - name: Source
    effect: '*Class — Censor*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: Repent!
cost: 3 Wrath
flavor: You conjure memories of their sins to harry your foes.
keywords:
  - Magic
  - Ranged
  - Strike
usage: Main Action
distance: Ranged 10
target: One creature
effects:
  - roll: Power Roll + 2
    tier1: 5 + 2 holy damage; I < 0, dazed (save ends)
    tier2: 8 + 2 holy damage; I < 1, dazed (save ends)
    tier3: 11 + 2 holy damage; I < 2, dazed (save ends)
  - effect: '---'
  - name: Source
    effect: '*Class — Censor*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: Purifying Fire
cost: 5 Wrath
flavor: The gods judge, fire cleanses.
keywords:
  - Magic
  - Melee
  - Ranged
  - Strike
  - Weapon
usage: Main Action
distance: Melee 1, Ranged 5
target: One creature
effects:
  - roll: Power Roll + 2
    tier1: 5 + 2 holy damage; M < 0, the target has fire weakness 3 (save ends)
    tier2: 9 + 2 holy damage; M < 1, the target has fire weakness 5 (save ends)
    tier3: 12 + 2 holy damage; M < 2, the target has fire weakness 7 (save ends)
  - effect: While the target has fire weakness from this ability, you can choose to have your abilities deal fire damage to the target instead of holy damage.
  - effect: '---'
  - name: Source
    effect: '*Class — Censor*'
~~~

### Maneuver

~~~ds-feature
type: feature
feature_type: ability
name: Friend Catapult
flavor: You hurl your ally through the air.
usage: Maneuver
distance: Self
target: Self
effects:
  - effect: You grab a willing adjacent ally or object of your size or smaller, then vertical push that target up to a number of squares equal to twice your Might score. If a creature you push falls as a result of this movement, the effective distance of the fall is reduced by a number of squares equal to twice your Might score. When you use this perk, you can’t use it again until you earn 1 or more Victories.
  - effect: '---'
  - name: Source
    effect: '*Career — Gladiator*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: Judgment
flavor: You utter a prayer that outlines your foe in holy energy.
keywords:
  - Magic
  - Ranged
usage: Maneuver
distance: Ranged 10
target: One enemy
effects:
  - effect: |-
      The target is judged by you until the end of the encounter, you use this ability again, you willingly end this effect (no action required), or another censor judges the target.

      Whenever a creature judged by you uses a main action and is within your line of effect, you can use a free triggered action to deal holy damage equal to twice your Presence score to them.

      When a creature judged by you is reduced to 0 Stamina, you can use a free triggered action to use this ability against a new target.

      Additionally, you can spend 1 wrath to take one of the following free triggered actions:

      * When an adjacent creature judged by you starts to shift, you make a melee free strike against them and their speed becomes 0 until the end of the current turn, preventing them from shifting.
      * When a creature judged by you within 10 squares makes a power roll, you cause them to take a bane on the roll.
      * When a creature judged by you within 10 squares uses an ability with a potency that targets only one creature, the potency is reduced by 1 for that creature.
      * If you damage a creature judged by you with a melee ability, the creature is taunted by you until the end of their next turn.

      You can choose only one free triggered action option at a time, even if multiple options are triggered by the same effect.
  - effect: '---'
  - name: Source
    effect: '*Class — Censor*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: Posthumous Retirement
flavor: You make your modified collar explode.
keywords:
  - Area
  - Magic
usage: Maneuver
distance: 1 burst
target: Each enemy in the area
effects:
  - effect: Your loyalty collar detonates, dealing fire damage equal to 5 plus your level to each target. Once you have used this ability, you can’t use it again until you spend 1 minute out of combat resetting the collar
  - effect: '---'
  - name: Source
    effect: '*Complication — War Dog Collar*'
~~~

### Triggered Action

~~~ds-feature
type: feature
feature_type: ability
name: My Life for Yours
flavor: You channel some of your vitality into more resilience for you or an ally.
keywords:
  - Magic
  - Ranged
usage: Triggered Action
distance: Ranged 10
target: Self or one ally
trigger: The target starts their turn or takes damage.
effects:
  - effect: You spend a Recovery and the target regains Stamina equal to your Recovery value.
  - name: Spend
    cost: '1'
    effect: You can end one effect on the target that is ended by a saving throw or that ends at the end of their turn, or a prone target can stand up.
  - effect: '---'
  - name: Source
    effect: '*Class — Censor*'
~~~

<hr>

## Details

### Languages

- Kalliak
- Szetch
- Caelian

### Heroic Resource

#### Wrath
- **Start of your turn**: +2 (Per Round)
- **A creature judged by you deals damage to you**: +1 (Per Round)
- **You deal damage to a creature judged by you**: +1 (Per Round)

<hr>

## Background Info

### Ancestry

~~~ds-feature
type: feature
feature_type: trait
name: Relentless
effects:
  - effect: Whenever a creature deals damage to you that leaves you dying, you can make a free strike against any creature. If the creature is reduced to 0 Stamina by your strike, you can spend a Recovery.
  - effect: '---'
  - name: Source
    effect: '*Ancestry — Orc*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Bloodfire Rush
effects:
  - effect: The magic coursing through your veins makes you run faster in the heat of battle. The first time in any combat round that you take damage, you gain a +2 bonus to speed until the end of the round.
  - effect: '---'
  - name: Source
    effect: '*Ancestry — Orc*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Glowing Recovery
effects:
  - effect: Your bloodfire allows you to regain your strength quicker than others. Whenever you use the Catch Breath maneuver, you can spend as many Recoveries as you like.
  - effect: '---'
  - name: Source
    effect: '*Ancestry — Orc*'
~~~

### Domain

~~~ds-feature
type: feature
feature_type: trait
name: Oracular Visions
effects:
  - effect: Your deity rewards you with hazy visions of things to come. Each time you earn 1 or more Victories, you earn an equal number of fate points. Whenever you or a creature within 10 squares makes a test, you can spend 1 fate point to tap into a vision of the outcome, granting that creature an edge on the test. You lose any remaining fate points when you finish a respite.
  - effect: '---'
  - name: Source
    effect: '*Domain — Fate*'
~~~

### Complication

~~~ds-feature
type: feature
feature_type: trait
name: War Dog Collar Benefit
effects:
  - effect: Even if you are a war dog yourself, other war dogs can’t use their Posthumous Promotion ability on you while you wear your collar.
  - effect: '---'
  - name: Source
    effect: '*Complication — War Dog Collar*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: War Dog Collar Drawback
effects:
  - effect: Each time you use your Posthumous Retirement ability, the Director can spend 3 Malice to make your collar malfunction and deal its damage to you in addition to the usual targets.
  - effect: '---'
  - name: Source
    effect: '*Complication — War Dog Collar*'
~~~

<hr>