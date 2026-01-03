<script lang="ts">
  import LabelPreview from './LabelPreview.svelte'
  import type { Template } from '../state/types'
  import { DEFAULT_KEYCAP_SIZE_MM } from '../state/types'
  
  export let title: string
  export let onCancel: () => void
  export let current: number = 0
  export let total: number = 0
  export let previewTemplate: Template | null = null
  export let previewTextsBySymbolId: Record<string, string> = {}
  export let previewWidthMm: number = DEFAULT_KEYCAP_SIZE_MM
  export let previewHeightMm: number = DEFAULT_KEYCAP_SIZE_MM
  
  $: progressPercent = total > 0 ? (current / total) * 100 : 0
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <div class="rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl max-w-md w-full mx-4">
    <div class="flex flex-col items-center">
      <h3 id="modal-title" class="text-sm font-semibold text-slate-200 mb-6">{title}</h3>
      
      {#if previewTemplate}
        <div class="flex justify-center mb-6">
          <LabelPreview
            template={previewTemplate}
            textsBySymbolId={previewTextsBySymbolId}
            widthMm={previewWidthMm}
            heightMm={previewHeightMm}
            className="max-w-[120px]"
          />
        </div>
      {/if}
      
      {#if total > 0}
        <div class="w-full mb-6">
          <div class="flex justify-between text-xs text-slate-400 mb-2">
            <span>{current} / {total}</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              class="h-full bg-emerald-500 transition-all duration-300 ease-out"
              style="width: {progressPercent}%"
            ></div>
          </div>
        </div>
      {/if}
      
      <button
        class="rounded-md border border-red-900/60 bg-red-950/30 px-4 py-2 text-sm text-red-200 hover:bg-red-950/60 transition-colors"
        on:click={onCancel}
      >
        Cancel
      </button>
    </div>
  </div>
</div>

