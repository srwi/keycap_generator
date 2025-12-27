<script lang="ts">
  import { app, actions, selectedKey } from '../state/store'
  import { generateAll3mfs } from '../generate/generate'
  import { stlBuffersByModelId } from '../state/sessionAssets'
  import LabelPreview from './LabelPreview.svelte'

  let isGenerating = false
  let progressText = ''

  $: key = $selectedKey
  $: tpl =
    key == null ? null : $app.templates.find((t) => t.id === key.templateId) ?? null
  $: model =
    tpl == null ? null : $app.keycapModels.find((m) => m.id === tpl.keycapModelId) ?? null
  $: modelWidthU = model?.widthU ?? 1
  $: modelHeightU = model?.heightU ?? 1

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
      progressText = `Done. Downloaded ${$app.keys.length} file(s).`
    } catch (e) {
      console.error(e)
      progressText = e instanceof Error ? e.message : 'Generation failed.'
      window.alert(progressText)
    } finally {
      isGenerating = false
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
            {isGenerating ? 'Generating…' : `Generate & download 3MF files (${$app.keys.length})`}
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
    </div>
  </section>

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1">
    <div class="text-sm font-semibold">Preview</div>
    <div class="mt-3 flex items-center justify-center">
      {#if key}
        <LabelPreview
          template={tpl}
          textsBySymbolId={key.textsBySymbolId}
          widthU={modelWidthU}
          heightU={modelHeightU}
          className="max-w-[340px]"
        />
      {:else}
        <div class="text-sm text-slate-400">Select a key to preview.</div>
      {/if}
    </div>
    <div class="mt-3 text-xs text-slate-400">
      This is the legend preview for the currently selected key.
    </div>
  </section>
</div>


