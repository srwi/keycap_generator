<script lang="ts">
  import { onDestroy, tick } from 'svelte'
  import { app } from '../state/store'
  import { generatePreviewModel } from '../generate/generate'
  import { stlBuffersByModelId } from '../state/sessionAssets'
  import { newId } from '../utils/id'
  import LabelPreview from './LabelPreview.svelte'
  import Model3DViewer from './Model3DViewer.svelte'
  import type { Template } from '../state/types'
  import type { Group } from 'three'

  export let template: Template | null = null
  export let textsBySymbolId: Record<string, string> = {}
  export let widthMm: number
  export let heightMm: number
  export let keyId: string | null = null // For generating 3D preview (null for templates)

  let viewMode: '2d' | '3d' = '2d'
  let previewModel: Group | null = null
  let isGeneratingPreview = false
  let previewAbortController: AbortController | null = null
  let lastGeneratedKeyId: string | null = null
  let lastGeneratedTextsHash: string = ''
  let lastGeneratedTemplateHash: string = ''
  let tempKeyId: string | null = null
  let isInitialized = false

  // Compute hash of texts for change detection
  function getTextsHash(texts: Record<string, string>): string {
    return JSON.stringify(Object.entries(texts).sort(([a], [b]) => a.localeCompare(b)))
  }

  // Compute hash of template symbol properties for change detection
  function getTemplateHash(tpl: Template | null): string {
    if (!tpl) return ''
    return JSON.stringify(tpl.symbols.map(s => ({
      id: s.id,
      x: s.x,
      y: s.y,
      fontFamily: s.fontFamily,
      fontWeight: s.fontWeight,
      fontSizeMm: s.fontSizeMm,
      color: s.color,
      rotationDeg: s.rotationDeg,
    })).sort((a, b) => a.id.localeCompare(b.id)))
  }

  // Check if 3D preview is out of date
  $: isOutOfDate = viewMode === '3d' && (
    lastGeneratedKeyId !== keyId ||
    lastGeneratedTemplateHash !== getTemplateHash(template) ||
    lastGeneratedTextsHash !== getTextsHash(textsBySymbolId)
  )

  async function generate3DPreview() {
    if (!template || isGeneratingPreview) return

    // Cancel any existing preview generation
    if (previewAbortController) {
      previewAbortController.abort()
      previewAbortController = null
    }

    isGeneratingPreview = true
    previewAbortController = new AbortController()
    
    try {
      let effectiveKeyId = keyId
      
      // If no keyId (template preview), create a temporary key
      if (!effectiveKeyId) {
        tempKeyId = newId('temp-key')
        const tempKey = {
          id: tempKeyId,
          name: 'Temp Preview',
          templateId: template.id,
          textsBySymbolId,
        }
        // Temporarily add to state
        app.update(s => ({
          ...s,
          keys: [...s.keys, tempKey],
        }))
        // Wait for state to settle
        await tick()
        effectiveKeyId = tempKeyId
      }

      const model = await generatePreviewModel($app, effectiveKeyId, $stlBuffersByModelId, previewAbortController.signal)
      previewModel = model
      // Store the actual keyId (not tempKeyId) for comparison
      lastGeneratedKeyId = keyId ?? null
      lastGeneratedTemplateHash = getTemplateHash(template)
      lastGeneratedTextsHash = getTextsHash(textsBySymbolId)
      isInitialized = true

      // Clean up temporary key after a short delay to ensure generation is complete
      if (tempKeyId) {
        await new Promise(r => setTimeout(r, 100))
        app.update(s => ({
          ...s,
          keys: s.keys.filter(k => k.id !== tempKeyId),
        }))
        tempKeyId = null
      }
    } catch (e) {
      console.error(e)
      if (!(e instanceof Error && e.message === 'Preview generation cancelled')) {
        window.alert(e instanceof Error ? e.message : 'Preview generation failed.')
      }
      previewModel = null
      
      // Clean up temporary key on error
      if (tempKeyId) {
        app.update(s => ({
          ...s,
          keys: s.keys.filter(k => k.id !== tempKeyId),
        }))
        tempKeyId = null
      }
    } finally {
      isGeneratingPreview = false
      previewAbortController = null
    }
  }

  function onToggleView() {
    if (viewMode === '2d') {
      viewMode = '3d'
      // Generate preview if we don't have one or it's out of date
      if (template && (!previewModel || isOutOfDate)) {
        generate3DPreview()
      }
    } else {
      viewMode = '2d'
    }
  }

  function onRefresh3D() {
    if (template && !isGeneratingPreview) {
      generate3DPreview()
    }
  }

  // Reset preview when keyId or template changes (but not during generation)
  $: if (!isGeneratingPreview && isInitialized && (keyId !== lastGeneratedKeyId || getTemplateHash(template) !== lastGeneratedTemplateHash)) {
    previewModel = null
    lastGeneratedKeyId = null
    lastGeneratedTemplateHash = ''
    lastGeneratedTextsHash = ''
    // Clear tempKeyId if it exists (it will be recreated if needed)
    if (tempKeyId) {
      app.update(s => ({
        ...s,
        keys: s.keys.filter(k => k.id !== tempKeyId),
      }))
      tempKeyId = null
    }
  }

  // Cleanup on destroy
  onDestroy(() => {
    if (tempKeyId) {
      app.update(s => ({
        ...s,
        keys: s.keys.filter(k => k.id !== tempKeyId),
      }))
    }
    if (previewAbortController) {
      previewAbortController.abort()
    }
  })
</script>

<div class="flex flex-col gap-3">
  <div class="flex items-center justify-between">
    <div class="text-sm font-semibold">Preview</div>
    <button
      class="relative inline-flex items-center rounded-md border border-slate-700 bg-slate-900 p-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
      on:click={onToggleView}
      disabled={!template}
      role="switch"
      aria-checked={viewMode === '3d'}
    >
      <span class="relative flex w-full items-center">
        <span
          class="relative z-10 flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors text-center {viewMode === '2d'
            ? 'text-slate-200'
            : 'text-slate-400'}"
        >
          2D
        </span>
        <span
          class="relative z-10 flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors text-center {viewMode === '3d'
            ? 'text-slate-200'
            : 'text-slate-400'}"
        >
          3D
        </span>
      </span>
      <span
        class="absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%)] rounded bg-slate-800 transition-all duration-200 ease-in-out {viewMode === '3d'
          ? 'translate-x-[calc(100%-0.25rem)]'
          : 'translate-x-0'}"
      ></span>
    </button>
  </div>

  <div class="relative">
    {#if !template}
      <div class="flex items-center justify-center h-64 text-sm text-slate-400">
        Select a template to preview.
      </div>
    {:else if viewMode === '2d'}
      <div class="flex items-center justify-center">
        <LabelPreview
          template={template}
          textsBySymbolId={textsBySymbolId}
          widthMm={widthMm}
          heightMm={heightMm}
          className="max-w-[340px]"
        />
      </div>
    {:else}
      <!-- 3D View -->
      <div class="h-96 rounded-lg border border-slate-800 overflow-hidden relative">
        <Model3DViewer modelGroup={previewModel} />
        
        {#if isGeneratingPreview}
          <!-- Loading overlay -->
          <div class="absolute inset-0 bg-slate-950/80 flex items-center justify-center z-10">
            <div class="flex flex-col items-center gap-3">
              <svg class="animate-spin h-8 w-8 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div class="text-sm text-slate-300">Generating preview…</div>
              <button
                class="mt-1 rounded-md border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-xs text-red-200 hover:bg-red-950/60 transition-colors"
                on:click={() => {
                  if (previewAbortController) {
                    previewAbortController.abort()
                    previewAbortController = null
                  }
                  isGeneratingPreview = false
                  previewModel = null
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        {:else if !previewModel || isOutOfDate}
          <!-- No preview or out of date - show refresh button overlay -->
          <div class="absolute inset-0 bg-slate-950/60 flex items-center justify-center z-10 backdrop-blur-sm">
              <button
                class="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-lg font-medium"
                on:click={onRefresh3D}
              >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {previewModel ? 'Refresh 3D Preview' : 'Generate 3D Preview'}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

