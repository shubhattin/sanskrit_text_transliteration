import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			runtime: 'edge'
		}),
		alias: {
			'@tools': './src/tools',
			'@tests': './src/tests',
			'@components': './src/components',
			'@db': './src/db',
			'@api': './src/api',
			'@data': './data'
		}
	}
};

export default config;
