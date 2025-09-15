import { selectedSystem } from '$lib';
import { get } from 'svelte/store';
import type { LayoutLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutLoad = async ({ parent, url }) => {
	const { supabase, tenant } = await parent();
	const sessionData = await supabase.auth.getSession();
	const isNotLoggedIn = sessionData.error !== null || sessionData.data.session === null;
	if (isNotLoggedIn) redirect(302, `/login`);

	if (
		get(selectedSystem) === '' &&
		!url.pathname.includes('/systemselect') &&
		!url.pathname.includes('/systemadd')
	)
		if ((await parent()).systems.length === 0) redirect(302, `/admin/systemselect`);
		else redirect(302, `/admin/systemselect`);
	return await parent();
};
