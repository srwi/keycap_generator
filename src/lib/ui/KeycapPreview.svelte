<script lang="ts">
  import { onDestroy, tick } from 'svelte'
  import { app } from '../state/store'
  import { generatePreviewModel } from '../generate/generate'
  import { stlBuffersByModelId } from '../state/sessionAssets'
  import { newId } from '../utils/id'
  import LabelPreview from './LabelPreview.svelte'
  import Model3DViewer from './Model3DViewer.svelte'
  import { showMessage } from '../state/modalStore'
  import type { Template } from '../state/types'
  import type { Group } from 'three'
  import { RefreshCw } from 'lucide-svelte'
  import { Button } from '@/lib/components/ui/button'

  export let template: Template | null = null
  export let textsBySymbolId: Record<string, string> = {}
  export let widthMm: number
  export let heightMm: number
  export let keyId: string | null = null // For generating 3D preview (null for templates)
  export let is3d = false

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
    return JSON.stringify(
      tpl.symbols
        .map(s => ({
          id: s.id,
          x: s.x,
          y: s.y,
          fontName: s.fontName,
          fontSizeMm: s.fontSizeMm,
          color: s.color,
          rotationDeg: s.rotationDeg,
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    )
  }

  $: needsRegenerate =
    lastGeneratedKeyId !== keyId ||
    lastGeneratedTemplateHash !== getTemplateHash(template) ||
    lastGeneratedTextsHash !== getTextsHash(textsBySymbolId)

  // Check if 3D preview is out of date (only relevant when viewing 3D)
  $: isOutOfDate = viewMode === '3d' && needsRegenerate

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

      const model = await generatePreviewModel(
        $app,
        effectiveKeyId,
        $stlBuffersByModelId,
        previewAbortController.signal
      )
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
        showMessage(e instanceof Error ? e.message : 'Preview generation failed.')
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

  $: viewMode = is3d ? '3d' : '2d'
  $: if (is3d && template && (!previewModel || needsRegenerate)) {
    generate3DPreview()
  }

  function onRefresh3D() {
    if (template && !isGeneratingPreview) {
      generate3DPreview()
    }
  }

  // Reset preview when keyId or template changes (but not during generation)
  $: if (
    !isGeneratingPreview &&
    isInitialized &&
    (keyId !== lastGeneratedKeyId || getTemplateHash(template) !== lastGeneratedTemplateHash)
  ) {
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
  <div class="relative">
    {#if !template}
      <div class="flex items-center justify-center h-64 text-sm text-muted-foreground">Select a key to preview</div>
    {:else if viewMode === '2d'}
      <div class="flex items-center justify-center">
        <LabelPreview {template} {textsBySymbolId} {widthMm} {heightMm} className="max-w-[340px]" />
      </div>
    {:else}
      <!-- 3D View -->
      <div class="h-96 overflow-hidden relative">
        <Model3DViewer modelGroup={previewModel} />

        {#if isGeneratingPreview}
          <!-- Loading overlay -->
          <div class="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
            <div class="flex flex-col items-center gap-3">
              <svg
                class="animate-spin h-8 w-8 text-primary"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <div class="text-sm text-muted-foreground">Generating preview…</div>
              <Button
                variant="destructive"
                size="sm"
                onclick={() => {
                  if (previewAbortController) {
                    previewAbortController.abort()
                    previewAbortController = null
                  }
                  isGeneratingPreview = false
                  previewModel = null
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        {:else if !previewModel || isOutOfDate}
          <!-- No preview or out of date - show refresh button overlay -->
          <div class="absolute inset-0 bg-background/60 flex items-center justify-center z-10 backdrop-blur-sm">
            <Button variant="secondary" class="flex items-center gap-2" onclick={onRefresh3D}>
              <RefreshCw class="size-4" />
              {previewModel ? 'Refresh 3D Preview' : 'Generate 3D Preview'}
            </Button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
