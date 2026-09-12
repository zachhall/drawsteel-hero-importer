---
ds_hero: true
name: Barerhit
ancestry: Dragon Knight
class: Tactician
level: 10
might: 5
agility: 0
reason: 5
intuition: 2
presence: 2
victories: 0
xp: 144
max_stamina: 150
speed: 6
---

# Barerhit

*Level 10 Dragon Knight Tactician*

> [!info]- Background
> - **Culture:** Dragon Knight (Ancestral)
> - **Career:** [[Watch Officer]]
> - **[[Tactical Doctrine]]:** Vanguard
> - **Kit:** [[Rapid Fire]], [[Shining Armor]]

## Characteristics

~~~ds-characteristics
might: 5
agility: 0
reason: 5
intuition: 2
presence: 2
~~~

<hr>

## Vitals

~~~ds-stamina
collapsible: true
collapse_default: false
max_stamina: 150
current_stamina: 150
temp_stamina: 0
height: 1
style: default
~~~

<hr>

## Resources

<div class="dshi-resource-row">

~~~ds-counter
name: Focus
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
current_value: 144
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
  - Speed: 6
  - Stability: 1
  - Disengage: 2
  - Free Strike: 5
  - Size: 1M
~~~

<hr>

## Skills

~~~ds-skills
skills:
  - history
  - handle animals
  - monsters
  - alertness
  - track
  - eavesdrop
  - lead
  - navigate
  - empathize
  - endurance
  - magic
  - fletching
  - persuade
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
name: Draconic Pride
ability_type: Signature Ability
flavor: You let loose a mighty roar to shake your foes’ spirits.
keywords:
  - Area
  - Magic
usage: Main Action
distance: 1 burst
target: Each enemy in the area
effects:
  - roll: Power Roll + 5
    tier1: 2 damage
    tier2: 5 damage; push 1
    tier3: 7 damage; push 2
  - effect: '---'
  - name: Source
    effect: '*Ancestry — Dragon Knight*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: Two Shot
ability_type: Signature Ability
flavor: When you fire two arrows back to back, both hit their mark.
keywords:
  - Ranged
  - Strike
  - Weapon
usage: Main Action
distance: Ranged 5
target: Two creatures or objects
effects:
  - roll: Power Roll + 5
    tier1: 2 damage
    tier2: 4 damage
    tier3: 6 damage
  - effect: '---'
  - name: Source
    effect: '*Kit — Rapid Fire*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: Protective Attack
ability_type: Signature Ability
flavor: The strength of your assault makes it impossible for your foe to ignore you.
keywords:
  - Melee
  - Strike
  - Weapon
usage: Main Action
distance: Melee 1
target: One creature
effects:
  - roll: Power Roll + 5
    tier1: 3 + 5 damage
    tier2: 6 + 5 damage
    tier3: 9 + 5 damage
  - effect: The target is taunted until the end of their next turn.
  - effect: '---'
  - name: Source
    effect: '*Kit — Shining Armor*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: “Strike Now!”
flavor: Your foe left an opening. You point this out to an ally!
keywords:
  - Ranged
usage: Main Action
distance: Ranged 10
target: One ally
effects:
  - effect: The target can use a signature ability as a free triggered action.
  - name: Spend
    cost: '5'
    effect: You target two allies instead of one.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: Inspiring Strike
cost: 3 Focus
flavor: Your attack gives an ally hope.
keywords:
  - Melee
  - Ranged
  - Strike
  - Weapon
usage: Main Action
distance: Melee 1, Ranged 5
target: One creature or object
effects:
  - roll: Power Roll + 5
    tier1: 3 + 5 damage; you or one ally within 10 squares of you can spend a Recovery
    tier2: 5 + 5 damage; you or one ally within 10 squares of you can spend a Recovery
    tier3: 8 + 5 damage; you and one ally within 10 squares of you can spend a Recovery, and each of you gains an edge on the next ability roll you make during the encounter
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: Squad! Remember Your Training!
cost: 9 Focus
flavor: You remind your allies how to best use their gear.
keywords:
  - Ranged
usage: Main Action
distance: Ranged 10
target: Self and two allies
effects:
  - effect: Each target gains 1 surge and can use a signature ability that has a double edge.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: To Me Squad!
cost: 9 Focus
flavor: You lead your allies in a charge.
keywords:
  - Charge
  - Melee
  - Strike
  - Weapon
usage: Main Action
distance: Melee 1
target: One creature
effects:
  - roll: Power Roll + 5
    tier1: 6 + 5 damage; one ally within 10 squares can use the Charge main action as a free triggered action, and can use a melee strike signature ability instead of a free strike for the charge
    tier2: 9 + 5 damage; one ally within 10 squares can use the Charge main action as a free triggered action, and can use a melee strike signature ability that gains an edge instead of a free strike for the charge
    tier3: 13 + 5 damage; two allies within 10 squares can use the Charge main action as a free triggered action, and can each use a melee strike signature ability that gains an edge instead of a free strike for the charge
  - effect: If the target is hit with two or more strikes as part of this ability and they have R < 5 , they are dazed (save ends). If the target is reduced to 0 Stamina before one or both allies has made their strike, the ally or allies can pick a different target.
  - effect: '---'
  - name: Source
    effect: '*Tactical Doctrine — Vanguard*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: Floodgates Open
cost: 11 Focus
flavor: You direct your squad to strike in unison and with devastating effect.
keywords:
  - Ranged
usage: Main Action
distance: Ranged 10
target: Three allies
effects:
  - effect: Each target gains 1 surge and can use a signature ability as a free triggered action. That ability gains an edge on the power roll and increases the potency of any potency effects by 1.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: No Escape
cost: 11 Focus
flavor: Nothing will stop you from reaching your foe.
keywords:
  - Charge
  - Melee
  - Strike
  - Weapon
usage: Main Action
distance: Melee 1
target: One creature
effects:
  - effect: You mark the target.
  - roll: Power Roll + 5
    tier1: 11 + 5 damage
    tier2: 16 + 5 damage
    tier3: 21 + 5 damage
  - effect: If you use this ability as part of the Charge main action, enemies’ spaces don’t count as difficult terrain for your movement. Additionally, if you move through any creature’s space, you can slide that creature 1 square out of the path of your charge.
  - effect: '---'
  - name: Source
    effect: '*Tactical Doctrine — Vanguard*'
~~~

### Maneuver

~~~ds-feature
type: feature
feature_type: ability
name: Remember your Oath
usage: Maneuver
effects:
  - effect: |-
      As a maneuver, you can recite the following oath.

      > Even should the sun stop in the sky
      > Even should the night last a thousand years
      > I will stand forever
      > I shall not yield
      > Those who suffer and yearn for justice
      > I am your sword and shield
      > I will yield no ground
      > I will speak no lies
      > I will stand against all tyrants
      > Until the last villain dies.
       
      Until the start of your next turn, whenever you make a saving throw, you succeed on a 4 or higher.
  - effect: '---'
  - name: Source
    effect: '*Ancestry — Dragon Knight*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: Mark
flavor: You draw your allies’ attention to a specific foe—with devastating effect.
keywords:
  - Ranged
usage: Maneuver
distance: Ranged 10
target: One creature
effects:
  - effect: |-
      The target is marked by you until the end of the encounter, until you are dying, or until you use this ability again. You can willingly end your mark on a creature (no action required), and if another tactician marks a creature, your mark on that creature ends. When a creature marked by you is reduced to 0 Stamina, you can use a free triggered action to mark a new target within distance.

      You can initially mark only one creature using this ability, though other tactician abilities allow you to mark additional creatures at the same time.

      While a creature marked by you is within your line of effect, you and allies within your line of effect gain an edge on power rolls made against that creature.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: This Is What We Planned For
cost: 5 Focus
flavor: All those coordination drills you made them do finally pay off.
keywords:
  - Ranged
usage: Maneuver
distance: Ranged 10
target: Two allies
effects:
  - effect: Each target who hasn’t acted yet this combat round can take their turn in any order immediately after yours.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: Rout
cost: 7 Focus
flavor: The tide begins to turn.
usage: Maneuver
distance: Self
target: Self
effects:
  - effect: Until the end of the encounter or until you are dying, whenever you or any ally deals damage to a target marked by you who has R < 4, the target is frightened of the creature who dealt the damage (save ends).
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

### Triggered Action

~~~ds-feature
type: feature
feature_type: ability
name: Parry
flavor: Your quick reflexes cost an enemy the precision they seek.
keywords:
  - Melee
  - Weapon
usage: Triggered Action
distance: Melee 2
target: Self or one ally
trigger: A creature deals damage to the target.
effects:
  - effect: You can shift 1 square. If the target is you, or if you end this shift adjacent to the target, the target takes half the damage. If the damage has any potency effect associated with it, the potency is decreased by 1.
  - name: Spend
    cost: '1'
    effect: This ability’s distance becomes Melee 1 + your Reason score, and you can shift up to a number of squares equal to your Reason score instead of 1 square.
  - effect: '---'
  - name: Source
    effect: '*Tactical Doctrine — Vanguard*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: 'Mark: Trigger'
cost: 1 Focus
usage: Triggered Action
distance: Special 0
target: Special
trigger: You or any ally uses an ability to deal rolled damage to a creature marked by you
effects:
  - effect: |-
      You gain one of the following benefits:

      * The ability deals extra damage equal to twice your Reason score.
      * The creature dealing the damage can spend a Recovery.
      * The creature dealing the damage can shift up to a number of squares equal to your Reason score.
      * If you damage a creature marked by you with a melee ability, the creature is taunted by you until the end of their next turn.

      You can’t gain more than one benefit from the same trigger.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: ability
name: No Dying on My Watch
cost: 5 Focus
flavor: You prioritize saving an ally over your own safety.
keywords:
  - Ranged
  - Strike
  - Weapon
usage: Triggered Action
distance: Ranged 5
target: One enemy
trigger: The target deals damage to an ally.
effects:
  - effect: You move up to your speed toward the triggering ally, ending this movement adjacent to them or in the nearest square if you can’t reach an adjacent square. The triggering ally can spend a Recovery and gains 5 temporary Stamina for each enemy you came adjacent to during the move. You then make a power roll against the target.
  - roll: Power Roll + 5
    tier1: R < 3, the target is frightened of the triggering ally (save ends)
    tier2: ' R < 4, the target is frightened of the triggering ally (save ends)'
    tier3: R < 5, the target is frightened of the triggering ally (save ends)
  - effect: '---'
  - name: Source
    effect: '*Tactical Doctrine — Vanguard*'
~~~

<hr>

## Traits

~~~ds-feature
type: feature
feature_type: trait
name: Put Your Back Into It
effects:
  - effect: During montage tests, whenever you make a test to assist a test and obtain a tier 1 outcome, the assisted test doesn’t take a bane. Additionally, once per montage test, you can turn an ally’s tier 1 test outcome into a tier 2 outcome.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Out of Position
effects:
  - effect: Even before battle begins, your enemies struggle to keep up with your tactics. At the start of an encounter, you can use a free triggered action to use your Mark ability against one enemy you have line of effect to, even if you are surprised. You can then slide the marked target up to 3 squares, ignoring stability. The target can’t be moved in a way that would harm them (such as over a cliff), leave them dying, or result in them suffering a condition or other negative effect.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Improved Field Arsenal
effects:
  - effect: Your expertise with weapons has grown.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Pardon My Friend
effects:
  - effect: When an ally within 5 squares fails a Presence test, you can step in and make a Presence test that takes a bane, with your roll replacing the ally’s roll. This perk can be used only once per test, even if more than one character has it.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Master of Arms
effects:
  - effect: Your expertise with weapons has grown to true mastery. Whenever you use a signature ability from one of your equipped kits or make a free strike using a weapon from one of your equipped kits, you can negate a bane on the power roll or reduce a double bane to a bane.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Open Book
effects:
  - effect: Whenever you speak one-on-one with a creature, you can ask them one question about themself that might typically offend them or raise suspicion. If they choose not to answer honestly, they simply deflect or redirect the question, with no further complications. If they choose to answer honestly, the creature can immediately ask you a question about yourself in turn, which you must answer honestly.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Seize the Initiative
effects:
  - effect: If you are not surprised when combat begins, your side gets to go first. If an enemy has an ability that allows their side to go first, you roll as usual to determine who goes first.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Grandmaster of Arms
effects:
  - effect: Your expertise with weapons has grown to true mastery. Whenever you use a signature ability from one of your equipped kits or make a free strike using a weapon from one of your equipped kits, you automatically obtain a tier 3 outcome on the power roll. You can still roll to determine if you score a critical hit.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Brawny
effects:
  - effect: Whenever you fail a Might test, you can lose Stamina equal to 1d6 + your level to improve the outcome of the test by one tier. You can use this perk only once per test.
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Warmaster
effects:
  - effect: |-
      You have mastered the entirety of possible strategies and tactics. Whenever you or any ally makes an ability roll against a target marked by you, the character making the roll can roll three dice and choose which two to use.

      Additionally, whenever an ally uses a heroic ability that targets one or more creatures marked by you, they spend 2 fewer of their Heroic Resource on that ability (minimum 1).
  - effect: '---'
  - name: Source
    effect: '*Class — Tactician*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Commanding Presence
effects:
  - effect: You command any room you walk into. While you are present during a negotiation, each hero with you treats their Renown as 2 higher than usual. Additionally, each hero with you during a combat encounter has a double edge on tests made to stop combat and start a negotiation.
  - effect: '---'
  - name: Source
    effect: '*Tactical Doctrine — Vanguard*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Melee Superiority
effects:
  - effect: After constant drills, you can more accurately anticipate an enemy’s plan and thwart their attempts to move across the battlefield. Whenever you make an opportunity attack, the target’s speed is reduced to 0 until the end of the current turn.
  - effect: '---'
  - name: Source
    effect: '*Tactical Doctrine — Vanguard*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Shake It Off
effects:
  - effect: As a free maneuver, you can spend 1d6 Stamina to ignore a consequence from a test, or to end one effect on you that is ended by a saving throw or that ends at the end of your turn. Any ally adjacent to you can also spend Stamina as a free maneuver to gain this benefit.
  - effect: '---'
  - name: Source
    effect: '*Tactical Doctrine — Vanguard*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Tactical Offensive
effects:
  - effect: When you use the Charge main action to attack a creature marked by you, you can use a signature or heroic ability with the Melee and Strike keywords instead of a melee free strike.
  - effect: '---'
  - name: Source
    effect: '*Tactical Doctrine — Vanguard*'
~~~

~~~ds-feature
type: feature
feature_type: trait
name: Shock and Awe
effects:
  - effect: You have expanded your leadership skills, strengthening your followers’ morale and providing logistical support. During a montage test or negotiation, you can obtain one automatic success on a test made using a skill from the interpersonal skill group. Additionally, you can convince a group of people to help you with a crafting project during a respite. If these people are available when you take a respite, you can make a project roll for a crafting project in addition to undertaking another respite activity.
  - effect: '---'
  - name: Source
    effect: '*Tactical Doctrine — Vanguard*'
~~~

<hr>

## Details

### Languages

- Vastariax
- Variac
- Hyrallic
- Caelian

### Heroic Resource

#### Focus
- **Start of your turn**: +2 (Per Round)
- **You or an ally damages a creature you have marked**: +1 (Per Round)
- **An ally within 10 squares of you uses a heroic ability**: +1 (Per Round)

<hr>

## Background Info

### Career

~~~ds-feature
type: feature
feature_type: trait
name: Monster Whisperer
effects:
  - effect: You can use the Handle Animals skill to interact with nonsapient creatures who are not animals.
  - effect: '---'
  - name: Source
    effect: '*Career — Watch Officer*'
~~~

<hr>