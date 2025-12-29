<script lang="ts">
  import { app, actions } from '../state/store'
  import { generateAll3mfs, generatePreviewModel } from '../generate/generate'
  import { stlBuffersByModelId } from '../state/sessionAssets'
  import Model3DViewer from './Model3DViewer.svelte'
  import type { Group } from 'three'

  let isGenerating = false
  let progressText = ''
  let selectedPreviewKeyId: string | null = null
  let previewModel: Group | null = null
  let isGeneratingPreview = false

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
    if (missingUploadModels.length > 0) return
    isGenerating = true
    progressText = ''
    try {
      await generateAll3mfs($app, $stlBuffersByModelId, (p) => {
        progressText = `Generating ${p.current}/${p.total}: ${p.keyName}`
      })
      progressText = `Done. Downloaded keycaps.zip with ${$app.keys.length} file(s).`
    } catch (e) {
      console.error(e)
      progressText = e instanceof Error ? e.message : 'Generation failed.'
      window.alert(progressText)
    } finally {
      isGenerating = false
    }
  }

  async function onPreview() {
    if (!selectedPreviewKeyId) return
    isGeneratingPreview = true
    try {
      const model = await generatePreviewModel($app, selectedPreviewKeyId, $stlBuffersByModelId)
      previewModel = model
    } catch (e) {
      console.error(e)
      window.alert(e instanceof Error ? e.message : 'Preview generation failed.')
      previewModel = null
    } finally {
      isGeneratingPreview = false
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
            {isGenerating ? 'Generating…' : `Generate & download ZIP (${$app.keys.length} keys)`}
          </button>

          {#if $app.keys.length === 0}
            <div class="text-xs text-amber-300/90">Create at least one key first.</div>
          {:else if missingUploadModels.length > 0}
            <div class="text-xs text-amber-300/90">
              Missing STL uploads for: {missingUploadModels.map((m) => m.name).join(', ')}. Upload them in the Models step.
            </div>
          {/if}

          {#if progressText}
            <div class="text-xs text-slate-300">{progressText}</div>
          {/if}
        </div>
      </div>

      <div>
        <div class="text-xs font-semibold text-slate-300">3D Preview</div>
        <div class="mt-2 grid gap-3">
          <label class="grid gap-1 text-xs text-slate-400">
            Select keycap to preview
            <select
              class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              value={selectedPreviewKeyId ?? ''}
              on:change={(e) => {
                selectedPreviewKeyId = (e.currentTarget as HTMLSelectElement).value || null
                previewModel = null
              }}
            >
              <option value="">— Select a keycap —</option>
              {#each $app.keys as k}
                <option value={k.id}>{k.name}</option>
              {/each}
            </select>
          </label>

          <button
            class="w-fit rounded-md border border-blue-900/60 bg-blue-950/30 px-4 py-2 text-sm text-blue-200 hover:bg-blue-950/60 disabled:opacity-50"
            disabled={!selectedPreviewKeyId || isGeneratingPreview || missingUploadModels.length > 0}
            on:click={onPreview}
          >
            {isGeneratingPreview ? 'Generating preview…' : 'Preview 3D Model'}
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4">
    <div class="text-sm font-semibold">3D Preview</div>
    <div class="mt-3 h-96 rounded-lg border border-slate-800 overflow-hidden">
      {#if previewModel}
        <Model3DViewer modelGroup={previewModel} />
      {:else if isGeneratingPreview}
        <div class="flex h-full items-center justify-center text-sm text-slate-400">
          Generating preview…
        </div>
      {:else}
        <div class="flex h-full items-center justify-center text-sm text-slate-400">
          Select a keycap and click Preview to see the 3D model
        </div>
      {/if}
    </div>
  </section>
</div>


