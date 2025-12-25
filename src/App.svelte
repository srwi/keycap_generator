<script lang="ts">
  import { app } from './lib/state/store'
  import { downloadStateFile, loadStateFromFile } from './lib/state/persistence'
  import TemplateEditor from './lib/ui/TemplateEditor.svelte'
  import KeyEditor from './lib/ui/KeyEditor.svelte'
  import GeneratePanel from './lib/ui/GeneratePanel.svelte'

  let tab: 'templates' | 'keys' | 'generate' = 'templates'
</script>

<div class="min-h-dvh">
  <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
    <div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
      <div class="flex-1">
        <div class="text-lg font-semibold leading-tight">Keycap Generator</div>
        <div class="text-xs text-slate-400">Templates → Keys → Generate 3MF (two-body, multi-color ready)</div>
      </div>

      <button
        class="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800"
        on:click={() => downloadStateFile($app)}
      >
        Save project
      </button>

      <label class="cursor-pointer rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800">
        Load project
        <input class="hidden" type="file" accept="application/json" on:change={loadStateFromFile} />
      </label>
    </div>
  </header>

  <div class="mx-auto max-w-7xl px-4 py-4">
    <nav class="flex flex-wrap gap-2">
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
      {#if tab === 'templates'}
        <TemplateEditor />
      {:else if tab === 'keys'}
        <KeyEditor />
      {:else}
        <GeneratePanel />
      {/if}
    </div>
  </div>
</div>
