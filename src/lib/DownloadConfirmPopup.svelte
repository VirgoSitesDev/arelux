<script lang="ts">
	import { Button } from 'bits-ui';
	import AreluxLogo from './Logo.svelte';
	import X from 'phosphor-svelte/lib/X';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import Prohibit from 'phosphor-svelte/lib/Prohibit';
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import { page } from '$app/state';
	import { get } from 'svelte/store';
	import { toast } from 'svelte-sonner';
	import { button, getPowerBudget, getTotalLength, invoiceTemplate, objects } from '$lib';
	import Handlebars from 'handlebars';
	import * as Table from '$shad/ui/table';
	import { Input } from '$shad/ui/input';
	import { pushState } from '$app/navigation';
	import { cn } from '$shad/utils';
	import type { SavedObject } from '../app';
	import { _ } from 'svelte-i18n';
    // @ts-ignore
    import html2pdf from 'html2pdf.js';
	import { SvelteSet } from 'svelte/reactivity';

	Handlebars.registerHelper('euros', (amount) =>
		Number.parseFloat(amount).toFixed(2).replace('.', ','),
	);
	Handlebars.registerHelper('splitplus', (raw) => raw.split('+')[0]);

	let {
		closeCallback = () => {},
		askForLeds = false,
	}: { closeCallback?: () => void; askForLeds?: boolean } = $props();

	let email: string = $state('');
	let power = $state(getPowerBudget(page.data.catalog, get(objects)));
	let sendingEmail = $state(false);
	let suspensionEnabled = $state(false);

	const minDrivers = $derived(
		power !== 0 ? Math.ceil(getTotalLength($objects, page.data.families) / 10000) : 0,
	);

	const isXFreeSystem = $derived.by(() => {
		const currentSystem = page.data.system.toLowerCase().replace(' ', '_');
		return currentSystem === 'xfree_s' || currentSystem === 'xfrees' || currentSystem === 'xfreem';
	});

	// Logica per sistemi multipli
	let systems: Array<{
		id: string;
		objects: SavedObject[];
		totalPower: number;
		currentDriver: string | null;
		currentPowerSupply: string | null;
		currentBox: string | null;
	}> = $state([]);

	function findConnectedObjects(startObject: any, allObjects: SavedObject[]): Set<string> {
		const visited = new Set<string>();
		const toVisit = [startObject];
		
		while (toVisit.length > 0) {
			const current = toVisit.pop()!;
			if (visited.has(current.id)) continue;
			
			visited.add(current.id);
			
			for (const junction of current.getJunctions()) {
				if (junction && !visited.has(junction.id)) {
					toVisit.push(junction);
				}
			}
			
			for (const lineJunction of current.getLineJunctions()) {
				if (lineJunction && !visited.has(lineJunction.id)) {
					toVisit.push(lineJunction);
				}
			}
			
			for (const obj of allObjects) {
				if (!obj.object || visited.has(obj.object.id)) continue;
				
				if (obj.object.getJunctions().includes(current) || 
					obj.object.getLineJunctions().includes(current)) {
					toVisit.push(obj.object);
				}
			}
		}
		
		return visited;
	}

	const leds = $state([
		{
			code: 'RB27865ZWW48',
			desc: 'XRIBO IP65 ZIGZAG 15m/reel LEDS STRIP 5.5W/m 78LED/m 48V DC 3000K CRI.90 >115dgr (5.1.2)',
			amount: 0,
		},
		{
			code: 'RB27865ZNW48',
			desc: 'XRIBO IP65 ZIGZAG 15m/reel LEDS STRIP 5.5W/m 78LED/m 48V DC 4000K CRI.90 >115dgr (5.1.2)',
			amount: 0,
		},
		{
			code: 'XNRS01PC0.5',
			desc: 'XNET POWER SUPPLY ELEMENT with 0.5m CABLE for REC./SURF. STRUCTURES (5.1.2)',
			amount: 0,
		},
		{
			code: 'XNRS01ST',
			desc: 'XNET CONNECTOR w. CABLE to CONTROL LED STRIP BY APP (5.1.2)',
			amount: 0,
		},
		{
			code: 'XNS01CV',
			desc: 'XNET DIFFUSER in SATIN PLYCARBONATE 2.5m for the UPPER PART of SUSPENDED PROFILES',
			amount: 0,
		},
	]);

	const drivers = [
		{ code: 'XNRS01DV', power: 150 },
		{ code: 'XNRS02DV', power: 250 },
		{ code: 'TNRS01DV', power: 200 },
		{ code: 'FVRS01DV', power: 200 },
		{ code: 'AT48.100', power: 100 },
		{ code: 'AT48.150', power: 150 },
		{ code: 'AT48.200', power: 200 },
		{ code: 'AT48.350', power: 350 },
	];
	const powerSupplies = ['XNRS01PCO.5', 'XNRS01PC2.5', 'TNRS01PC3.5', 'FVRS01PC MBK', 'FVRS01PC MWH'];
	const boxes = ['SMCKS01SDB', 'SMCKS02SDB', 'SMCKS02TDB', 'SMCKS03TDB'];

	const availablePowerSupplies = $derived.by(() => {
		const currentSystem = page.data.system.toLowerCase().replace(' ', '_');

		if (currentSystem === 'xnet') {
			return powerSupplies.filter((psu) => psu.startsWith('XNRS'));
		} else if (currentSystem === 'xten') {
			return powerSupplies.filter((psu) => psu.startsWith('TNRS'));
		} else if (currentSystem === 'xfive') {
			return powerSupplies.filter((psu) => psu.startsWith('FVRS'));
		}

		return powerSupplies;
	});

	const availableDrivers = $derived.by(() => {
		const currentSystem = page.data.system.toLowerCase().replace(' ', '_');

		if (currentSystem === 'xfree_s' || currentSystem === 'xfrees') {
			const filtered = drivers.filter((driver) => driver.code.startsWith('AT'));
			return filtered;
		} else if (currentSystem === 'xnet') {
			const filtered = drivers.filter((driver) => driver.code.startsWith('XNRS') || driver.code.startsWith('AT'));
			return filtered;
		} else if (currentSystem === 'xten') {
			const filtered = drivers.filter((driver) => driver.code.startsWith('TNRS') || driver.code.startsWith('AT'));
			return filtered;
		} else if (currentSystem === 'xfive') {
			const filtered = drivers.filter((driver) => driver.code.startsWith('FVRS') || driver.code.startsWith('AT'));
			return filtered;
		}

		return drivers;
	});

	const intrackDrivers = $derived.by(() => {
		const filtered = availableDrivers.filter((driver) => !driver.code.startsWith('AT'));
		return filtered;
	});
	const remoteDrivers = $derived.by(() => {
		const filtered = availableDrivers.filter((driver) => driver.code.startsWith('AT'));
		return filtered;
	});

	const showIntrack = $derived(intrackDrivers.length > 0);
	const showRemote = $derived(remoteDrivers.length > 0);

	$effect(() => {
		const allObjects = get(objects);
		const visitedObjects = new Set<string>();
		const systemGroups: typeof systems = [];
		
		for (const obj of allObjects) {
			if (!obj.object || visitedObjects.has(obj.object.id)) continue;
			
			const connectedObjects = findConnectedObjects(obj.object, allObjects);
			const systemObjects = allObjects.filter(o => 
				o.object && connectedObjects.has(o.object.id)
			);
			
			systemObjects.forEach(o => visitedObjects.add(o.object!.id));
			
			const systemPower = getPowerBudget(page.data.catalog, systemObjects);
			const systemId = `${$_("config.system")} ${systemGroups.length + 1}`;

			systemGroups.push({
				id: systemId,
				objects: systemObjects,
				totalPower: systemPower,
				currentDriver: null,
				currentPowerSupply: null,
				currentBox: null
			});
		}
		
		systems = systemGroups;
	});

	$effect(() => {
		let arr: SavedObject[] = $objects;
		for (const led of leds)
			arr = arr.concat(
				Array(led.amount).fill({
					code: led.code,
					desc1: '',
					desc2: '',
					subobjects: [],
				}),
			);
		power = -getPowerBudget(page.data.catalog, arr);
	});

	$effect(() => {
		const currentSystem = page.data.system.toLowerCase().replace(' ', '_');

		if (currentSystem === 'xfree_s' || currentSystem === 'xfrees') {
			if (remoteDrivers.length > 0) {
				systems.forEach(system => {
					if (!system.currentDriver) {
						system.currentDriver = remoteDrivers[0].code;
					}
				});
			}
		} else if (currentSystem === 'xnet') {
			systems.forEach(system => {
				if (!system.currentDriver && availableDrivers.length > 0) {
					if (intrackDrivers.length > 0) {
						system.currentDriver = intrackDrivers[0].code;
					} else if (remoteDrivers.length > 0) {
						system.currentDriver = remoteDrivers[0].code;
					}
				}
			});
		} else if (currentSystem === 'xten') {
			systems.forEach(system => {
				if (!system.currentDriver && intrackDrivers.length > 0) {
					system.currentDriver = intrackDrivers[0].code; // TNRS01DV
				}
			});
		}
	});

	function blobToBase64(blob: Blob): Promise<string> {
		return new Promise((resolve, _) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.readAsDataURL(blob);
		});
	}

	/**
	 * Calculate arc length from angle and radius
	 * Formula: L = (θ/360) × 2πr
	 * @param angleInDegrees - The angle in degrees
	 * @param radiusInMm - The radius in millimeters
	 * @returns Arc length in millimeters
	 */
	function calculateArcLength(angleInDegrees: number, radiusInMm: number): number {
		return (angleInDegrees / 360) * 2 * Math.PI * radiusInMm;
	}

	/**
	 * Get the profile length from a SavedObject
	 * @param obj - The saved object
	 * @returns Length in millimeters
	 */
	function getProfileLength(obj: SavedObject): number {
		// If length is directly specified, use it
		if (obj.length) {
			return obj.length;
		}

		// Otherwise, try to get it from the catalog entry
		const catalogEntry = page.data.catalog[obj.code];
		if (!catalogEntry) return 0;

		// Find the family entry for this object
		for (const family of Object.values(page.data.families)) {
			const familyItem = family.items.find(item => item.code === obj.code);
			if (familyItem) {
				// If it's a curved profile, calculate arc length
				if (familyItem.deg > 0 && familyItem.radius > 0) {
					return calculateArcLength(familyItem.deg, familyItem.radius);
				}
				// Otherwise use the direct length
				if (familyItem.len > 0) {
					return familyItem.len;
				}
			}
		}

		return 0;
	}

	/**
	 * Determine if an object is a profile (not a light, connector, etc.)
	 * @param obj - The saved object
	 * @returns true if it's a profile
	 */
	function isProfile(obj: SavedObject): boolean {
		const catalogEntry = page.data.catalog[obj.code];
		if (!catalogEntry) return false;
		if (page.data.catalog[obj.code].system.toLowerCase() == "xfreem"
		|| page.data.catalog[obj.code].system.toLowerCase() == "xfrees"
		|| page.data.catalog[obj.code].system.toLowerCase() == "xfree_s") {
			if (obj.code.includes("TC") && obj.code.includes("LC") && obj.code.includes("XC"))
			{return false;}
			else {return true;}
		}

		// Check if it has line junctions (characteristic of profiles)
		return catalogEntry.line_juncts && catalogEntry.line_juncts.length > 0;
	}

	/**
	 * Determine the predominant color in the configuration
	 * @returns 'BK' for black, 'WH' for white
	 */
	function getPredominantColor(): string {
		const colors: Record<string, number> = {};

		for (const obj of $objects) {
			// Find the family entry for this object
			for (const family of Object.values(page.data.families)) {
				const familyItem = family.items.find(item => item.code === obj.code);
				if (familyItem && familyItem.color) {
					const color = familyItem.color.toUpperCase();
					colors[color] = (colors[color] || 0) + 1;
				}
			}
		}

		// Check if we have more black or white objects
		const blackCount = (colors['MBK'] || 0) + (colors['BK'] || 0) + (colors['SBK'] || 0);
		const whiteCount = (colors['MWH'] || 0) + (colors['WH'] || 0) + (colors['SWH'] || 0);

		return blackCount >= whiteCount ? 'SBK' : 'SWH';
	}

	async function submit() {
		if (email === '') return toast.error($_("invoice.invalidEmail"));

		sendingEmail = true;
		const itemsMap: Map<string, number> = new Map();

		for (const object of $objects) {
			const key = object.code;
			itemsMap.set(key, 1 + (itemsMap.get(key) ?? 0));

			for (const subobj of object.subobjects) {
				const key2 = subobj.code;
				itemsMap.set(key2, 1 + (itemsMap.get(key2) ?? 0));
			}
		}
		for (const led of leds) {
			if (led.amount > 0) itemsMap.set(led.code, led.amount);
		}

		const items: { code: string; quantity: number; length?: number }[] = [];
		for (const [code, quantity] of itemsMap) items.push({ code, quantity });

		if (isXFreeSystem && suspensionEnabled) {
			let totalSuspensionElements = 0;

			for (const obj of $objects) {
				if (isProfile(obj)) {
					const profileLength = getProfileLength(obj);

					if (profileLength > 0 && profileLength < 1000) {
						totalSuspensionElements += 1;
					} else if (profileLength >= 1000) {
						totalSuspensionElements += 2;
					}
				}
			}

			if (totalSuspensionElements > 0) {
				const color = getPredominantColor();
				const currentSystem = page.data.system.toLowerCase().replace(' ', '_');

				// Determine the correct suspension element code based on system
				let suspensionPrefix = 'FEM50SK'; // Default for XFreeM
				if (currentSystem === 'xfree_s' || currentSystem === 'xfrees') {
					suspensionPrefix = 'FES35SK';
				}

				const suspensionCode = `${suspensionPrefix} ${color}`;
				items.push({
					code: suspensionCode,
					quantity: totalSuspensionElements
				});
			} else {
				console.log('SUSPENSION DEBUG - No suspension elements added (no profiles found or all have 0mm length)');
			}
		}

		for (const system of systems) {
			if (system.currentDriver && system.currentDriver !== 'none') {
				let quantity = Math.ceil(Math.abs(system.totalPower) / drivers.find((d) => d.code === system.currentDriver)!.power);
				if (quantity > 0) {
					quantity = Math.max(quantity, minDrivers);
					items.push({ code: system.currentDriver, quantity });
				}
			}
			
			// Aggiungi power supply separatamente se selezionato
			if (system.currentPowerSupply && system.currentPowerSupply !== 'none') {
				let driverQuantity = 0;
				if (system.currentDriver && system.currentDriver !== 'none') {
					driverQuantity = Math.max(
						Math.ceil(Math.abs(system.totalPower) / drivers.find((d) => d.code === system.currentDriver)!.power),
						minDrivers
					);
				}
				if (driverQuantity > 0) {
					items.push({ code: system.currentPowerSupply, quantity: driverQuantity });
				}
			}
			
			// Aggiungi box separatamente se selezionato
			if (system.currentBox && system.currentBox !== 'none') {
				let driverQuantity = 0;
				if (system.currentDriver && system.currentDriver !== 'none') {
					driverQuantity = Math.max(
						Math.ceil(Math.abs(system.totalPower) / drivers.find((d) => d.code === system.currentDriver)!.power),
						minDrivers
					);
				}
				if (driverQuantity > 0) {
					items.push({ code: system.currentBox, quantity: driverQuantity });
				}
			}
		}

		const blob: string = await html2pdf()
			.set({ margin: 6, html2canvas: { letterRendering: true, removeContainer: true } })
			.from(await invoiceTemplate(page.data.supabase, 'arelux-italia', email, items))
			.output('blob')
			.then(blobToBase64);

		const resp = await page.data.supabase.functions.invoke('send_email', {
			body: {
				to: email,
				tenant: 'arelux-italia',
				file: blob.replace('data:application/pdf;base64,', ''),
			},
		});

		sendingEmail = false;

		if (resp.error !== null || (resp.data.statusCode && resp.data.statusCode !== 200)) {
			toast.error($_("invoice.emailError"));
			console.error('Failed to send email:', resp.error, resp.data);
		} else {
			toast.success($_("invoice.emailSent"));
		}
	}

	const loaded: Set<string> = new SvelteSet();
</script>

<div
	class="absolute bottom-0 left-0 right-0 top-0 z-10 flex flex-col items-start justify-center bg-white p-10"
>
	{#if askForLeds && (page.state.currentPage === 0 || page.state.currentPage === undefined)}
		<span class="text-5xl font-semibold">{$_("config.selectComponents")}</span>

		<span class="py-6 text-2xl font-light">
			{$_("config.componentSelectionDescription")}
		</span>

		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Codice</Table.Head>
					<Table.Head>Descrizione</Table.Head>
					<Table.Head>Numero di pezzi</Table.Head>
				</Table.Row>
			</Table.Header>

			<Table.Body>
				{#each leds as led}
					<Table.Row>
						<Table.Cell>{led.code}</Table.Cell>
						<Table.Cell>{led.desc}</Table.Cell>
						<Table.Cell>
							<Input
								type="number"
								min="0"
								bind:value={led.amount}
								class="transition-all duration-75"
							/>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>

		<Button.Root
			class={button({ class: 'mt-6 flex' })}
			onclick={() => {
				// After LEDs, go to suspension page for XFree systems, otherwise go to drivers
				if (isXFreeSystem) {
					pushState('', { currentPage: 1 } as App.PageState);
				} else {
					pushState('', { currentPage: 2 } as App.PageState);
				}
			}}
		>
			{$_("invoice.next")} <ArrowRight size={22} class="ml-1" />
		</Button.Root>
	{:else if (page.state.currentPage === 1 && isXFreeSystem) || (!askForLeds && isXFreeSystem && page.state.currentPage === undefined)}
		<!-- Suspension page for XFreeS and XFreeM only -->
		<span class="text-5xl font-semibold">{$_("config.selectOptions")}</span>

		<span class="py-6 text-2xl font-light">
			{$_("config.suspendConfiguration")}
		</span>

		<div class="grid grid-cols-2 gap-6 mt-6 max-w-2xl">
			<button
				class={cn(
					'flex flex-col items-center justify-center gap-4 rounded-md border-2 p-6 text-left transition-colors',
					suspensionEnabled && 'border-primary',
				)}
				onclick={() => {
					suspensionEnabled = true;
				}}
			>
				<span class="text-3xl font-medium">{$_("common.yes")}</span>
				<span class="text-sm text-muted-foreground text-center">
					{$_("config.suspensionElementsAdded")}
				</span>
			</button>

			<button
				class={cn(
					'flex flex-col items-center justify-center gap-4 rounded-md border-2 p-6 text-left transition-colors',
					!suspensionEnabled && 'border-primary',
				)}
				onclick={() => {
					suspensionEnabled = false;
				}}
			>
				<span class="text-3xl font-medium">{$_("common.no")}</span>
				<span class="text-sm text-muted-foreground text-center">
					{$_("config.configurationNotSuspended")}
				</span>
			</button>
		</div>

		<div class="mt-6 flex gap-5">
			{#if askForLeds}
				<Button.Root
					class={button({ class: 'flex', color: 'secondary' })}
					onclick={() => history.back()}
				>
					<ArrowLeft size={22} class="mr-1" /> {$_("common.back")}
				</Button.Root>
			{/if}
			<Button.Root
				class={button({ class: 'flex' })}
				onclick={() => pushState('', { currentPage: 2 } as App.PageState)}
			>
				{$_("invoice.next")} <ArrowRight size={22} class="ml-1" />
			</Button.Root>
		</div>
	{:else if page.state.currentPage === 2 || (!askForLeds && !isXFreeSystem && page.state.currentPage === undefined)}
		<span class="text-5xl font-semibold">{$_("config.selectDrivers")}</span>

		<div class="max-h-[70vh] overflow-y-auto">
			{#each systems as system, systemIndex}
				<div class="mb-8 border-b-2 border-gray-200 pb-6 mt-8">
					<div class="mb-4">
						<h3 class="text-2xl font-semibold">{system.id}</h3>
						<span class="text-lg text-gray-600">
							{$_("config.totalPower")}: {system.totalPower}W
						</span>
						<div class="text-sm text-gray-500 mt-1">
							{system.objects.length} {$_("system.connectedObjects")}
						</div>
					</div>

					<div class="grid gap-3" class:grid-cols-3={showIntrack && showRemote} class:grid-cols-2={!(showIntrack && showRemote)}>
						{#if showIntrack && showRemote}
							<span class="text-center">{$_("config.intrack")}</span>
							<span class="text-center">{$_("config.remote")}</span>
							<span class="text-center">{$_("config.none")}</span>
						{:else if showIntrack}
							<span class="text-center">{$_("config.intrack")}</span>
							<span class="text-center">{$_("config.none")}</span>
						{:else if showRemote}
							<span class="text-center">{$_("config.remote")}</span>
							<span class="text-center">{$_("config.none")}</span>
						{/if}
						
						{#if showIntrack}
							{@const suitableIntrackDrivers = intrackDrivers.filter(driver => {
								const systemPowerAbs = Math.abs(system.totalPower);
								const isSuitable = driver.power >= systemPowerAbs;
								console.log(`INTRACK DEBUG - System: ${system.id}, Power: ${system.totalPower}W (abs: ${systemPowerAbs}W), Driver: ${driver.code} (${driver.power}W), Suitable: ${isSuitable}`);
								return isSuitable;
							})}
							{#if suitableIntrackDrivers.length > 0}
							{@const driver = suitableIntrackDrivers.reduce((min, current) => {
								console.log(`INTRACK SELECTION - Comparing ${current.code} (${current.power}W) vs ${min.code} (${min.power}W)`);
								return current.power < min.power ? current : min;
							})}
							{console.log(`INTRACK FINAL - Selected: ${driver.code} (${driver.power}W) for system ${system.id} (${system.totalPower}W)`)}
							{@const url = page.data.supabase.storage
								.from('arelux-italia')
								.getPublicUrl(`images/${driver.code}.webp`).data.publicUrl}
							<div class="flex flex-col gap-3">
								<button
									class={cn(
										'flex w-full items-start gap-6 rounded-md border-2 p-2 text-left transition-colors',
										system.currentDriver === driver.code && 'border-primary',
									)}
									onclick={() => {
										systems[systemIndex].currentDriver = driver.code;
										systems = [...systems];
									}}
								>
									<div class="flex h-full flex-col justify-start">
										<span class="mb-2 mt-3 text-lg font-medium">
											{driver.code}
											({driver.power}W)
										</span>

										<span class="text-sm text-muted-foreground">
											{$_("config.quantity")}: {Math.max(Math.ceil(Math.abs(system.totalPower) / driver.power), minDrivers)}
										</span>
									</div>

									<div class="relative ml-auto">
										<img
											src={url}
											width="125"
											height="125"
											alt=""
											onload={() => loaded.add(url)}
											class={cn(
												'h-[125px] rounded-full border-4 transition-all',
												loaded.has(url) || 'opacity-0',
											)}
										/>

										<div
											class={cn(
												'absolute right-0 top-0 z-10 h-[125px] w-[125px] animate-pulse rounded-full bg-gray-400',
												loaded.has(url) && 'hidden',
											)}
										></div>
									</div>
								</button>
							</div>
							{/if}
						{/if}

						{#if showRemote}
							{@const suitableRemoteDrivers = remoteDrivers.filter(driver => {
								const systemPowerAbs = Math.abs(system.totalPower);
								const isSuitable = driver.power >= systemPowerAbs;
								console.log(`REMOTE DEBUG - System: ${system.id}, Power: ${system.totalPower}W (abs: ${systemPowerAbs}W), Driver: ${driver.code} (${driver.power}W), Suitable: ${isSuitable}`);
								return isSuitable;
							})}
							{#if suitableRemoteDrivers.length > 0}
							{@const driver = suitableRemoteDrivers.reduce((min, current) => {
								console.log(`REMOTE SELECTION - Comparing ${current.code} (${current.power}W) vs ${min.code} (${min.power}W)`);
								return current.power < min.power ? current : min;
							})}
							{console.log(`REMOTE FINAL - Selected: ${driver.code} (${driver.power}W) for system ${system.id} (${system.totalPower}W)`)}
							{@const url = page.data.supabase.storage
								.from('arelux-italia')
								.getPublicUrl(`images/${driver.code}.webp`).data.publicUrl}
							<div class="flex flex-col gap-3">
								<button
									class={cn(
										'flex w-full items-start gap-6 rounded-md border-2 p-2 text-left transition-colors',
										system.currentDriver === driver.code && 'border-primary',
									)}
									onclick={() => {
										systems[systemIndex].currentDriver = driver.code;
										systems = [...systems];
									}}
								>
									<div class="flex h-full flex-col justify-start">
										<span class="mb-2 mt-3 text-lg font-medium">
											{driver.code}
											({driver.power}W)
										</span>

										<span class="text-sm text-muted-foreground">
											{$_("config.quantity")}: {Math.max(Math.ceil(Math.abs(system.totalPower) / driver.power), minDrivers)}
										</span>
									</div>

									<div class="relative ml-auto">
										<img
											src={url}
											width="125"
											height="125"
											alt=""
											onload={() => loaded.add(url)}
											class={cn(
												'h-[125px] rounded-full border-4 transition-all',
												loaded.has(url) || 'opacity-0',
											)}
										/>

										<div
											class={cn(
												'absolute right-0 top-0 z-10 h-[125px] w-[125px] animate-pulse rounded-full bg-gray-400',
												loaded.has(url) && 'hidden',
											)}
										></div>
									</div>
								</button>
							</div>
							{/if}
						{/if}

						<!-- Opzione "Nessun Driver" -->
						<div class="flex flex-col gap-3">
							<button
								class={cn(
									'flex w-full items-start gap-6 rounded-md border-2 p-2 text-left transition-colors',
									system.currentDriver === 'none' && 'border-primary',
								)}
								onclick={() => {
									systems[systemIndex].currentDriver = 'none';
									systems = [...systems];
								}}
							>
								<div class="flex h-full flex-col justify-start">
									<span class="mb-2 mt-3 text-lg font-medium">
										{$_("config.noDriver")}
									</span>

									<span class="text-sm text-muted-foreground">
										{$_("config.noDriverRequired")}
									</span>
								</div>
			
								<div class="relative ml-auto flex h-[125px] w-[125px] items-center justify-center rounded-full border-4 bg-gray-100">
									<Prohibit size={48} class="text-gray-500" />
								</div>
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<div class="mt-6 flex gap-5">
			{#if askForLeds}
				<Button.Root
					class={button({ class: 'flex', color: 'secondary' })}
					onclick={() => history.back()}
				>
					<ArrowLeft size={22} class="mr-1" /> {$_("common.back")}
				</Button.Root>
			{/if}

			<Button.Root
				class={button({ class: 'flex' })}
				disabled={systems.some(s => s.currentDriver === null)}
				onclick={() => {
					const currentSystem = page.data.system.toLowerCase().replace(' ', '_');
					const allIntrackOrNone = systems.every(s => s.currentDriver === 'none' || (s.currentDriver && !s.currentDriver.startsWith('AT')));
					const hasIntrack = systems.some(s => s.currentDriver && !s.currentDriver.startsWith('AT') && s.currentDriver !== 'none');

					if (allIntrackOrNone) {
						pushState('', { currentPage: 5 } as App.PageState);
					}
					else if (hasIntrack) {
						pushState('', { currentPage: 3 } as App.PageState);
					}
					else {
						if (currentSystem === 'xfree_s' || currentSystem === 'xfrees' || currentSystem === 'xfreem') {
							pushState('', { currentPage: 5 } as App.PageState);
						}
						else {
							pushState('', { currentPage: 3 } as App.PageState);
						}
					}
				}}
			>
				{$_("invoice.next")} <ArrowRight size={22} class="ml-1" />
			</Button.Root>
		</div>
		{:else if page.state.currentPage === 3}
			<span class="text-5xl font-semibold">{$_("invoice.heads")}</span>
			<span class="py-6 text-2xl font-light">
				{$_("config.totalPower")}: {power}W.
			</span>
		
			<!-- Mostra solo i sistemi che NON hanno driver INTRACK e NON hanno scelto "none" -->
			{#each systems.filter(system => system.currentDriver && system.currentDriver.startsWith('AT')) as system}
			{@const originalSystemIndex = systems.indexOf(system)}
				<div class="mb-6">
					<h3 class="mb-3 text-xl font-medium">{$_("config.system")} {originalSystemIndex + 1} - {system.currentDriver}</h3>
					<div class="grid grid-cols-3 gap-3">
						{#each availablePowerSupplies as psu}
							{@const url = page.data.supabase.storage
								.from('arelux-italia')
								.getPublicUrl(`images/${psu}.webp`).data.publicUrl}
							<button
								class={cn(
									'flex w-full items-start gap-6 rounded-md border-2 p-2 text-left transition-colors',
									system.currentPowerSupply === psu && 'border-primary',
								)}
								onclick={() => {
									systems[systems.indexOf(system)].currentPowerSupply = psu;
								}}
							>
								<div class="flex h-full flex-col justify-start">
									<span class="mb-2 mt-3 text-lg font-medium">
										{psu}
									</span>
									<span class="text-sm text-muted-foreground">
										{$_("config.quantity")}: {Math.max(
											Math.ceil(Math.abs(system.totalPower) / drivers.find((d) => d.code === system.currentDriver)!.power),
											minDrivers,
										)}
									</span>
								</div>
								<div class="relative ml-auto">
									<img
										src={url}
										width="125"
										height="125"
										alt=""
										onload={() => loaded.add(url)}
										class={cn(
											'h-[125px] rounded-full border-4 transition-all',
											loaded.has(url) || 'opacity-0',
										)}
									/>
									<div
										class={cn(
											'absolute right-0 top-0 z-10 h-[125px] w-[125px] animate-pulse rounded-full bg-gray-400',
											loaded.has(url) && 'hidden',
										)}
									></div>
								</div>
							</button>
						{/each}

						<!-- Opzione "Nessuna testa" -->
						<button
							class={cn(
								'flex w-full items-start gap-6 rounded-md border-2 p-2 text-left transition-colors',
								system.currentPowerSupply === 'none' && 'border-primary',
							)}
							onclick={() => {
								systems[systems.indexOf(system)].currentPowerSupply = 'none';
							}}
						>
							<div class="flex h-full flex-col justify-start">
								<span class="mb-2 mt-3 text-lg font-medium">
									{$_("config.noHead")}
								</span>
								<span class="text-sm text-muted-foreground">
									{$_("config.noHeadRequired")}
								</span>
							</div>
							<div class="relative ml-auto flex h-[125px] w-[125px] items-center justify-center rounded-full border-4 bg-gray-100">
								<Prohibit size={48} class="text-gray-500" />
							</div>
						</button>
					</div>
				</div>
			{/each}
		
			<!-- Se non ci sono sistemi REMOTE, mostra messaggio -->
			{#if systems.every(s => s.currentDriver === 'none' || (s.currentDriver && !s.currentDriver.startsWith('AT')))}
				<div class="text-center py-6">
					<p class="text-lg text-muted-foreground">
						{$_("config.allSystemsIntrackOrNone")}
					</p>
				</div>
			{/if}
		
			<div class="mt-6 flex gap-5">
				<Button.Root
					class={button({ class: 'flex', color: 'secondary' })}
					onclick={() => history.back()}
				>
					<ArrowLeft size={22} class="mr-1" /> {$_("common.back")}
				</Button.Root>
				<Button.Root
					class={button({ class: 'flex' })}
					disabled={systems.filter(s => s.currentDriver && s.currentDriver.startsWith('AT')).some(s => s.currentPowerSupply === null)}
					onclick={() => {
						// Se non ci sono sistemi REMOTE, vai direttamente all'email
						if (systems.every(s => s.currentDriver === 'none' || (s.currentDriver && !s.currentDriver.startsWith('AT')))) {
							pushState('', { currentPage: 5 } as App.PageState);
						} else {
							pushState('', { currentPage: 4 } as App.PageState);
						}
					}}
				>
					{$_("invoice.next")} <ArrowRight size={22} class="ml-1" />
				</Button.Root>
			</div>

			{:else if page.state.currentPage === 4}
			<span class="mb-6 text-5xl font-semibold">{$_("invoice.box")}</span>
		
			<!-- Mostra solo i sistemi che NON hanno driver INTRACK e NON hanno scelto "none" -->
			{#each systems.filter(system => system.currentDriver && system.currentDriver.startsWith('AT')) as system}
				{@const originalSystemIndex = systems.indexOf(system)}
				<div class="mb-6">
					<h3 class="mb-3 text-xl font-medium">{$_("config.system")} {originalSystemIndex + 1} - {system.currentDriver}</h3>
					<div class="grid grid-cols-3 gap-3">
						{#each boxes as box}
							{@const url = page.data.supabase.storage
								.from('arelux-italia')
								.getPublicUrl(`images/${box}.webp`).data.publicUrl}
							<button
								class={cn(
									'flex w-full items-start gap-6 rounded-md border-2 p-2 text-left transition-colors',
									system.currentBox === box && 'border-primary',
								)}
								onclick={() => {
									systems[systems.indexOf(system)].currentBox = box;
								}}
							>
								<div class="flex h-full flex-col justify-start">
									<span class="mb-2 mt-3 text-lg font-medium">
										{box}
									</span>
									<span class="text-sm text-muted-foreground">
										{$_("config.quantity")}: {Math.max(
											Math.ceil(Math.abs(system.totalPower) / drivers.find((d) => d.code === system.currentDriver)!.power),
											minDrivers,
										)}
									</span>
								</div>
								<div class="relative ml-auto">
									<img
										src={url}
										width="125"
										height="125"
										alt=""
										onload={() => loaded.add(url)}
										class={cn(
											'h-[125px] rounded-full border-4 transition-all',
											loaded.has(url) || 'opacity-0',
										)}
									/>
									<div
										class={cn(
											'absolute right-0 top-0 z-10 h-[125px] w-[125px] animate-pulse rounded-full bg-gray-400',
											loaded.has(url) && 'hidden',
										)}
									></div>
								</div>
							</button>
						{/each}
		
						<!-- Opzione "Nessuna scatola" -->
						<button
							class={cn(
								'flex w-full items-start gap-6 rounded-md border-2 p-2 text-left transition-colors',
								system.currentBox === 'none' && 'border-primary',
							)}
							onclick={() => {
								systems[systems.indexOf(system)].currentBox = 'none';
							}}
						>
							<div class="flex h-full flex-col justify-start">
								<span class="mb-2 mt-3 text-lg font-medium">
									{$_("config.noBox")}
								</span>
								<span class="text-sm text-muted-foreground">
									{$_("config.noBoxRequired")}
								</span>
							</div>
							<div class="relative ml-auto flex h-[125px] w-[125px] items-center justify-center rounded-full border-4 bg-gray-100">
								<Prohibit size={48} class="text-gray-500" />
							</div>
						</button>
					</div>
				</div>
			{/each}
		
			<!-- Se non ci sono sistemi REMOTE, mostra messaggio -->
			{#if systems.every(s => s.currentDriver === 'none' || (s.currentDriver && !s.currentDriver.startsWith('AT')))}
				<div class="text-center py-6">
					<p class="text-lg text-muted-foreground">
						{$_("config.allSystemsNoBox")}
					</p>
				</div>
			{/if}
		
			<div class="mt-6 flex gap-5">
				<Button.Root
					class={button({ class: 'flex', color: 'secondary' })}
					onclick={() => history.back()}
				>
					<ArrowLeft size={22} class="mr-1" /> {$_("common.back")}
				</Button.Root>
				<Button.Root
					class={button({ class: 'flex' })}
					disabled={systems.filter(s => s.currentDriver && s.currentDriver.startsWith('AT')).some(s => s.currentBox === null)}
					onclick={() =>
						pushState('', { currentPage: 5 } as App.PageState)}
				>
					{$_("invoice.next")} <ArrowRight size={22} class="ml-1" />
				</Button.Root>
			</div>
	{:else if page.state.currentPage === 5}
		<span class="text-5xl font-semibold">{$_("invoice.thankYou")}</span>

		<span class="pt-6 text-2xl font-light">
			{$_("invoice.insertEmail")}
		</span>

		<Input
			type="email"
			placeholder="mario.rossi@example.com"
			bind:value={email}
			class="my-6 h-12 w-full max-w-[60rem] rounded border-2 border-box3 px-5 py-3 text-lg transition-all"
		/>

		<div class="flex gap-5">
			<Button.Root
				class={button({ class: 'flex', color: 'secondary' })}
				onclick={() => history.back()}
			>
				<ArrowLeft size={22} class="mr-1" /> {$_("common.back")}
			</Button.Root>
			<button
				type="button"
				onclick={submit}
				disabled={email === '' || sendingEmail}
				class={button({ class: 'flex text-lg' })}
			>
				{#if sendingEmail}
					<LoaderCircle class="mr-1 animate-spin" size={28} />
				{/if}
				{$_("common.confirm")}
			</button>
		</div>
	{/if}

	<AreluxLogo top={false} />

	<Button.Root on:click={() => closeCallback()}>
		<X size={32} class="absolute right-6 top-6" />
	</Button.Root>
</div>