<script lang="ts">
  import { app } from './lib/state/store'
  import { downloadStateFile, loadStateFromFile, loadPreset } from './lib/state/persistence'
  import { generateAll3mfsWithWorker } from './lib/generate/generate'
  import { stlBuffersByModelId } from './lib/state/sessionAssets'
  import KeycapModelsEditor from './lib/ui/KeycapModelsEditor.svelte'
  import TemplateEditor from './lib/ui/TemplateEditor.svelte'
  import KeyEditor from './lib/ui/KeyEditor.svelte'
  import ProcessingModal from './lib/ui/ProcessingModal.svelte'

  let tab: 'models' | 'templates' | 'keys' = 'models'
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

  let isGenerating = false
  let progressCurrent = 0
  let progressTotal = 0
  let currentGeneratingKeyId: string | null = null
  let generateAbortController: AbortController | null = null

  $: requiredModelIds = Array.from(
    new Set(
      $app.keys
        .map(k => $app.templates.find(t => t.id === k.templateId)?.keycapModelId)
        .filter((x): x is string => typeof x === 'string')
    )
  )
  $: missingUploadModels = requiredModelIds
    .map(id => $app.keycapModels.find(m => m.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .filter(m => m.source.kind === 'upload' && !$stlBuffersByModelId[m.id])

  async function onGenerate() {
    if (missingUploadModels.length > 0 || isGenerating) return

    isGenerating = true
    progressCurrent = 0
    progressTotal = $app.keys.length
    currentGeneratingKeyId = null
    generateAbortController = new AbortController()

    try {
      await generateAll3mfsWithWorker(
        $app,
        $stlBuffersByModelId,
        p => {
          progressCurrent = p.current
          progressTotal = p.total
          currentGeneratingKeyId = p.keyId
        },
        generateAbortController.signal
      )
      // Keep modal open briefly to show completion, then close
      await new Promise(r => setTimeout(r, 1500))
    } catch (e) {
      console.error(e)
      if (!(e instanceof Error && e.message === 'Generation cancelled')) {
        window.alert(e instanceof Error ? e.message : 'Generation failed.')
      }
    } finally {
      isGenerating = false
      generateAbortController = null
      progressCurrent = 0
      progressTotal = 0
      currentGeneratingKeyId = null
    }
  }

  $: currentKey = currentGeneratingKeyId ? $app.keys.find(k => k.id === currentGeneratingKeyId) : null
  $: currentTemplate = currentKey ? $app.templates.find(t => t.id === currentKey.templateId) : null
  $: currentModel = currentTemplate ? $app.keycapModels.find(m => m.id === currentTemplate.keycapModelId) : null

  function onCancelGenerate() {
    if (generateAbortController) {
      generateAbortController.abort()
      generateAbortController = null
      isGenerating = false
    }
  }
</script>

<div class="min-h-dvh">
  <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
      <div class="flex-1">
        <div class="text-lg font-semibold leading-tight">Keycap Generator</div>
        <div class="text-xs text-slate-400">Custom keycap model generator for multi-color 3D printing</div>
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
        class="rounded-md border border-emerald-900/60 bg-emerald-950/30 px-3 py-1.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-950/60 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={$app.keys.length === 0 || missingUploadModels.length > 0 || isGenerating}
        on:click={onGenerate}
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
      {/if}
    </div>
  </div>

  {#if isGenerating}
    <ProcessingModal
      title="Generating Keycaps"
      onCancel={onCancelGenerate}
      current={progressCurrent}
      total={progressTotal}
      previewTemplate={currentTemplate ?? null}
      previewTextsBySymbolId={currentKey?.textsBySymbolId ?? {}}
      previewWidthMm={currentModel?.widthMm ?? 0}
      previewHeightMm={currentModel?.heightMm ?? 0}
    />
  {/if}
</div>
