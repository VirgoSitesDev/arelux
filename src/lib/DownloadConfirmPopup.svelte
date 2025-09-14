<script lang="ts">
	import { Button } from 'bits-ui';
	import AreluxLogo from './Logo.svelte';
	import X from 'phosphor-svelte/lib/X';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
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
	const minDrivers = $derived(
		power !== 0 ? Math.ceil(getTotalLength($objects, page.data.families) / 10000) : 0,
	);

	let systems = $derived(() => {
		const systemsSet = new Set<string>();
		for (const obj of get(objects)) {
			if (page.data.catalog[obj.code]) {
				systemsSet.add(page.data.catalog[obj.code].system);
			}
		}
		return Array.from(systemsSet).map(systemCode => ({
			id: systemCode,
			name: systemCode
		}));
	});

	let systemDriverSelections = $state<Record<string, string>>({});
	let systemPowerSupplySelections = $state<Record<string, string>>({});
	let systemBoxSelections = $state<Record<string, string>>({});

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
		{ code: 'AT48.100', power: 100 },
		{ code: 'AT48.150', power: 150 },
		{ code: 'AT48.200', power: 200 },
		{ code: 'AT48.350', power: 350 },
	];
	const powerSupplies = ['XNRS01PCO.5', 'XNRS01PC2.5'];
	const boxes = ['SMCKS01SDB', 'SMCKS02SDB', 'SMCKS02TDB', 'SMCKS03TDB'];

	function getAvailableDriversForSystem(systemId: string) {
		const systemLower = systemId.toLowerCase();
		
		if (systemLower === 'xfree s' || systemLower === 'xfree_s') {
			return drivers.filter(driver => driver.code.startsWith('AT'));
		} else if (systemLower === 'xnet') {
			return drivers;
		}
		
		return drivers;
	}

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

	function blobToBase64(blob: Blob): Promise<string> {
		return new Promise((resolve, _) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.readAsDataURL(blob);
		});
	}

	async function submit() {
		if (email === '') return toast.error("Inserisci un'email valida");

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

		for (const system of systemsData) {
			const driver = systemDriverSelections[system.id];
			const powerSupply = systemPowerSupplySelections[system.id];
			const box = systemBoxSelections[system.id];

			if (driver) {
				const driverInfo = drivers.find(d => d.code === driver);
				if (driverInfo) {
					let quantity = Math.ceil(power / driverInfo.power);
					if (quantity > 0) {
						quantity = Math.max(quantity, minDrivers);
						items.push({ code: driver, quantity });
						
						if (powerSupply) items.push({ code: powerSupply, quantity });
						if (box) items.push({ code: box, quantity });
					}
				}
			}
		}

		const blob: string = await html2pdf()
			.set({ margin: 6, html2canvas: { letterRendering: true, removeContainer: true } })
			.from(await invoiceTemplate(page.data.supabase, page.data.tenant, email, items))
			.output('blob')
			.then(blobToBase64);

		const resp = await page.data.supabase.functions.invoke('send_email', {
			body: {
				to: email,
				tenant: page.data.tenant,
				file: blob.replace('data:application/pdf;base64,', ''),
			},
		});

		sendingEmail = false;

		if (resp.error !== null || (resp.data.statusCode && resp.data.statusCode !== 200)) {
			toast.error("C'è stato un errore durante l'invio della mail");
			console.error('Failed to send email:', resp.error, resp.data);
		} else {
			toast.success('Preventivo inviato, controlla la tua mail');
		}
	}

	const loaded: Set<string> = new SvelteSet();
</script>

<div
	class="absolute bottom-0 left-0 right-0 top-0 z-10 flex flex-col items-start justify-center bg-white p-10"
>
	{#if askForLeds && (page.state.currentPage === 0 || page.state.currentPage === undefined)}
		<span class="text-5xl font-semibold">Scegli i tuoi componenti o prosegui</span>

		<span class="py-6 text-2xl font-light">
			Per le configurzione a sospensione o a 3 cm dal soffito si può utilizzare strip led per
			illuminazione indiretta.
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
			onclick={() =>
				pushState('', { currentPage: (page.state.currentPage ?? 0) + 1 } as App.PageState)}
		>
			{$_("invoice.next")} <ArrowRight size={22} class="ml-1" />
		</Button.Root>
	{:else if page.state.currentPage === 1 || (!askForLeds && page.state.currentPage === undefined)}
		<span class="text-5xl font-semibold">{$_("config.selectDrivers")}</span>

		<span class="py-6 text-2xl font-light">
			{$_("config.totalPower")}: {power}W.
		</span>

		{#each systems as system}
			<div class="mb-8 w-full">
				<h3 class="mb-4 text-3xl font-medium">Sistema: {system.name}</h3>
				
				{@const availableDrivers = getAvailableDriversForSystem(system.id)}
				{@const intrackDrivers = availableDrivers.filter(driver => !driver.code.startsWith('AT'))}
				{@const remoteDrivers = availableDrivers.filter(driver => driver.code.startsWith('AT'))}
				{@const showIntrack = intrackDrivers.length > 0}
				{@const showRemote = remoteDrivers.length > 0}

				<div class="grid gap-3" class:grid-cols-2={showIntrack && showRemote} class:grid-cols-1={!(showIntrack && showRemote)}>
					{#if showIntrack && showRemote}
						<span class="text-center">INTRACK</span>
						<span class="text-center">REMOTE</span>
					{:else if showIntrack}
						<span class="text-center">INTRACK</span>
					{:else if showRemote}
						<span class="text-center">REMOTE</span>
					{/if}
					
					{#if showIntrack && intrackDrivers[0]}
						{@const intrackDriver = intrackDrivers[0]}
						{@const intrackUrl = page.data.supabase.storage
							.from(page.data.tenant)
							.getPublicUrl(`images/${intrackDriver.code}.webp`).data.publicUrl}
						
						<div class="flex flex-col gap-3">
							<button
								class={cn(
									'flex w-full items-start gap-6 rounded-md border-2 p-2 text-left transition-colors',
									systemDriverSelections[system.id] === intrackDriver.code && 'border-primary',
								)}
								onclick={() => systemDriverSelections[system.id] = intrackDriver.code}
							>
								<div class="flex h-full flex-col justify-start">
									<span class="mb-2 mt-3 text-lg font-medium">
										{intrackDriver.code}
										({intrackDriver.power}W)
									</span>
			
									<span class="text-sm text-muted-foreground">
										{$_("config.quantity")}: {Math.max(Math.ceil(power / intrackDriver.power), minDrivers)}
									</span>
								</div>
			
								<div class="relative ml-auto">
									<img
										src={intrackUrl}
										width="125"
										height="125"
										alt=""
										onload={() => loaded.add(intrackUrl)}
										class={cn(
											'h-[125px] rounded-full border-4 transition-all',
											loaded.has(intrackUrl) || 'opacity-0',
										)}
									/>
			
									<div
										class={cn(
											'absolute right-0 top-0 z-10 h-[125px] w-[125px] animate-pulse rounded-full bg-gray-400',
											loaded.has(intrackUrl) && 'hidden',
										)}
									></div>
								</div>
							</button>
						</div>
					{/if}
					
					{#if showRemote && remoteDrivers[0]}
						{@const remoteDriver = remoteDrivers[0]}
						{@const remoteUrl = page.data.supabase.storage
							.from(page.data.tenant)
							.getPublicUrl(`images/${remoteDriver.code}.webp`).data.publicUrl}
							
						<div class="flex flex-col gap-3">
							<button
								class={cn(
									'flex w-full items-start gap-6 rounded-md border-2 p-2 text-left transition-colors',
									systemDriverSelections[system.id] === remoteDriver.code && 'border-primary',
								)}
								onclick={() => systemDriverSelections[system.id] = remoteDriver.code}
							>
								<div class="flex h-full flex-col justify-start">
									<span class="mb-2 mt-3 text-lg font-medium">
										{remoteDriver.code}
										({remoteDriver.power}W)
									</span>
			
									<span class="text-sm text-muted-foreground">
										{$_("config.quantity")}: {Math.max(Math.ceil(power / remoteDriver.power), minDrivers)}
									</span>
								</div>
			
								<div class="relative ml-auto">
									<img
										src={remoteUrl}
										width="125"
										height="125"
										alt=""
										onload={() => loaded.add(remoteUrl)}
										class={cn(
											'h-[125px] rounded-full border-4 transition-all',
											loaded.has(remoteUrl) || 'opacity-0',
										)}
									/>
			
									<div
										class={cn(
											'absolute right-0 top-0 z-10 h-[125px] w-[125px] animate-pulse rounded-full bg-gray-400',
											loaded.has(remoteUrl) && 'hidden',
										)}
									></div>
								</div>
							</button>
						</div>
					{/if}
				</div>
			</div>
		{/each}

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
				disabled={systems.some(system => !systemDriverSelections[system.id])}
				onclick={() => {
					const allSystemsIntrack = systems.every(system => {
						const driver = systemDriverSelections[system.id];
						return driver && !driver.startsWith('AT');
					});
					
					if (allSystemsIntrack) {
						pushState('', { currentPage: 4 } as App.PageState);
					} else {
						pushState('', { currentPage: (page.state.currentPage ?? 1) + 1 } as App.PageState);
					}
				}}
			>
				{$_("invoice.next")} <ArrowRight size={22} class="ml-1" />
			</Button.Root>
		</div>
	{:else if page.state.currentPage === 2}
		<span class="text-5xl font-semibold">{$_("invoice.heads")}</span>
		<span class="py-6 text-2xl font-light">
			{$_("config.totalPower")}: {power}W.
		</span>
		
		{#each systems.filter(system => {
			const driver = systemDriverSelections[system.id];
			return driver && driver.startsWith('AT');
		}) as system}
			<div class="mb-8 w-full">
				<h3 class="mb-4 text-3xl font-medium">Sistema: {system.name}</h3>
				
				<div class="grid grid-cols-2 gap-3">
					{#each powerSupplies as psu}
						{@const url = page.data.supabase.storage
							.from(page.data.tenant)
							.getPublicUrl(`images/${psu}.webp`).data.publicUrl}
						<button
							class={cn(
								'flex w-full items-start gap-6 rounded-md border-2 p-2 text-left transition-colors',
								systemPowerSupplySelections[system.id] === psu && 'border-primary',
							)}
							onclick={() => systemPowerSupplySelections[system.id] = psu}
						>
							<div class="flex h-full flex-col justify-start">
								<span class="mb-2 mt-3 text-lg font-medium">
									{psu}
								</span>

								<span class="text-sm text-muted-foreground">
									{$_("config.quantity")}: {Math.max(
										Math.ceil(power / drivers.find((d) => d.code === systemDriverSelections[system.id])!.power),
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
				</div>
			</div>
		{/each}

		<div class="mt-6 flex gap-5">
			<Button.Root
				class={button({ class: 'flex', color: 'secondary' })}
				onclick={() => history.back()}
			>
				<ArrowLeft size={22} class="mr-1" /> {$_("common.back")}
			</Button.Root>
			<Button.Root
				class={button({ class: 'flex' })}
				disabled={systems
					.filter(system => {
						const driver = systemDriverSelections[system.id];
						return driver && driver.startsWith('AT');
					})
					.some(system => !systemPowerSupplySelections[system.id])
				}
				onclick={() =>
					pushState('', { currentPage: (page.state.currentPage ?? 1) + 1 } as App.PageState)}
			>
				{$_("invoice.next")} <ArrowRight size={22} class="ml-1" />
			</Button.Root>
		</div>
	{:else if page.state.currentPage === 3}
		<span class="mb-6 text-5xl font-semibold">{$_("invoice.box")}</span>

		{#each systems.filter(system => {
			const driver = systemDriverSelections[system.id];
			return driver && driver.startsWith('AT');
		}) as system}
			<div class="mb-8 w-full">
				<h3 class="mb-4 text-3xl font-medium">Sistema: {system.name}</h3>
				
				<div class="flex flex-col gap-3">
					{#each boxes as box}
						{@const url = page.data.supabase.storage
							.from(page.data.tenant)
							.getPublicUrl(`images/${box}.webp`).data.publicUrl}
						<button
							class={cn(
								'flex w-full items-start gap-6 rounded-md border-2 p-2 text-left transition-colors',
								systemBoxSelections[system.id] === box && 'border-primary',
							)}
							onclick={() => systemBoxSelections[system.id] = box}
						>
							<div class="flex h-full flex-col justify-start">
								<span class="mb-2 mt-3 text-lg font-medium">
									{box}
								</span>

								<span class="text-sm text-muted-foreground">
									{$_("config.quantity")}: {Math.max(
										Math.ceil(power / drivers.find((d) => d.code === systemDriverSelections[system.id])!.power),
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
				</div>
			</div>
		{/each}

		<div class="mt-6 flex gap-5">
			<Button.Root
				class={button({ class: 'flex', color: 'secondary' })}
				onclick={() => history.back()}
			>
				<ArrowLeft size={22} class="mr-1" /> {$_("common.back")}
			</Button.Root>
			<Button.Root
				class={button({ class: 'flex' })}
				disabled={systems
					.filter(system => {
						const driver = systemDriverSelections[system.id];
						return driver && driver.startsWith('AT');
					})
					.some(system => !systemBoxSelections[system.id])
				}
				onclick={() =>
					pushState('', { currentPage: (page.state.currentPage ?? 1) + 1 } as App.PageState)}
			>
				{$_("invoice.next")} <ArrowRight size={22} class="ml-1" />
			</Button.Root>
		</div>
	{:else if page.state.currentPage === 4}
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