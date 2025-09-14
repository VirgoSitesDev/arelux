import { get } from 'svelte/store';
import { goto, invalidateAll } from '$app/navigation';
import type { CatalogEntry, Family, SavedObject } from '../app';
import { page } from '$app/state';
import { toast } from 'svelte-sonner';
import { tv } from 'tailwind-variants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './dbschema';
import { PUBLIC_SUPABASE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Renderer } from './renderer/renderer';
import { writable, type Writable } from 'svelte/store';
import { storable } from './storable';
import Handlebars from 'handlebars';
import type { Vector3Like } from 'three';
import type { RendererObject } from './renderer/objects';
import _ from 'lodash';
import { getRequiredConnector4Family } from './connectorRules';
import { getPdfTranslations } from './pdfTranslations';
import { locale } from 'svelte-i18n';
import { translateDatabaseText } from './i18n/dbTranslator';

export let objects: Writable<SavedObject[]> = writable([]);

export let lastAdded: Writable<string | undefined> = writable();

export function findClosestCatalogLength(family: Family, customLength: number): {code: string, len: number} {
	if (!family || !family.items || family.items.length === 0) {
	  throw new Error("Famiglia non valida o senza elementi");
	}

	const catalogItems = _.uniqWith(
	  family.items.map(item => ({
		code: item.code,
		len: item.len
	  })),
	  (a, b) => a.len === b.len
	);

	let closestItem = catalogItems[0];
	let minDifference = Math.abs(customLength - closestItem.len);
	
	for (let i = 1; i < catalogItems.length; i++) {
	  const difference = Math.abs(customLength - catalogItems[i].len);
	  if (difference < minDifference) {
		closestItem = catalogItems[i];
		minDifference = difference;
	  }
	}
	
	return closestItem;
}

export async function finishEdit(
	renderer: Renderer,
	obj: RendererObject,
	group: string | null,
	stateOverride?: {
		chosenFamily: string;
		chosenItem: string;
		reference:
			| { typ: 'junction'; id: string; junction: number }
			| { typ: 'line'; id: string; junction: number; pos: Vector3Like }
			| undefined;
		led?: string;
		length?: number;
		isCustomLength?: boolean;
	},
) {
	renderer.setScene('normal');
	renderer.clearConnectorEnhancements();
	
	const state = stateOverride ?? page.state;
	
	const tempPosition = obj.mesh?.position.clone();
	const tempRotation = obj.mesh?.rotation.clone();
	const tempScale = obj.mesh?.scale.clone();
	
	const family = page.data.families[state.chosenFamily];
	let item = family.items.find((x) => x.code == state.chosenItem);
	if (item === undefined) {
		toast.error('An internal error occurred');
		console.error("finishEdit: can't find state.chosenItem inside state.chosenFamily");
		return;
	}

	if (group && page.data.joiners[group]) {
		for (const j of page.data.joiners[group]) {
			objects.update((objs) =>
				objs.concat({
					code: j.code,
					desc1: '',
					desc2: '',
					subobjects: [],
					length: 0,
					hidden: true,
				}),
			);
		}
	}
	
	const subobjects: SavedObject[] = [];
	if (state.led) {
		const led = page.data.families[family.ledFamily ?? ''].items.find((x) => x.code == state.led);
		if (led === undefined) {
			toast.error('An internal error occurred');
			console.error("finishEdit: can't find state.chosenItem inside state.chosenFamily");
			return;
		}
		subobjects.push({
			code: state.led,
			subobjects: [],
			desc1: led.desc1,
			desc2: led.desc2,
			length: state.length ? state.length - led.radius : undefined,
		});
	}
	
	const isAlreadyAttached = obj.getJunctions().some(j => j !== null) || 
							obj.getLineJunctions().some(j => j !== null);


	if (state.reference && !isAlreadyAttached) {	
		if (state.reference.typ === 'junction') {
			const parentObj = renderer.getObjectById(state.reference.id);
			if (parentObj) {
				parentObj.attach(
					obj, 
					undefined,  
					state.reference.junction
				);
			}
		} else if (state.reference.typ === 'line') {
			const parentObj = renderer.getObjectById(state.reference.id);
			if (parentObj) {
				parentObj.attachLine(obj, state.reference.pos);
			}
		}
	}

	if (stateOverride?.isCustomLength && stateOverride?.length && item?.len) {
		if (obj.mesh) {
			const isVertical = renderer.isVerticalProfile?.(obj) ?? false;
			if (isVertical) {
				obj.mesh.scale.setY(1);
			} else {
				obj.mesh.scale.setX(1);
			}
		}
		renderer.scaleObject(obj, stateOverride.length / item.len);
	}

	objects.update((objs) =>
		objs.concat({
			code: state.chosenItem,
			desc1: item?.desc1 ?? '',
			desc2: item?.desc2 ?? '',
			subobjects,
			length: state.length,
			customLength: state.isCustomLength === true,
			object: obj,
		}),
	);

	const junctions = obj.getJunctions();
	for (let i = 0; i < junctions.length; i++) {
		const connectedObj = junctions[i];
		if (connectedObj) {
			const connectedSavedObj = get(objects).find(o => o.object?.id === connectedObj.id);
			if (connectedSavedObj) {
				let parentFamily = '';
				let currentFamily = family.group;
				
				for (const [_, fam] of Object.entries(page.data.families)) {
					if (fam.items.some(item => item.code === connectedSavedObj.code)) {
						parentFamily = fam.group;
						break;
					}
				}
				
				const connectorCode = getRequiredConnector4Family(
					{ code: connectedSavedObj.code, family: parentFamily, system: page.data.catalog[connectedSavedObj.code]?.system || '' },
					{ code: state.chosenItem, family: currentFamily, system: page.data.catalog[state.chosenItem]?.system || '' }
				);
				
				if (connectorCode) {
					const connectionIds = [connectedSavedObj.object?.id, obj.id]
						.filter((id): id is string => id !== undefined)
						.sort();
					
					if (connectionIds.length === 2) {
						objects.update((objs) => [
							...objs,
							{
								code: connectorCode,
								desc1: 'Connettore automatico',
								desc2: '',
								subobjects: [],
								length: 0,
								hidden: true,
								isAutoConnector: true,
								connectedTo: connectionIds,
							}
						]);
					}
				}
			}
		}
	}

	lastAdded.set(obj.id);
	goto(`/${page.data.tenant}/${page.data.system}`);
}

export function getPowerBudget(
	catalog: Record<string, CatalogEntry>,
	objs?: SavedObject[],
): number {
	let res = 0;
	for (const obj of objs !== undefined ? objs : get(objects)) {
		res += (catalog[obj.code].power * (obj.length ?? 1000)) / 1000;
		for (const subobj of obj.subobjects) {
			res += (catalog[subobj.code].power * (obj.length ?? 1000)) / 1000;
		}
	}
	return res;
}

export function getTotalLength(objects: SavedObject[], families: Record<string, Family>): number {
	let res = 0;
	for (const obj of objects) {
		for (const family of Object.values(families)) {
			const familyItem = family.items.find((fi) => fi.code === obj.code);
			if (familyItem && familyItem.total_length) res += familyItem.total_length;
			if (familyItem) break;
		}
	}
	return res;
}

export const button = tv({
	base: `text-center rounded-md transition-all shadow-btn
		active:scale-98 active:shadow-btn-active
		disabled:cursor-not-allowed disabled:text-black/40 disabled:shadow-none disabled:grayscale disabled:active:scale-100`,
	variants: {
		color: {
			primary: 'bg-primary disabled:bg-box',
			secondary: 'border border-secondary disabled:bg-muted',
		},
		size: {
			sm: 'px-3 py-2',
			xs: 'px-3 py-1',
			square: 'h-12',
		},
	},

	defaultVariants: {
		color: 'primary',
		size: 'sm',
	},
});

export const sidebarRefs = new Map<string, HTMLElement>();

export function focusSidebarElement(item: SavedObject) {
    const element = sidebarRefs.get(item.code);
    if (!element) return;
    
    element.scrollIntoView({ behavior: 'smooth' });
    element.focus();
    element.classList.add('ring');
    setTimeout(() => element.classList.remove('ring'), 3000);
}

let supabase: SupabaseClient<Database> | undefined;

export function getSupabase(): SupabaseClient<Database> {
	if (supabase === undefined) {
		supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY);
	}

	return supabase;
}

export let selectedSystem = storable('system', '');

export async function selectSystem(system: string) {
	if (get(selectedSystem) !== system) {
		selectedSystem.set(system);
		await invalidateAll();
	}
}

export async function invoiceTemplate(
	supabase: SupabaseClient<Database>,
	tenant: string,
	to: string,
	items: { code: string; quantity: number }[],
): Promise<string> {
	const prices: Record<string, number> = {};
	const prices_query = await supabase
		.from('objects')
		.select('code, price_cents')
		.eq('tenant', tenant)
		.throwOnError();
	if (!prices_query.data) {
		console.error('error querying prices:', prices_query.error);
		throw prices_query.error;
	}
	for (const obj of prices_query.data) prices[obj.code] = obj.price_cents;

	const mappedItems = items.map((i) => {
		const basePrice = prices[i.code] / 100;
		const finalPrice = basePrice * 0.75;
		const totalPrice = finalPrice * i.quantity;

		const imageUrl = supabase.storage
			.from(tenant)
			.getPublicUrl(`images/${i.code}.webp`).data.publicUrl;

		console.log(imageUrl);
		
		return {
			...i,
			price: basePrice,
			finalPrice,
			totalPrice,
			imageUrl
		};
	});

	const subtotale = mappedItems.reduce((a, v) => a + v.totalPrice, 0);
	const iva = 22; // Percentuale IVA
	const ivaAmount = subtotale * (iva / 100);
	const totale = subtotale + ivaAmount;

	// 🆕 NUOVO: Ottieni la lingua corrente dal store
	const currentLocale = get(locale) || 'it';
	const translations = getPdfTranslations(currentLocale);

	// 🆕 NUOVO: Registra gli helper Handlebars con le traduzioni
	Handlebars.registerHelper('t', function(key: string) {
		return translations[key as keyof typeof translations] || key;
	});

	// 🆕 NUOVO: Helper per tradurre le descrizioni dei prodotti
	Handlebars.registerHelper('translateDesc', function(code: string) {
		// Trova la descrizione del prodotto dal catalogo e traducila
		// Puoi personalizzare questa logica secondo le tue esigenze
		return translateDatabaseText(code);
	});

	// 🆕 NUOVO: Helper per calcoli matematici
	Handlebars.registerHelper('multiply', function(a: number, b: number) {
		return a * b;
	});

	Handlebars.registerHelper('divide', function(a: number, b: number) {
		return a / b;
	});

	const templateHTML = `<!DOCTYPE html>
<html lang="{{locale}}">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>{{t 'pdfTitle'}}</title>
	<style>
		* { 
			margin: 0; 
			padding: 0; 
			box-sizing: border-box; 
		}
		body { 
			font-family: Arial, sans-serif; 
			font-size: 11px; 
			line-height: 1.2; 
			color: #000; 
			background: white; 
		}
		.container { 
			max-width: 210mm; 
			margin: 0 auto; 
			padding: 10mm; 
			background: white; 
		}
		.header { 
			display: flex; 
			justify-content: space-between; 
			align-items: flex-start; 
			margin-bottom: 20px; 
			border-bottom: 1px solid #ddd; 
			padding-bottom: 15px; 
		}
		.company-info { 
			display: flex; 
			align-items: flex-start; 
			gap: 15px; 
		}
		.logo { 
			width: 120px; 
			height: 90px; 
			display: flex; 
			align-items: center; 
			justify-content: center; 
		}
		.logo img { 
			max-width: 120px; 
			max-height: 90px; 
			object-fit: contain; 
		}
		.company-details { 
			font-size: 10px; 
			line-height: 1.4; 
		}
		.company-details strong { 
			font-size: 12px; 
			display: block; 
			margin-bottom: 3px; 
		}
		.header-right { 
			text-align: right; 
			font-size: 10px; 
			line-height: 1.4; 
		}
		.offer-title { 
			text-align: center; 
			margin: 30px 0 20px 0; 
		}
		.offer-title h1 { 
			font-size: 32px; 
			font-weight: normal; 
			margin-bottom: 8px; 
			letter-spacing: 1px; 
		}
		.offer-title h2 { 
			font-size: 14px; 
			font-weight: normal; 
			letter-spacing: 0.5px; 
			color: #666; 
		}
		.products-table { 
			width: 100%; 
			border-collapse: collapse; 
			margin: 25px 0; 
			background: white; 
		}
		.products-table th { 
			background: #f8f9fa; 
			border: 1px solid #ddd; 
			padding: 8px 6px; 
			text-align: center; 
			font-weight: bold; 
			font-size: 10px; 
			vertical-align: middle; 
		}
		.products-table td { 
			border: 1px solid #ddd; 
			padding: 8px 6px; 
			text-align: center; 
			vertical-align: middle; 
			font-size: 9px; 
		}
		.product-image { 
			width: 60px; 
			height: 60px; 
			object-fit: contain; 
			background: #f8f9fa; 
			border: 1px solid #e0e0e0; 
			display: block; 
			margin: 0 auto; 
			border-radius: 4px; 
		}
		.product-info { 
			text-align: left; 
			width: 350px; 
			padding-left: 8px; 
		}
		.product-code { 
			font-weight: bold; 
			font-size: 10px; 
			margin-bottom: 4px; 
			color: #333; 
			text-align: left;
		}
		.product-desc { 
			font-size: 8px; 
			color: #666; 
			line-height: 1.3; 
			text-align: left;
		}
		.price { 
			font-weight: bold; 
			white-space: nowrap; 
			color: #000;
		}
		.total-price { 
			font-weight: bold; 
			color: #000;
		}
		.item-number { 
			font-weight: bold; 
			color: #333;
			font-size: 10px;
		}
		.totals-section { 
			margin-top: 20px; 
			display: flex; 
			justify-content: flex-end; 
		}
		.totals-table { 
			border-collapse: collapse; 
			min-width: 250px; 
		}
		.totals-table td { 
			padding: 6px 12px; 
			border: none; 
			text-align: right; 
		}
		.totals-table .label { 
			font-weight: bold; 
			text-align: left; 
			border-bottom: 1px solid #ddd; 
		}
		.totals-table .value { 
			font-weight: bold; 
			border-bottom: 1px solid #ddd; 
			min-width: 100px; 
		}
		.total-final { 
			font-size: 12px; 
			color: #000;
			border-bottom: 3px double #000 !important; 
		}
		.footer { 
			margin-top: 30px; 
			padding-top: 15px; 
			border-top: 1px solid #ddd; 
			display: flex; 
			justify-content: space-between; 
			align-items: center; 
			font-size: 10px; 
		}
		.validity { 
			font-weight: bold; 
		}
		.copyright { 
			color: #666; 
		}
		.page-info { 
			position: absolute; 
			bottom: 15px; 
			right: 15px; 
			font-size: 8px; 
			color: #999; 
		}
		@media print { 
			.container { 
				margin: 0; 
				padding: 0; 
				max-width: none; 
			} 
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="company-info">
				<div class="logo">
					<img src="{{logoUrl}}" alt="Arelux Logo" onerror="this.style.display='none'; this.parentNode.innerHTML='<div style=\\'background: #333; color: white; padding: 20px 10px; text-align: center; font-weight: bold; font-size: 14px; border-radius: 4px;\\'>ARELUX</div>';">
				</div>
				<div class="company-details">
					contact@arelux.ro<br>
					+40 234 514 492<br>
					Al. Tolstoi 12, 600093 Bacău, România
				</div>
			</div>
			<div class="header-right">
				<strong>{{t 'date'}}: {{date}}</strong><br>
				{{t 'client'}}: {{client_email}}<br>
				{{t 'quoteNumber'}}: {{invoice_number}}
			</div>
		</div>
		<div class="offer-title">
			<h1>{{t 'areluxOffer'}}</h1>
			<h2>{{t 'professionalLighting'}}</h2>
		</div>
		<table class="products-table">
			<thead>
				<tr>
					<th style="width: 40px;">#</th>
					<th style="width: 80px;">{{t 'image'}}</th>
					<th style="width: 350px;">{{t 'product'}}</th>
					<th style="width: 80px;">{{t 'price'}}</th>
					<th style="width: 60px;">{{t 'units'}}</th>
					<th style="width: 100px;">{{t 'totalPrice'}}</th>
				</tr>
			</thead>
			<tbody>
				{{#each items}}
				<tr>
					<td class="item-number">{{@index1}}</td>
					<td>
						<img src="{{imageUrl}}" 
							alt="{{code}}" 
							class="product-image" 
							onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjhGOUZBIiBzdHJva2U9IiNFMEUwRTAiLz4KPHN2ZyB4PSIxNSIgeT0iMTUiIHdpZHRoPSIzMCIgaGVpZ2h0PSIzMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5OTk5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KPHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiLz4KPGNpcmNsZSBjeD0iOC41IiBjeT0iOC4yIiByPSIxLjUiLz4KPHBvbHlsaW5lIHBvaW50cz0iMjEsMTUgMTYsMTAgNSwyMSIvPgo8L3N2Zz4KPC9zdmc+'; this.onerror=null;">
					</td>
					<td class="product-info">
						<div class="product-code">{{code}}</div>
						<div class="product-desc">
							{{t 'professionalComponent'}}<br>
							{{t 'highEfficiency'}}<br>
							{{t 'premiumQuality'}}
						</div>
					</td>
					<td class="price">{{t 'currency'}}{{euros finalPrice}}</td>
					<td>{{quantity}}</td>
					<td class="price total-price">{{t 'currency'}}{{euros totalPrice}}</td>
				</tr>
				{{/each}}
			</tbody>
		</table>
		<div class="totals-section">
			<table class="totals-table">
				<tr>
					<td class="label">{{t 'transportWithoutVAT'}}:</td>
					<td class="value">{{t 'currency'}}0,00</td>
				</tr>
				<tr>
					<td class="label">{{t 'subtotalWithoutVAT'}}:</td>
					<td class="value">{{t 'currency'}}{{euros subtotale}}</td>
				</tr>
				<tr>
					<td class="label">{{t 'vat'}} ({{iva}}%):</td>
					<td class="value">{{t 'currency'}}{{euros (multiply subtotale (divide iva 100))}}</td>
				</tr>
				<tr>
					<td class="label total-final">{{t 'totalWithVAT'}}:</td>
					<td class="value total-final">{{t 'currency'}}{{euros totale}}</td>
				</tr>
			</table>
		</div>
		<div class="footer">
			<div class="validity">{{t 'offerValidity'}}</div>
			<div class="copyright">{{t 'copyright'}}</div>
		</div>
	</div>
</body>
</html>`;

	const template = Handlebars.compile(templateHTML);
	
	const now = new Date();
	const dateStr = now.toLocaleDateString('it-IT');
	const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

	// URL del logo Arelux da Supabase
	const logoUrl = supabase.storage
		.from(tenant)
		.getPublicUrl(`${tenant}.png`).data.publicUrl;

	return template({
		date: dateStr,
		time: timeStr,
		invoice_number: crypto.randomUUID().slice(0, 8),
		client_email: to,
		logoUrl,
		items: mappedItems,
		subtotale,
		iva,
		totale,
	});
}

export { virtualRoomVisible, virtualRoomDimensions } from './virtualRoomStore';