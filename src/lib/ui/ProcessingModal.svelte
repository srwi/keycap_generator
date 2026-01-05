<script lang="ts">
  import Modal from './Modal.svelte'
  import LabelPreview from './LabelPreview.svelte'
  import type { Template } from '../state/types'

  export let title: string
  export let onCancel: () => void
  export let current: number = 0
  export let total: number = 0
  export let previewTemplate: Template | null = null
  export let previewTextsBySymbolId: Record<string, string> = {}
  export let previewWidthMm: number = 0
  export let previewHeightMm: number = 0

  $: progressPercent = total > 0 ? (current / total) * 100 : 0
</script>

<Modal {title}>
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
        <div class="h-full bg-emerald-500 transition-all duration-300 ease-out" style="width: {progressPercent}%"></div>
      </div>
    </div>
  {/if}

  <button
    class="rounded-md border border-red-900/60 bg-red-950/30 px-4 py-2 text-sm text-red-200 hover:bg-red-950/60 transition-colors"
    on:click={onCancel}
  >
    Cancel
  </button>
</Modal>
