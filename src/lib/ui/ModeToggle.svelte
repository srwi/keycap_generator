<script lang="ts">
  import { Moon } from 'lucide-svelte'
  import { Toggle } from '@/lib/components/ui/toggle'
  import { setTheme, theme, type Theme } from '@/lib/state/theme'

  export let storageKey: string = 'vite-ui-theme'

  function getEffectiveTheme(t: Theme): Exclude<Theme, 'system'> {
    if (t === 'dark' || t === 'light') return t
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
  }

  let darkModePressed = false
  let prevEffective: 'dark' | 'light' | null = null

  // Keep the toggle in sync with the currently applied (effective) theme.
  $: {
    const eff = getEffectiveTheme($theme)
    if (eff !== prevEffective) {
      prevEffective = eff
      darkModePressed = eff === 'dark'
    }
  }

  // When the user toggles, set an explicit theme (dark/light). This also "breaks out" of system mode.
  $: if (darkModePressed && getEffectiveTheme($theme) !== 'dark') setTheme('dark', storageKey)
  $: if (!darkModePressed && getEffectiveTheme($theme) !== 'light') setTheme('light', storageKey)
</script>

<Toggle
  bind:pressed={darkModePressed}
  aria-label="Toggle dark mode"
  size="sm"
  variant="outline"
  class="data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-blue-500 data-[state=on]:*:[svg]:stroke-blue-500"
>
  <Moon class="size-4" />
  <span class="sr-only">Dark mode</span>
</Toggle>
