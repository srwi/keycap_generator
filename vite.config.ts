import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages project sites are served from `/<repo>/`.
  // Prefer deriving the repo name automatically so CI builds don't rely on a custom env var.
  // - In GitHub Actions, `GITHUB_REPOSITORY` is like "owner/repo".
  // - Locally, default to "/" for dev/preview.
  base: (() => {
    const repo = process.env.GITHUB_REPOSITORY?.split('/')?.[1]
    const isGhPages = !!process.env.GITHUB_PAGES || !!process.env.GITHUB_ACTIONS
    return isGhPages && repo ? `/${repo}/` : '/'
  })(),
  plugins: [svelte()],
})
