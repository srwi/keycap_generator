<script lang="ts">
  import type { Template } from '../state/types'

  export let template: Template | null
  export let textsBySymbolId: Record<string, string> = {}
  export let className = ''
</script>

<svg
  viewBox="0 0 100 100"
  class={`h-auto w-full rounded-lg bg-slate-950 ${className}`}
>
  <rect x="4" y="4" width="92" height="92" rx="10" fill="none" stroke="rgba(148,163,184,0.25)" />

  {#if template}
    {#each template.symbols as sym (sym.id)}
      {@const text = textsBySymbolId[sym.id] ?? ''}
      <g transform={`translate(${sym.x * 100} ${sym.y * 100}) rotate(${sym.rotationDeg})`}>
        <text
          x="0"
          y="0"
          text-anchor="middle"
          dominant-baseline="middle"
          font-size={Math.max(1, sym.fontSizeMm * 2)}
          fill={sym.color}
          style="font-family: system-ui;"
        >
          {text}
        </text>
      </g>
    {/each}
  {/if}
</svg>


