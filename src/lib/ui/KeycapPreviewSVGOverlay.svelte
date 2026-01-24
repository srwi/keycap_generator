<script lang="ts">
  import type { SymbolContent, Template } from '../state/types'
  import LabelPreview from './LabelPreview.svelte'

  export let template: Template | null
  export let contentBySymbolId: Record<string, SymbolContent> = {}
  export let widthMm: number
  export let heightMm: number

  $: paddedWidthMm = widthMm * 1.2
  $: paddedHeightMm = heightMm * 1.2
</script>

<div class="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
  <LabelPreview
    {template}
    {contentBySymbolId}
    widthMm={paddedWidthMm}
    heightMm={paddedHeightMm}
    transparent={true}
    className="w-full h-full object-contain"
  />
</div>
