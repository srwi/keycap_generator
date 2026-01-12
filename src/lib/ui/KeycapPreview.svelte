<script lang="ts">
  import { onDestroy } from 'svelte'
  import { generatePreview } from '../generate/generation-api'
  import { app } from '../state/store'
  import { stlBuffersByModelId } from '../state/sessionAssets'
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
  let isCancellingPreview = false
  let previewAbortController: AbortController | null = null
  let lastGeneratedKeyId: string | null = null
  let lastGeneratedTextsHash: string = ''
  let lastGeneratedTemplateHash: string = ''

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
    isCancellingPreview = false
    previewAbortController = new AbortController()

    try {
      const model = await generatePreview({
        state: $app,
        input: keyId
          ? { kind: 'keyId', keyId }
          : { kind: 'template', template, textsBySymbolId },
        stlBuffersByModelId: $stlBuffersByModelId,
        signal: previewAbortController.signal,
      })
      previewModel = model
      lastGeneratedKeyId = keyId ?? null
      lastGeneratedTemplateHash = getTemplateHash(template)
      lastGeneratedTextsHash = getTextsHash(textsBySymbolId)
    } catch (e) {
      console.error(e)
      if (!(e instanceof Error && e.message === 'Preview generation cancelled')) {
        showMessage(e instanceof Error ? e.message : 'Preview generation failed.')
      }
      previewModel = null
    } finally {
      isGeneratingPreview = false
      isCancellingPreview = false
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
    (keyId !== lastGeneratedKeyId || getTemplateHash(template) !== lastGeneratedTemplateHash)
  ) {
    previewModel = null
    lastGeneratedKeyId = null
    lastGeneratedTemplateHash = ''
    lastGeneratedTextsHash = ''
  }

  // Cleanup on destroy
  onDestroy(() => {
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
          <div class="absolute inset-0 backdrop-blur-sm flex items-center justify-center z-10">
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
              <div class="text-sm text-muted-foreground">
                {isCancellingPreview ? 'Cancelling preview…' : 'Generating preview…'}
              </div>
              <Button
                variant="destructive"
                size="sm"
                onclick={() => {
                  if (previewAbortController) {
                    isCancellingPreview = true
                    previewAbortController.abort()
                  }
                }}
                disabled={isCancellingPreview}
              >
                Cancel
              </Button>
            </div>
          </div>
        {:else if !previewModel || isOutOfDate}
          <!-- No preview or out of date - show refresh button overlay -->
          <div class="absolute inset-0 flex items-center justify-center z-10 backdrop-blur-sm">
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
