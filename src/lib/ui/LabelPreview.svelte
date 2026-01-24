<script lang="ts">
  import type { SymbolContent, Template } from '../state/types'
  import { getTextPath } from '../generate/fonts'
  import { loadRawIconPath, PHOSPHOR_ICON_VIEWBOX } from '../services/icons'

  export let template: Template | null
  export let contentBySymbolId: Record<string, SymbolContent> = {}
  export let className = ''
  export let widthMm = 0
  export let heightMm = 0
  export let transparent = false

  $: w = Math.max(0.01, widthMm)
  $: h = Math.max(0.01, heightMm)
  $: centerX = w / 2
  $: centerY = h / 2
  $: r = Math.min(w, h) * 0.12

  type TextPathData = { path: string; width: number; height: number; x: number; y: number }

  interface SymbolRenderData {
    symbol: typeof template extends Template ? Template['symbols'][0] : never
    content: SymbolContent | null
    textPathData: TextPathData | null
    iconPath: string | null
  }

  // Get symbol content
  function getContent(symbolId: string): SymbolContent | null {
    return contentBySymbolId[symbolId] ?? null
  }

  // Load paths for all symbols (handles both text and icons)
  $: symbolData = template
    ? Promise.all(
        template.symbols.map(async sym => {
          const content = getContent(sym.id)
          if (!content) return { symbol: sym, content: null, textPathData: null, iconPath: null }

          try {
            if (content.kind === 'text') {
              const textPathData = await getTextPath(content.value, sym.fontName, sym.fontSizeMm)
              return { symbol: sym, content, textPathData, iconPath: null }
            } else {
              // Icon content - get raw path (unscaled)
              const iconPath = await loadRawIconPath(content.iconName)
              return { symbol: sym, content, textPathData: null, iconPath }
            }
          } catch (error) {
            console.error('Failed to load symbol path:', error)
            return { symbol: sym, content, textPathData: null, iconPath: null }
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
  {#if !transparent}
    <rect x={0} y={0} width={w} height={h} fill="var(--label-preview-bg)" rx={r} />
  {/if}

  {#if template}
    {#await symbolData}
      <!-- Loading paths - show placeholder -->
      {#each template.symbols as sym (sym.id)}
        {@const content = getContent(sym.id)}
        {#if content}
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
              {content.kind === 'text' ? content.value : '⬡'}
            </text>
          </g>
        {/if}
      {/each}
    {:then data}
      {#each data as { symbol: sym, content, textPathData, iconPath }}
        {#if content}
          {@const x = centerX + sym.x}
          {@const y = centerY - sym.y}

          {#if content.kind === 'text' && textPathData}
            <!-- Text content - use the generated path -->
            {@const centerOffsetX = -textPathData.width / 2 - textPathData.x}
            {@const centerOffsetY = -textPathData.height / 2 - textPathData.y}
            <g transform={`translate(${x} ${y}) rotate(${sym.rotationDeg})`}>
              <path
                d={textPathData.path}
                fill={sym.color}
                transform={`translate(${centerOffsetX}, ${centerOffsetY})`}
              />
            </g>
          {:else if content.kind === 'icon' && iconPath}
            <!-- Icon content - render raw path with SVG scaling -->
            {@const scale = sym.fontSizeMm / PHOSPHOR_ICON_VIEWBOX}
            {@const halfSize = sym.fontSizeMm / 2}
            <g transform={`translate(${x} ${y}) rotate(${sym.rotationDeg})`}>
              <!-- Scale and center the icon: translate to center, then scale from viewBox to fontSizeMm -->
              <g transform={`translate(${-halfSize} ${-halfSize}) scale(${scale})`}>
                <path d={iconPath} fill={sym.color} />
              </g>
            </g>
          {:else}
            <!-- Fallback placeholder -->
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
                {content.kind === 'text' ? content.value : '⬡'}
              </text>
            </g>
          {/if}
        {/if}
      {/each}
    {:catch error}
      <!-- Fallback to text/placeholder if path loading fails -->
      {#each template.symbols as sym (sym.id)}
        {@const content = getContent(sym.id)}
        {#if content}
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
              {content.kind === 'text' ? content.value : '⬡'}
            </text>
          </g>
        {/if}
      {/each}
    {/await}
  {/if}
</svg>
