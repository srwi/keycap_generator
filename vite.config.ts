import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/keycap_generator/' : '/',
  plugins: [svelte()],
})
