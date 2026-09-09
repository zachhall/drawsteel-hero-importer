import { DsHero } from "./ds-hero-types";
import { FlatFeature, FlattenResult } from "./feature-flatten";
import { HeroStats } from "./hero-stats";
import { FULL_SKILLS_BY_GROUP } from "./skill-data";
import { CanvasData, CanvasNode } from "./canvas-types";

const GAP = 24;
const CHARS_PER_LINE_AT_100PX = 15; // rough monospace-ish estimate for Obsidian's default canvas card font

/** Rough content-driven height estimate — Canvas text nodes don't autosize, so we guess generously. */
function estimateHeight(text: string, width: number, minHeight: number): number {
	const charsPerLine = Math.max(10, (width / 100) * CHARS_PER_LINE_AT_100PX);
	const lines = text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
	return Math.max(minHeight, lines * 20 + 24);
}

class CanvasLayout {
	private nodes: CanvasNode[] = [];
	private groups: { label: string; minX: number; minY: number; maxX: number; maxY: number; color?: string }[] = [];
	private counter = 0;

	private nextId(): string {
		this.counter += 1;
		return `n${this.counter}`;
	}

	text(text: string, x: number, y: number, width: number, height: number, color?: string): void {
		this.nodes.push({ id: this.nextId(), type: "text", x, y, width, height, text, color });
	}

	/** Starts tracking a bounding box for a labeled zone; call `endZone` once its content is placed. */
	beginZone(label: string, x: number, y: number, color?: string): number {
		this.groups.push({ label, minX: x, minY: y, maxX: x, maxY: y, color });
		return this.groups.length - 1;
	}

	/** Expands the zone's bounding box to include a rectangle just placed within it. */
	growZone(zoneIndex: number, x: number, y: number, width: number, height: number): void {
		const z = this.groups[zoneIndex];
		z.minX = Math.min(z.minX, x - GAP);
		z.minY = Math.min(z.minY, y - GAP);
		z.maxX = Math.max(z.maxX, x + width + GAP);
		z.maxY = Math.max(z.maxY, y + height + GAP);
	}

	build(name: string, level: number): CanvasData {
		const groupNodes: CanvasNode[] = this.groups.map((z, i) => ({
			id: `zone${i}`,
			type: "group",
			x: z.minX,
			y: z.minY,
			width: z.maxX - z.minX,
			height: z.maxY - z.minY,
			label: z.label,
			color: z.color,
		}));
		return { nodes: [...groupNodes, ...this.nodes], edges: [], metadata: { name, level } };
	}
}

function featureBullets(features: FlatFeature[]): string {
	return features
		.map((f) => {
			switch (f.kind) {
				case "text":
					return `- **${f.name}**: ${f.description}`;
				case "ability":
					return `- **${f.ability.name}** *(see Abilities)*`;
				case "immunity":
					return `- **${f.name}**: Immunity to ${f.conditions.join(", ")}`;
				case "resource":
					return `- **${f.name}**`;
			}
		})
		.join("\n");
}

function abilityCardText(ability: FlatFeature & { kind: "ability" }, resourceName: string | undefined): string {
	const a = ability.ability;
	const cost = a.cost === "signature" ? "Signature" : typeof a.cost === "number" && a.cost > 0 ? `${a.cost} ${resourceName ?? ""}`.trim() : "";
	const distance = a.distance
		.map((d) => {
			switch (d.type) {
				case "Melee":
					return `Melee ${d.value}`;
				case "Ranged":
					return `Ranged ${d.value}`;
				case "Aura":
					return `Aura ${d.value}`;
				case "Burst":
					return `${d.value} Burst`;
				case "Cube":
					return `${d.value} Cube${d.within ? ` within ${d.within}` : ""}`;
				case "Self":
					return "Self";
				default:
					return `${d.type} ${d.value}`;
			}
		})
		.join(", ");

	const lines: string[] = [`### ${a.name}${cost ? ` (${cost})` : ""}`];
	if (a.keywords?.length) lines.push(`*${a.keywords.join(", ")}*`);
	lines.push(`**${a.type.usage}**${distance ? ` · ${distance}` : ""}${a.target ? ` · Target: ${a.target}` : ""}`);
	if (a.type.trigger) lines.push(`**Trigger:** ${a.type.trigger}`);

	a.sections.forEach((s) => {
		if (s.type === "roll" && s.roll) {
			lines.push(`**Power Roll + ${s.roll.characteristic.join("/")}**`);
			lines.push(`- ≤11: ${s.roll.tier1}`);
			lines.push(`- 12-16: ${s.roll.tier2}`);
			lines.push(`- 17+: ${s.roll.tier3}`);
		} else if (s.type === "text" && s.text) {
			lines.push(s.text);
		} else if (s.type === "field" && s.effect) {
			lines.push(`**${s.name ?? "Effect"}${s.value !== undefined ? ` (${s.value})` : ""}:** ${s.effect}`);
		}
	});

	return lines.join("\n");
}

/**
 * Builds an Obsidian Canvas (JSON Canvas) that lays out a hero's data in the
 * same broad structure as MCDM's printed character sheet: a front-page-style
 * column (identity, characteristics, combat stats, kit, heroic resource,
 * ancestry traits), a back-page-style column (career/complication, culture,
 * full skill grid with the hero's picks checked), and a card grid of the
 * hero's chosen abilities below, mirroring the sheet's ability cards.
 */
export function buildHeroCanvas(hero: DsHero, stats: HeroStats, flat: FlattenResult): CanvasData {
	const layout = new CanvasLayout();
	const resourceFeature = flat.features.find((f): f is Extract<FlatFeature, { kind: "resource" }> => f.kind === "resource");
	const featuresBySource = (prefix: string) => flat.features.filter((f) => f.source.startsWith(prefix));

	// --- Front column ---
	const frontX = 0;
	const frontZone = layout.beginZone(`${hero.name} — Front`, frontX, 0, "6");
	let y = 0;
	const frontW = 940;

	const header = [
		`# ${hero.name}`,
		`**${hero.ancestry?.name ?? "?"}** · ${hero.culture?.name ?? "?"} · **${hero.class?.name ?? "?"}** · ${hero.career?.name ?? "?"}`,
		`Level ${stats.level}`,
	].join("\n");
	layout.text(header, frontX, y, frontW, 110);
	layout.growZone(frontZone, frontX, y, frontW, 110);
	y += 110 + GAP;

	const CHAR_NAMES = ["Might", "Agility", "Reason", "Intuition", "Presence"];
	const charW = (frontW - GAP * 4) / 5;
	CHAR_NAMES.forEach((name, i) => {
		const x = frontX + i * (charW + GAP);
		const value = stats.characteristics[name] ?? 0;
		layout.text(`### ${name.toUpperCase()}\n# ${value >= 0 ? "+" : ""}${value}`, x, y, charW, 90);
		layout.growZone(frontZone, x, y, charW, 90);
	});
	y += 90 + GAP;

	const combatStats: [string, number | string][] = [
		["Size", stats.size],
		["Speed", stats.speed],
		["Stability", stats.stability],
		["Disengage", stats.disengage],
		["Stamina", stats.stamina],
		["Recoveries", stats.recoveries],
		["Recovery Value", stats.recoveryValue],
		["Free Strike", stats.freeStrike],
	];
	const statW = (frontW - GAP * 7) / 8;
	combatStats.forEach(([name, value], i) => {
		const x = frontX + i * (statW + GAP);
		layout.text(`**${name}**\n${value}`, x, y, statW, 70);
		layout.growZone(frontZone, x, y, statW, 70);
	});
	y += 70 + GAP;

	if (flat.kits.length) {
		flat.kits.forEach((kit) => {
			const meleeTiers = kit.meleeDamage ? `≤11: ${kit.meleeDamage.tier1} / 12-16: ${kit.meleeDamage.tier2} / 17+: ${kit.meleeDamage.tier3}` : "-";
			const rangedTiers = kit.rangedDamage ? `≤11: ${kit.rangedDamage.tier1} / 12-16: ${kit.rangedDamage.tier2} / 17+: ${kit.rangedDamage.tier3}` : "-";
			const kitText = [
				`## Kit: ${kit.name}`,
				`Armor: ${kit.armor.join(", ") || "-"} · Weapon: ${kit.weapon.join(", ") || "-"}`,
				`Stamina +${kit.stamina} · Speed +${kit.speed} · Stability +${kit.stability} · Disengage +${kit.disengage}`,
				`Melee Weapon Damage: ${meleeTiers}`,
				`Ranged Weapon Damage: ${rangedTiers}`,
			].join("\n");
			const h = estimateHeight(kitText, frontW, 140);
			layout.text(kitText, frontX, y, frontW, h);
			layout.growZone(frontZone, frontX, y, frontW, h);
			y += h + GAP;
		});
	}

	if (resourceFeature) {
		const resourceText = [
			`## Heroic Resource: ${resourceFeature.name}`,
			...resourceFeature.gains.map((g) => `- **${g.trigger}**: +${g.value} (${g.frequency})`),
		].join("\n");
		const h = estimateHeight(resourceText, frontW, 100);
		layout.text(resourceText, frontX, y, frontW, h);
		layout.growZone(frontZone, frontX, y, frontW, h);
		y += h + GAP;
	}

	const ancestryFeatures = featuresBySource("Ancestry:").filter((f) => f.kind !== "resource");
	if (ancestryFeatures.length) {
		const text = [`## Ancestry Traits`, featureBullets(ancestryFeatures)].join("\n");
		const h = estimateHeight(text, frontW, 100);
		layout.text(text, frontX, y, frontW, h);
		layout.growZone(frontZone, frontX, y, frontW, h);
		y += h + GAP;
	}

	// --- Back column ---
	const backX = frontX + frontW + GAP * 3;
	const backZone = layout.beginZone(`${hero.name} — Back`, backX, 0, "5");
	let by = 0;
	const backW = 940;

	const careerFeatures = featuresBySource("Career:");
	const careerText = [
		`## Career: ${hero.career?.name ?? "-"}`,
		hero.career?.description ?? "",
		featureBullets(careerFeatures),
		hero.career?.incitingIncidents?.selected ? `**Inciting Incident:** ${hero.career.incitingIncidents.selected.name}` : "",
	]
		.filter(Boolean)
		.join("\n");
	let h = estimateHeight(careerText, backW, 100);
	layout.text(careerText, backX, by, backW, h);
	layout.growZone(backZone, backX, by, backW, h);
	by += h + GAP;

	if (hero.complication) {
		const complicationFeatures = featuresBySource("Complication:");
		const complicationText = [`## Complication: ${hero.complication.name}`, hero.complication.description, featureBullets(complicationFeatures)]
			.filter(Boolean)
			.join("\n");
		h = estimateHeight(complicationText, backW, 100);
		layout.text(complicationText, backX, by, backW, h);
		layout.growZone(backZone, backX, by, backW, h);
		by += h + GAP;
	}

	if (hero.culture) {
		const cultureText = [`## Culture: ${hero.culture.name}`, `Languages: ${flat.languages.join(", ") || "-"}`].join("\n");
		h = estimateHeight(cultureText, backW, 80);
		layout.text(cultureText, backX, by, backW, h);
		layout.growZone(backZone, backX, by, backW, h);
		by += h + GAP;
	}

	const skillGroups = Object.entries(FULL_SKILLS_BY_GROUP);
	const skillColW = (backW - GAP * (skillGroups.length - 1)) / skillGroups.length;
	const heroSkillsLower = new Set(flat.skills.map((s) => s.toLowerCase()));
	let maxSkillColHeight = 0;
	skillGroups.forEach(([group, skills], i) => {
		const x = backX + i * (skillColW + GAP);
		const lines = [`**${group}**`, ...skills.map((s) => `- [${heroSkillsLower.has(s.toLowerCase()) ? "x" : " "}] ${s}`)].join("\n");
		const colH = estimateHeight(lines, skillColW, 200);
		layout.text(lines, x, by, skillColW, colH);
		layout.growZone(backZone, x, by, skillColW, colH);
		maxSkillColHeight = Math.max(maxSkillColHeight, colH);
	});
	by += maxSkillColHeight + GAP;

	// --- Abilities grid ---
	const abilities = flat.features.filter((f): f is Extract<FlatFeature, { kind: "ability" }> => f.kind === "ability");
	if (abilities.length) {
		const abilitiesY = Math.max(y, by) + GAP * 2;
		const abilitiesZone = layout.beginZone(`${hero.name} — Abilities`, 0, abilitiesY, "3");
		const cols = 3;
		const cardW = 340;
		const cardGapX = GAP;
		const rowHeights: number[] = [];

		abilities.forEach((ability, i) => {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const text = abilityCardText(ability, resourceFeature?.name);
			const cardH = estimateHeight(text, cardW, 200);
			rowHeights[row] = Math.max(rowHeights[row] ?? 0, cardH);

			const rowY = abilitiesY + rowHeights.slice(0, row).reduce((sum, h2) => sum + h2 + GAP, 0);
			const x = col * (cardW + cardGapX);
			layout.text(text, x, rowY, cardW, cardH);
			layout.growZone(abilitiesZone, x, rowY, cardW, cardH);
		});
	}

	return layout.build(hero.name, stats.level);
}
