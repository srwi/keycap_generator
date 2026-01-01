<script lang="ts">
  import { app, actions } from '../state/store'
  import { generateAll3mfsWithWorker, generatePreviewModel } from '../generate/generate'
  import { stlBuffersByModelId } from '../state/sessionAssets'
  import Model3DViewer from './Model3DViewer.svelte'
  import ProcessingModal from './ProcessingModal.svelte'
  import type { Group } from 'three'

  let isGenerating = false
  let progressText = ''
  let selectedPreviewKeyId: string | null = null
  let previewModel: Group | null = null
  let isGeneratingPreview = false
  let previewProgressText = ''
  let generateAbortController: AbortController | null = null
  let previewAbortController: AbortController | null = null

  $: requiredModelIds = Array.from(
    new Set(
      $app.keys
        .map((k) => $app.templates.find((t) => t.id === k.templateId)?.keycapModelId)
        .filter((x): x is string => typeof x === 'string'),
    ),
  )
  $: missingUploadModels = requiredModelIds
    .map((id) => $app.keycapModels.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .filter((m) => m.source.kind === 'upload' && !$stlBuffersByModelId[m.id])

  async function onGenerate() {
    if (missingUploadModels.length > 0 || isGenerating) return

    isGenerating = true
    progressText = 'Starting generation...'
    generateAbortController = new AbortController()
    
    try {
      await generateAll3mfsWithWorker($app, $stlBuffersByModelId, (p) => {
        progressText = `Generating ${p.current}/${p.total}: ${p.keyName}`
      }, generateAbortController.signal)
      progressText = `Done. Downloaded keycaps.zip with ${$app.keys.length} file(s).`
      // Keep modal open briefly to show completion, then close
      await new Promise(r => setTimeout(r, 1500))
    } catch (e) {
      console.error(e)
      if (e instanceof Error && e.message === 'Generation cancelled') {
        progressText = 'Generation cancelled.'
      } else {
        progressText = e instanceof Error ? e.message : 'Generation failed.'
        window.alert(progressText)
      }
    } finally {
      isGenerating = false
      generateAbortController = null
      progressText = ''
    }
  }

  function onCancelGenerate() {
    if (generateAbortController) {
      generateAbortController.abort()
      generateAbortController = null
      isGenerating = false
      progressText = ''
    }
  }

  async function generatePreview(keyId: string | null) {
    if (!keyId || isGeneratingPreview) return

    // Cancel any existing preview generation
    if (previewAbortController) {
      previewAbortController.abort()
      previewAbortController = null
    }

    isGeneratingPreview = true
    previewProgressText = 'Generating preview...'
    previewAbortController = new AbortController()
    
    try {
      const model = await generatePreviewModel($app, keyId, $stlBuffersByModelId, previewAbortController.signal)
      previewModel = model
    } catch (e) {
      console.error(e)
      if (!(e instanceof Error && e.message === 'Preview generation cancelled')) {
        window.alert(e instanceof Error ? e.message : 'Preview generation failed.')
      }
      previewModel = null
    } finally {
      isGeneratingPreview = false
      previewAbortController = null
      previewProgressText = ''
    }
  }

  async function onPreviewKeyChange(keyId: string | null) {
    selectedPreviewKeyId = keyId
    previewModel = null
    if (keyId) {
      await generatePreview(keyId)
    }
  }

  function onCancelPreview() {
    if (previewAbortController) {
      previewAbortController.abort()
      previewAbortController = null
      isGeneratingPreview = false
      previewModel = null
      previewProgressText = ''
    }
  }
</script>

<div class="grid gap-4 lg:grid-cols-12">
  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-8">
    <div class="text-sm font-semibold">Generate</div>

    <div class="mt-3 grid gap-4">
      <div>
        <div class="text-xs font-semibold text-slate-300">3MF settings</div>
        <div class="mt-2 grid gap-3">
          <label class="grid gap-1 text-xs text-slate-400">
            Extrusion depth (mm)
            <input
              class="w-48 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              type="number"
              min="0.1"
              step="0.1"
              value={$app.settings.extrusionDepthMm}
              on:input={(e) => actions.setExtrusionDepthMm(Number((e.currentTarget as HTMLInputElement).value))}
            />
          </label>

          <button
            class="w-fit rounded-md border border-emerald-900/60 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-950/60 disabled:opacity-50"
            disabled={$app.keys.length === 0 || missingUploadModels.length > 0 || isGenerating}
            on:click={onGenerate}
          >
            Generate & download ZIP ({$app.keys.length} keys)
          </button>

          {#if $app.keys.length === 0}
            <div class="text-xs text-amber-300/90">Create at least one key first.</div>
          {:else if missingUploadModels.length > 0}
            <div class="text-xs text-amber-300/90">
              Missing STL uploads for: {missingUploadModels.map((m) => m.name).join(', ')}. Upload them in the Models step.
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4">
    <div class="text-sm font-semibold">3D Preview</div>
    <div class="mt-3 grid gap-3">
      <label class="grid gap-1 text-xs text-slate-400">
        Select keycap to preview
        <select
          class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          value={selectedPreviewKeyId ?? ''}
          disabled={missingUploadModels.length > 0 || isGeneratingPreview}
          on:change={(e) => {
            const keyId = (e.currentTarget as HTMLSelectElement).value || null
            onPreviewKeyChange(keyId)
          }}
        >
          <option value="">— Select a keycap —</option>
          {#each $app.keys as k}
            <option value={k.id}>{k.name}</option>
          {/each}
        </select>
      </label>
    </div>
    <div class="mt-3 h-96 rounded-lg border border-slate-800 overflow-hidden relative">
      {#if previewModel}
        <Model3DViewer modelGroup={previewModel} />
      {:else}
        <div class="flex h-full items-center justify-center text-sm text-slate-400">
          {#if selectedPreviewKeyId}
            {#if isGeneratingPreview}
              Generating preview…
            {:else}
              Select a keycap from the dropdown above to see the 3D model
            {/if}
          {:else}
            Select a keycap from the dropdown above to see the 3D model
          {/if}
        </div>
      {/if}
      {#if isGeneratingPreview}
        <div class="absolute inset-0 bg-slate-950/80 flex items-center justify-center z-10">
          <div class="flex flex-col items-center gap-3">
            <svg class="animate-spin h-8 w-8 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div class="text-sm text-slate-300">{previewProgressText || 'Generating preview…'}</div>
            <button
              class="mt-1 rounded-md border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-xs text-red-200 hover:bg-red-950/60 transition-colors"
              on:click={onCancelPreview}
            >
              Cancel
            </button>
          </div>
        </div>
      {/if}
    </div>
  </section>
</div>

<!-- Generation Modal -->
{#if isGenerating}
  <ProcessingModal
    title="Generating Keycaps"
    statusText={progressText}
    spinnerColor="text-emerald-400"
    onCancel={onCancelGenerate}
  />
{/if}


