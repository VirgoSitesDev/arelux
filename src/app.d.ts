import type { families } from '$lib/catalog';
import type { Database } from '$lib/dbschema';
import type { TemporaryObject } from '$lib/renderer/objects';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Vector3Like } from 'three';

declare global {
	namespace App {
		interface PageData {
			supabase: SupabaseClient<Database>;
			tenant: string;
			families: Record<string, Family>;
			catalog: Record<string, CatalogEntry>;
			settings: Settings;
			joiners: Record<string, JunctionJoiner[]>;
		}
		interface PageState {
			chosenFamily: string;
			chosenItem: string;
			reference:
				| { typ: 'junction'; id: string; junction: number }
				| { typ: 'line'; id: string; junction: number; pos: Vector3Like }
				| undefined;
			led?: string;
			length?: number;

			editing?: string;
			currentPage?: number;
			isCustomLength?: boolean;
		}
	}
}

export interface Family {
	code: string;
	displayName: string;
	system: string;
	items: FamilyEntry[];
	group: string;
	hasModel: boolean;
	visible: boolean;

	needsLedConfig: boolean;
	ledFamily: string | null;
	isLed: boolean;

	needsColorConfig: boolean;
	needsLengthConfig: boolean;
	needsCurveConfig: boolean;
	needsTemperatureConfig: boolean;
	arbitraryLength: boolean;
	needsConfig: boolean;
}

export interface FamilyEntry {
	deg: number;
	len: number;
	radius: number;
	total_length?: number;
	color: string;
	code: string;
	desc1: string;
	desc2: string;
	sottofamiglia?: string;
}

export interface CatalogEntry {
	code: string;
	system: string;
	price_cents: number;
	juncts: {
		x: number;
		y: number;
		z: number;
		angle: number;
		group: string;
	}[];
	line_juncts: {
		point1: Vector3Like;
		point2: Vector3Like;
		pointC: Vector3Like;
		group: string;
	}[];

	power: number;
	askForLeds: boolean;
}

export type SavedObject = {
	object?: TemporaryObject;
	hidden?: true;
	sidebarItem?: HTMLElement;

	code: string;
	desc1: string;
	desc2: string;
	length?: number;
	customLength?: boolean;
	subobjects: SavedObject[];
	isAutoConnector?: boolean;
	connectedTo?: string[];
};

/** The settings of a tenant */
export type Settings = {
	password: string;
	allow3d: boolean;
	primaryColor: string;
};

export type JunctionJoiner = {
	group: string;
	code: string;
};
