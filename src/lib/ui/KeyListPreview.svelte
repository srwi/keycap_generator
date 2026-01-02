<script lang="ts">
  import type { Template } from '../state/types'
  import { U_MM } from '../state/types'

  export let template: Template | null
  export let textsBySymbolId: Record<string, string> = {}
  export let widthU = 1
  export let heightU = 1

  $: w = Math.max(0.01, widthU)
  $: h = Math.max(0.01, heightU)
  $: inset = Math.min(w, h) * 0.06
  $: r = Math.min(w, h) * 0.12
</script>

<svg
  viewBox={`0 0 ${w} ${h}`}
  class="max-h-full max-w-full rounded bg-slate-900"
  preserveAspectRatio="xMidYMid meet"
>
  <rect x={inset} y={inset} width={w - inset * 2} height={h - inset * 2} rx={r} fill="none" stroke="rgba(148,163,184,0.25)" />

  {#if template}
    {#each template.symbols as sym (sym.id)}
      {@const text = textsBySymbolId[sym.id] ?? ''}
      <g transform={`translate(${sym.x} ${sym.y}) rotate(${sym.rotationDeg})`}>
        <text
          x="0"
          y="0"
          text-anchor="middle"
          dominant-baseline="middle"
          font-size={Math.max(0.06, sym.fontSizeMm / U_MM)}
          fill={sym.color}
          style="font-family: system-ui;"
        >
          {text}
        </text>
      </g>
    {/each}
  {/if}
</svg>

