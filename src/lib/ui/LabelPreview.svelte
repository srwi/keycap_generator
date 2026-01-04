<script lang="ts">
  import type { Template } from '../state/types'
  import { DEFAULT_KEYCAP_SIZE_MM } from '../state/types'
  import { getTextPath } from '../generate/fonts'

  export let template: Template | null
  export let textsBySymbolId: Record<string, string> = {}
  export let className = ''
  export let widthMm = DEFAULT_KEYCAP_SIZE_MM
  export let heightMm = DEFAULT_KEYCAP_SIZE_MM

  $: w = Math.max(0.01, widthMm)
  $: h = Math.max(0.01, heightMm)
  $: centerX = w / 2
  $: centerY = h / 2
  $: r = Math.min(w, h) * 0.12

  // Load paths for all symbols (getTextPath handles caching internally)
  $: symbolPaths = template
    ? Promise.all(
        template.symbols.map(async (sym) => {
          const text = textsBySymbolId[sym.id] ?? ''
          if (!text) return { symbol: sym, pathData: null, text: '' }
          
          try {
            const pathData = await getTextPath(text, sym.fontName, sym.fontSizeMm)
            return { symbol: sym, pathData, text }
          } catch (error) {
            console.error('Failed to load text path:', error)
            return { symbol: sym, pathData: null, text }
          }
        })
      )
    : Promise.resolve([])
</script>

<svg
  viewBox={`0 0 ${w} ${h}`}
  class={`h-auto w-full ${className}`}
  preserveAspectRatio="xMidYMid meet"
  style={`aspect-ratio: ${w} / ${h};`}
>
  <rect x={0} y={0} width={w} height={h} fill="rgba(148,163,184,0.25)" rx={r} />

  {#if template}
    {#await symbolPaths}
      <!-- Loading paths - show placeholder text -->
      {#each template.symbols as sym (sym.id)}
        {@const text = textsBySymbolId[sym.id] ?? ''}
        {#if text}
          {@const x = centerX + sym.x}
          {@const y = centerY - sym.y}
          <g transform={`translate(${x} ${y}) rotate(${sym.rotationDeg})`}>
            <text
              x="0"
              y="0"
              text-anchor="middle"
              dominant-baseline="middle"
              font-size={Math.max(0.5, sym.fontSizeMm)}
              fill={sym.color}
              opacity="0.5"
            >
              {text}
            </text>
          </g>
        {/if}
      {/each}
    {:then paths}
      {#each paths as { symbol: sym, pathData, text }}
        {#if text && pathData}
          {@const x = centerX + sym.x}
          {@const y = centerY - sym.y}
          {@const centerOffsetX = -pathData.width / 2 - pathData.x}
          {@const centerOffsetY = -pathData.height / 2 - pathData.y}
          <g transform={`translate(${x} ${y}) rotate(${sym.rotationDeg})`}>
            <path
              d={pathData.path}
              fill={sym.color}
              transform={`translate(${centerOffsetX}, ${centerOffsetY})`}
            />
          </g>
        {/if}
      {/each}
    {:catch error}
      <!-- Fallback to text if path loading fails -->
      {#each template.symbols as sym (sym.id)}
        {@const text = textsBySymbolId[sym.id] ?? ''}
        {#if text}
          {@const x = centerX + sym.x}
          {@const y = centerY - sym.y}
          <g transform={`translate(${x} ${y}) rotate(${sym.rotationDeg})`}>
            <text
              x="0"
              y="0"
              text-anchor="middle"
              dominant-baseline="middle"
              font-size={Math.max(0.5, sym.fontSizeMm)}
              fill={sym.color}
            >
              {text}
            </text>
          </g>
        {/if}
      {/each}
    {/await}
  {/if}
</svg>
