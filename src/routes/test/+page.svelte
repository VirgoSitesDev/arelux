<script lang="ts">
	import { onMount } from 'svelte';
	import { Renderer } from '$lib/renderer/renderer';
	import ConfigCurveShape from '$lib/config/ConfigCurveShape.svelte';
	import type { FamilyEntry } from '../../app.js';

	let canvas: HTMLCanvasElement;
	let { data } = $props();

	const items: FamilyEntry[] = [
		{
			len: 0,
			deg: 30,
			radius: 30,
			color: '',
			desc1: '',
			desc2: '',
			code: '',
			total_length: 0,
		},
	];
</script>

<ConfigCurveShape family={data.families['profili-superficiali']} />

