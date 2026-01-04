<script lang="ts">
  import { app, actions } from '../state/store'
  import { generateAll3mfsWithWorker } from '../generate/generate'
  import { stlBuffersByModelId } from '../state/sessionAssets'
  import ProcessingModal from './ProcessingModal.svelte'

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

<div class="grid gap-4">
  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4">
    <div class="text-sm font-semibold">Generate</div>

    <div class="mt-3 grid gap-4">
      <div>
        <div class="text-xs font-semibold text-slate-300">3MF settings</div>
        <div class="mt-2 grid gap-3">
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
              Missing STL uploads for: {missingUploadModels.map(m => m.name).join(', ')}. Upload them in the Models
              step.
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>
</div>

<!-- Generation Modal -->
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
