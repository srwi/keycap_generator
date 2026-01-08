<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { app } from './lib/state/store'
  import { downloadStateFile, loadStateFromFile, loadPreset } from './lib/state/persistence'
  import { generateAll3mfsWithWorker } from './lib/generate/generate'
  import { stlBuffersByModelId } from './lib/state/sessionAssets'
  import KeycapModelsEditor from './lib/ui/KeycapModelsEditor.svelte'
  import TemplateEditor from './lib/ui/TemplateEditor.svelte'
  import KeyEditor from './lib/ui/KeyEditor.svelte'
  import ProcessingModal from './lib/ui/ProcessingModal.svelte'
  import ModalContainer from './lib/ui/ModalContainer.svelte'
  import { showMessage, showConfirm } from './lib/state/modalStore'
  import { clickOutside } from './lib/ui/actions/clickOutside'
  import { Download, Upload, BookOpen, ChevronDown, Trash2, Github, Star, Heart, Coffee } from 'lucide-svelte'
  import { registerCustomFonts } from './lib/generate/fonts'

  let tab: 'models' | 'templates' | 'keys' = 'models'
  let presetsMenuOpen = false
  let presetsMenuRef: HTMLElement

  const presets = [
    { value: 'numpad', label: 'Numpad' },
    { value: '40-percent-ortho', label: '40% Ortholinear' },
    { value: '60-percent', label: '60% ANSI' },
  ]

  function onLoadPreset(presetValue: string) {
    presetsMenuOpen = false
    showConfirm('Loading a preset will replace your current project. Continue?', async () => {
      const error = await loadPreset(presetValue)
      if (error) {
        showMessage(error)
      }
    })
  }

  function onClear() {
    showConfirm('This will delete all models, templates, and keys. Continue?', () => {
      stlBuffersByModelId.set({})
      app.set({
        version: 1,
        keycapModels: [],
        templates: [],
        keys: [],
        customFonts: [],
        ui: {
          selectedKeycapModelId: null,
          selectedTemplateId: null,
          selectedKeyId: null,
        },
      })
    })
  }

  $: registerCustomFonts($app.customFonts)

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
        showMessage(e instanceof Error ? e.message : 'Generation failed.')
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

  $: hasUnsavedChanges = $app.keycapModels.length > 0 || $app.templates.length > 0 || $app.keys.length > 0

  function handleBeforeUnload(event: BeforeUnloadEvent) {
    if (hasUnsavedChanges) {
      event.preventDefault()
      return ''
    }
  }

  onMount(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  onDestroy(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })
</script>

<div class="flex min-h-dvh flex-col">
  <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
      <div class="flex-1">
        <div class="text-lg font-semibold leading-tight">Keycap Generator</div>
        <div class="text-xs text-slate-400">Custom keycap model generator for multi-color 3D printing</div>
      </div>

      <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <button
          class="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs hover:bg-slate-800 sm:px-2.5 sm:text-sm"
          on:click={() => downloadStateFile($app)}
          title="Save project"
        >
          <Download class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span class="hidden sm:inline">Save</span>
        </button>

        <label
          class="flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs hover:bg-slate-800 sm:px-2.5 sm:text-sm"
          title="Load project"
        >
          <Upload class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span class="hidden sm:inline">Load</span>
          <input
            class="hidden"
            type="file"
            accept="application/json"
            on:change={async e => {
              const error = await loadStateFromFile(e)
              if (error) {
                showMessage(error)
              }
            }}
          />
        </label>

        <div class="relative" bind:this={presetsMenuRef} use:clickOutside={() => (presetsMenuOpen = false)}>
          <button
            class="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs hover:bg-slate-800 sm:px-2.5 sm:text-sm"
            on:click={() => (presetsMenuOpen = !presetsMenuOpen)}
            title="Load preset"
          >
            <BookOpen class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span class="sm:hidden">Presets</span>
            <span class="hidden sm:inline">Load preset</span>
            <ChevronDown class="h-3 w-3" />
          </button>
          {#if presetsMenuOpen}
            <div
              class="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-slate-700 bg-slate-900 shadow-lg sm:right-0 sm:left-auto"
            >
              {#each presets as preset}
                <button
                  class="w-full px-3 py-2 text-left text-xs text-slate-100 hover:bg-slate-800 first:rounded-t-md last:rounded-b-md sm:text-sm"
                  on:click={() => onLoadPreset(preset.value)}
                >
                  {preset.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <button
          class="flex items-center gap-1.5 rounded-md border border-red-700/60 bg-red-950/30 px-2 py-1.5 text-xs text-red-200 hover:bg-red-950/60 sm:px-2.5 sm:text-sm"
          on:click={onClear}
          title="Clear all"
        >
          <Trash2 class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span class="hidden sm:inline">Clear</span>
        </button>
      </div>
    </div>
  </header>

  <div class="mx-auto flex-1 w-full max-w-6xl px-3 py-4 sm:px-4">
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

  <ModalContainer />

  <footer class="mt-auto border-t border-slate-800 bg-slate-950/80 backdrop-blur">
    <div
      class="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-3 py-6 sm:flex-row sm:px-4"
    >
      <div class="flex items-center gap-4">
        <a
          href="https://github.com/srwi/keycap_generator"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100"
        >
          <Github class="h-4 w-4" />
          <span>View on GitHub</span>
        </a>

        <a
          href="https://github.com/srwi/keycap_generator"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 rounded-md border border-emerald-700/60 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-200 transition-all hover:border-emerald-600/60 hover:bg-emerald-950/60 hover:text-emerald-100"
        >
          <Star class="h-4 w-4" />
          <span>Star</span>
        </a>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-sm text-slate-400">Donate:</span>
        <a
          href="https://paypal.me/rumswinkel"
          target="_blank"
          rel="noopener noreferrer"
          title="Support this project via PayPal"
          class="flex items-center gap-2 rounded-md border border-blue-700/60 bg-blue-950/30 px-4 py-2 text-sm font-medium text-blue-200 transition-all hover:border-blue-600/60 hover:bg-blue-950/60 hover:text-blue-100"
        >
          <Heart class="h-4 w-4" />
          <span>PayPal</span>
        </a>

        <a
          href="https://ko-fi.com/stephanrwi"
          target="_blank"
          rel="noopener noreferrer"
          title="Support this project via Ko-fi"
          class="flex items-center gap-2 rounded-md border border-orange-700/60 bg-orange-950/30 px-4 py-2 text-sm font-medium text-orange-200 transition-all hover:border-orange-600/60 hover:bg-orange-950/60 hover:text-orange-100"
        >
          <Coffee class="h-4 w-4" />
          <span>Ko-fi</span>
        </a>
      </div>
    </div>
  </footer>
</div>
