import { DsBonusData, DsCharacteristicValue, DsHero, DsKit } from "./ds-hero-types";

export interface HeroStats {
	level: number;
	characteristics: Record<string, number>;
	stamina: number;
	recoveryValue: number;
	recoveries: number;
	speed: number;
	stability: number;
	disengage: number;
	freeStrike: number;
	size: string;
}

/** Draw Steel echelon: 1-3 => 1, 4-6 => 2, 7-9 => 3, 10 => 4. */
function getEchelon(level: number): number {
	return Math.min(4, Math.ceil(level / 3));
}

function characteristicValue(characteristics: DsCharacteristicValue[], name: string): number {
	return characteristics.find((c) => c.characteristic === name)?.value ?? 0;
}

function modifierValue(data: DsBonusData, characteristics: DsCharacteristicValue[], level: number): number {
	let value = data.value ?? 0;
	// valuePerLevel applies against (level - 1) since `value` already bakes
	// in the level-1 baseline; valuePerEchelon applies against the echelon as-is.
	value += (data.valuePerLevel ?? 0) * (level - 1);
	value += (data.valuePerEchelon ?? 0) * getEchelon(level);

	if (data.valueCharacteristics?.length && data.valueCharacteristicMultiplier) {
		const best = Math.max(...data.valueCharacteristics.map((c) => characteristicValue(characteristics, c)));
		value += best * data.valueCharacteristicMultiplier;
	}

	return value;
}

/**
 * Recomputes the derived combat stats a .ds-hero file doesn't store directly.
 * Everything here is summed from `Bonus`-type features scattered across
 * ancestry/culture/career/class/kit/complication, following the same
 * "field + value + valuePerLevel*level + valuePerEchelon*echelon (+
 * characteristic multiplier)" shape ForgeSteel uses — reimplemented from
 * the public Draw Steel rules rather than ported from ForgeSteel's (GPL-3.0)
 * source.
 */
export function computeHeroStats(hero: DsHero, bonuses: DsBonusData[], kits: DsKit[]): HeroStats {
	const level = hero.class?.level ?? 1;
	const characteristics: Record<string, number> = {};
	(hero.class?.characteristics ?? []).forEach((c) => (characteristics[c.characteristic] = c.value));

	const sumField = (field: string): number =>
		bonuses
			.filter((b) => b.field === field)
			.reduce((sum, b) => sum + modifierValue(b, hero.class?.characteristics ?? [], level), 0);

	const maxKitValue = (selector: (kit: DsKit) => number): number =>
		kits.length ? Math.max(...kits.map(selector)) : 0;

	const stamina = maxKitValue((k) => k.stamina) * getEchelon(level) + sumField("Stamina");
	const speed = 5 + maxKitValue((k) => k.speed) + sumField("Speed");
	const stability = maxKitValue((k) => k.stability) + sumField("Stability");
	const disengage = 1 + maxKitValue((k) => k.disengage) + sumField("Disengage");
	const recoveries = sumField("Recoveries");
	const recoveryValue = Math.floor(stamina / 3);

	// Draw Steel core rules: free strike damage equals the higher of Might or
	// Agility, minimum 0.
	const freeStrike = Math.max(characteristics["Might"] ?? 0, characteristics["Agility"] ?? 0, 0);

	return {
		level,
		characteristics,
		stamina,
		recoveryValue,
		recoveries,
		speed,
		stability,
		disengage,
		freeStrike,
		size: "1M",
	};
}
