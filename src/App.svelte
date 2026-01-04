<script lang="ts">
  import { app } from './lib/state/store'
  import { downloadStateFile, loadStateFromFile, loadPreset } from './lib/state/persistence'
  import KeycapModelsEditor from './lib/ui/KeycapModelsEditor.svelte'
  import TemplateEditor from './lib/ui/TemplateEditor.svelte'
  import KeyEditor from './lib/ui/KeyEditor.svelte'
  import GeneratePanel from './lib/ui/GeneratePanel.svelte'

  let tab: 'models' | 'templates' | 'keys' | 'generate' = 'models'
  let selectedPreset: string = ''

  const presets = [
    { value: '60-percent', label: '60% Keyboard' },
    { value: 'planck', label: 'Planck' },
  ]

  async function onLoadPreset() {
    if (!selectedPreset) return
    if (window.confirm('Loading a preset will replace your current project. Continue?')) {
      await loadPreset(selectedPreset)
      selectedPreset = ''
    }
  }
</script>

<div class="min-h-dvh">
  <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
      <div class="flex-1">
        <div class="text-lg font-semibold leading-tight">Keycap Generator</div>
        <div class="text-xs text-slate-400">Templates → Keys → Generate 3MF (two-body, multi-color ready)</div>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          class="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800"
          on:click={() => downloadStateFile($app)}
        >
          Save project
        </button>

        <label
          class="cursor-pointer rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800"
        >
          Load project
          <input class="hidden" type="file" accept="application/json" on:change={loadStateFromFile} />
        </label>

        <div class="flex gap-2">
          <select
            class="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
            bind:value={selectedPreset}
          >
            <option value="">Select preset...</option>
            {#each presets as preset}
              <option value={preset.value}>{preset.label}</option>
            {/each}
          </select>
          <button
            class="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!selectedPreset}
            on:click={onLoadPreset}
          >
            Load preset
          </button>
        </div>
      </div>
    </div>
  </header>

  <div class="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4">
    <nav class="flex flex-wrap gap-2">
      <button
        class="rounded-md px-3 py-1.5 text-sm ring-1 ring-slate-800 hover:bg-slate-900"
        class:bg-slate-900={tab === 'models'}
        on:click={() => (tab = 'models')}
      >
        Models
      </button>
      <button
        class="rounded-md px-3 py-1.5 text-sm ring-1 ring-slate-800 hover:bg-slate-900"
        class:bg-slate-900={tab === 'templates'}
        on:click={() => (tab = 'templates')}
      >
        Templates
      </button>
      <button
        class="rounded-md px-3 py-1.5 text-sm ring-1 ring-slate-800 hover:bg-slate-900"
        class:bg-slate-900={tab === 'keys'}
        on:click={() => (tab = 'keys')}
      >
        Keys
      </button>
      <button
        class="rounded-md px-3 py-1.5 text-sm ring-1 ring-slate-800 hover:bg-slate-900"
        class:bg-slate-900={tab === 'generate'}
        on:click={() => (tab = 'generate')}
      >
        Generate
      </button>
    </nav>

    <div class="mt-4">
      {#if tab === 'models'}
        <KeycapModelsEditor />
      {:else if tab === 'templates'}
        <TemplateEditor />
      {:else if tab === 'keys'}
        <KeyEditor />
      {:else}
        <GeneratePanel />
      {/if}
    </div>
  </div>
</div>
