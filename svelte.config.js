import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),

		alias: {
			$shad: './src/shadcn',
		},

		prerender: {
			entries: [
				'/',
				'/admin',
				'/admin/add',
				'/admin/familyadd',
				'/admin/systemadd',
				'/admin/systemselect',
				'/login',
				'/test',
				'/xnet',
				'/xfree_s',
				'/xnet/add',
				'/xfree_s/add',
			],
		},
	},
};

export default config;
