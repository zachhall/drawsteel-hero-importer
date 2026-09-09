/**
 * Minimal typings for the subset of ForgeSteel's .ds-hero export format
 * this plugin actually reads. Not a full port of forgesteel's models —
 * unknown/unused fields are left untyped via index signatures.
 */

export interface DsFeature {
	id: string;
	name: string;
	description: string;
	type: string;
	data: any;
	[key: string]: unknown;
}

export interface DsBonusData {
	field: string;
	value: number;
	valueFromController: string | null;
	valueCharacteristics: string[];
	valueCharacteristicMultiplier: number;
	valuePerLevel: number;
	valuePerEchelon: number;
}

export interface DsSkillChoiceData {
	options: string[];
	listOptions: string[];
	count: number;
	selectAt: string;
	selected: string[];
}

export interface DsLanguageChoiceData {
	options: string[];
	allowedTypes: string[];
	count: number;
	selectAt: string;
	selected: string[];
}

export interface DsKit {
	id: string;
	name: string;
	description: string;
	armor: string[];
	weapon: string[];
	stamina: number;
	speed: number;
	stability: number;
	meleeDamage: { tier1: number; tier2: number; tier3: number } | null;
	rangedDamage: { tier1: number; tier2: number; tier3: number } | null;
	meleeDistance: number;
	rangedDistance: number;
	disengage: number;
	features: DsFeature[];
}

export interface DsKitData {
	types: string[];
	count: number;
	selected: DsKit[];
}

export interface DsAbilityDistance {
	type: string;
	value: number;
	value2: number;
	within: number;
	special: string;
	qualifier: string;
}

export interface DsAbilitySection {
	type: "text" | "roll" | "field" | "package";
	text?: string;
	roll?: {
		characteristic: string[];
		bonus: number;
		tier1: string;
		tier2: string;
		tier3: string;
	};
	name?: string;
	value?: number;
	effect?: string;
	tag?: string;
}

export interface DsAbility {
	id: string;
	name: string;
	description: string;
	type: {
		usage: string;
		free: boolean;
		trigger: string;
		time: string;
		qualifiers: string[];
		freeStrike: boolean;
	};
	keywords: string[];
	distance: DsAbilityDistance[];
	target: string;
	cost: number | string;
	repeatable: boolean;
	minLevel: number;
	sections: DsAbilitySection[];
}

export interface DsClassAbilityData {
	cost: number | string;
	minLevel: number;
	count: number;
	selectedIDs: string[];
}

export interface DsCharacteristicBonusData {
	characteristic: string;
	value: number;
}

export interface DsCharacteristicValue {
	characteristic: string;
	value: number;
}

export interface DsHeroClass {
	id: string;
	name: string;
	description: string;
	type: string;
	subclassName: string;
	subclassCount: number;
	primaryCharacteristics: string[];
	featuresByLevel: { level: number; features: DsFeature[] }[];
	abilities: DsAbility[];
	level: number;
	characteristics: DsCharacteristicValue[];
}

export interface DsAncestry {
	id: string;
	name: string;
	description: string;
	features: DsFeature[];
	ancestryPoints: number;
	culture?: unknown;
}

export interface DsCulture {
	id: string;
	name: string;
	description: string;
	type: string;
	language: DsFeature;
	environment: DsFeature;
	organization: DsFeature;
	upbringing: DsFeature;
}

export interface DsCareer {
	id: string;
	name: string;
	description: string;
	features: DsFeature[];
	incitingIncidents?: { selected?: { name: string; description: string } };
}

export interface DsComplication {
	id: string;
	name: string;
	description: string;
	features: DsFeature[];
}

export interface DsHeroState {
	staminaDamage: number;
	staminaTemp: number;
	recoveriesUsed: number;
	victories: number;
	xp: number;
	renown: number;
	wealth: number;
	conditions: unknown[];
	inventory: unknown[];
	notes: string;
	[key: string]: unknown;
}

export interface DsHero {
	id: string;
	name: string;
	folder: string;
	ancestry: DsAncestry | null;
	culture: DsCulture | null;
	career: DsCareer | null;
	class: DsHeroClass | null;
	complication: DsComplication | null;
	features: DsFeature[];
	state: DsHeroState;
	[key: string]: unknown;
}
