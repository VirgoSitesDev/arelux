import { getSupabase } from '$lib';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/dbschema';

export let prerender = false;

const TENANT = 'arelux-italia';

async function loadModes(supabase: SupabaseClient<Database>, system: string): Promise<string[]> {
	const res = await supabase
		.from('families')
		.select('visible, familygroup')
		.eq('tenant', TENANT)
		.eq('system', system)
		.order('familygroup')
		.throwOnError();
	return [...new Set(res.data?.filter((x) => x.visible).map((x) => x.familygroup))];
}

export const load = async ({ params }: { params: { system: string } }) => {
	return {
		modes: await loadModes(getSupabase(), params.system),
		system: params.system,
	};
};