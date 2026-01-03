<script lang="ts">
  import type { Template } from '../state/types'
  import { DEFAULT_KEYCAP_SIZE_MM } from '../state/types'

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
</script>

<svg
  viewBox={`0 0 ${w} ${h}`}
  class={`h-auto w-full ${className}`}
  preserveAspectRatio="xMidYMid meet"
  style={`aspect-ratio: ${w} / ${h};`}
>
  <rect x={0} y={0} width={w} height={h} fill="rgba(148,163,184,0.25)" rx={r} />

  {#if template}
    {#each template.symbols as sym (sym.id)}
      {@const text = textsBySymbolId[sym.id] ?? ''}
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
          style="font-family: system-ui;"
        >
          {text}
        </text>
      </g>
    {/each}
  {/if}
</svg>


