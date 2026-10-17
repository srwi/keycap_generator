<script lang="ts">
  import type { KeycapModel } from '../../state/types'
  import type { KleKey } from '../../services/kle/kleTypes'
  import { calculateLayoutBounds, getKeyActiveSlots, hasSecondaryShape } from '../../services/kle/kleParser'

  export let keys: KleKey[] = []
  export let assignedModelByKeyId: Record<string, KeycapModel | null> = {}
  export let selectedKeyIds: Set<string> = new Set()
  export let onKeyClick: (key: KleKey, event: MouseEvent) => void
  export let onClearSelection: () => void

  const U = 54 // 1 unit in SVG pixels
  const PADDING = 16

  $: bounds = calculateLayoutBounds(keys)

  $: viewBox = `${bounds.minX * U - PADDING} ${bounds.minY * U - PADDING} ${bounds.width * U + PADDING * 2} ${bounds.height * U + PADDING * 2}`

  // Derive the active size from currently selected keys (if any)
  $: selectedKeys = keys.filter(k => selectedKeyIds.has(k.id))
  $: activeSize = selectedKeys.length > 0 ? { width: selectedKeys[0].width, height: selectedKeys[0].height } : null

  function handleSvgClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClearSelection()
    }
  }

  type CanvasLabel = {
    text: string
    x: number
    y: number
    anchor: 'start' | 'middle' | 'end'
    fontSize: number
    fill: string
  }

  function getKeyCanvasLabels(k: KleKey, keyX: number, keyY: number, keyW: number, keyH: number): CanvasLabel[] {
    const list: CanvasLabel[] = []
    const padX = 7
    const padTop = 15
    const padMid = keyH / 2 + 3.5
    const padBottom = keyH - 8
    const maxChars = Math.max(5, Math.floor((keyW - 14) / 7))

    const activeSlots = getKeyActiveSlots(k)
    const isSingle = activeSlots.length === 1

    for (const slot of activeSlots) {
      const txt = k.labels[slot].trim()
      let lx = keyX + keyW / 2
      let ly = keyY + padMid
      let anchor: 'start' | 'middle' | 'end' = 'middle'

      switch (slot) {
        case 0:
          lx = keyX + padX
          ly = keyY + padTop
          anchor = 'start'
          break
        case 1:
          lx = keyX + keyW / 2
          ly = keyY + padTop
          anchor = 'middle'
          break
        case 2:
          lx = keyX + keyW - padX
          ly = keyY + padTop
          anchor = 'end'
          break
        case 3:
          lx = keyX + padX
          ly = keyY + padMid
          anchor = 'start'
          break
        case 4:
          lx = keyX + keyW / 2
          ly = keyY + padMid
          anchor = 'middle'
          break
        case 5:
          lx = keyX + keyW - padX
          ly = keyY + padMid
          anchor = 'end'
          break
        case 6:
          lx = keyX + padX
          ly = keyY + padBottom
          anchor = 'start'
          break
        case 7:
          lx = keyX + keyW / 2
          ly = keyY + padBottom
          anchor = 'middle'
          break
        case 8:
          lx = keyX + keyW - padX
          ly = keyY + padBottom
          anchor = 'end'
          break
        default:
          // Front legends (slots 9..11) centered
          lx = keyX + keyW / 2
          ly = keyY + padMid
          anchor = 'middle'
          break
      }

      const fontSize = isSingle
        ? slot === 4
          ? Math.min(14, Math.max(9, 13 - Math.max(0, txt.length - 4)))
          : slot >= 9
            ? 10
            : 11
        : slot === 0 || slot === 1 || slot === 2
          ? 10
          : 11

      const color = k.textColor[slot] || (slot >= 9 ? '#94a3b8' : slot === 0 && !isSingle ? '#cbd5e1' : '#ffffff')

      list.push({
        text: txt.slice(0, maxChars),
        x: lx,
        y: ly,
        anchor,
        fontSize,
        fill: color,
      })
    }

    return list
  }
</script>

<div class="relative w-full h-full min-h-[220px] flex items-center justify-center overflow-hidden p-3 select-none">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    {viewBox}
    preserveAspectRatio="xMidYMid meet"
    class="w-full h-full max-h-full max-w-full drop-shadow-sm cursor-default"
    onclick={handleSvgClick}
  >
    {#each keys as k (k.id)}
      {@const isSelected = selectedKeyIds.has(k.id)}
      {@const isAssigned = Boolean(assignedModelByKeyId[k.id])}
      {@const assignedModel = assignedModelByKeyId[k.id]}

      {@const x = k.x * U}
      {@const y = k.y * U}
      {@const w = k.width * U}
      {@const h = k.height * U}
      {@const keyLabels = getKeyCanvasLabels(k, x, y, w, h)}
      {@const hasRotation = k.rotation_angle !== 0}
      {@const rotX = k.rotation_x * U}
      {@const rotY = k.rotation_y * U}

      {@const hasSecondaryRect = hasSecondaryShape(k)}

      {@const fillColor = isAssigned ? '#065f46' : '#334155'}
      {@const strokeColor = isSelected ? '#38bdf8' : isAssigned ? '#10b981' : '#64748b'}
      {@const strokeW = isSelected ? 3 : 1.5}

      {@const isSameSize = activeSize ? k.width === activeSize.width && k.height === activeSize.height : true}
      {@const isDimmed = activeSize !== null && !isSameSize}

      <g
        transform={hasRotation ? `rotate(${k.rotation_angle} ${rotX} ${rotY})` : undefined}
        class="transition-opacity duration-150 {isDimmed ? 'opacity-30 hover:opacity-70' : 'opacity-100'}"
      >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g
          class="cursor-pointer"
          onclick={e => {
            e.stopPropagation()
            onKeyClick(k, e)
          }}
        >
          <title>
            {k.width.toFixed(2)}u × {k.height.toFixed(2)}u{keyLabels.length > 0
              ? ` (${keyLabels.map(l => l.text).join(' ')})`
              : ''} — {isAssigned ? `Model: ${assignedModel?.name}` : 'No model assigned'}
          </title>

          {#if hasSecondaryRect}
            <!-- Multi-box keycap (e.g. ISO Enter, Big-Ass Enter, Stepped Caps) rendered via two-pass union -->
            {@const x2 = (k.x + k.x2) * U}
            {@const y2 = (k.y + k.y2) * U}
            {@const w2 = k.width2 * U}
            {@const h2 = k.height2 * U}
            <g class={isSelected ? 'filter drop-shadow-[0_0_6px_rgba(56,189,248,0.65)]' : ''}>
              <!-- Pass 1: Outer stroke rects -->
              <rect
                x={x + 2}
                y={y + 2}
                width={Math.max(4, w - 4)}
                height={Math.max(4, h - 4)}
                rx="5"
                fill={strokeColor}
              />
              <rect
                x={x2 + 2}
                y={y2 + 2}
                width={Math.max(4, w2 - 4)}
                height={Math.max(4, h2 - 4)}
                rx="5"
                fill={strokeColor}
              />
              <!-- Pass 2: Inner fill rects (seamless union) -->
              <rect
                x={x + 2 + strokeW}
                y={y + 2 + strokeW}
                width={Math.max(2, w - 4 - strokeW * 2)}
                height={Math.max(2, h - 4 - strokeW * 2)}
                rx="3.5"
                fill={fillColor}
              />
              <rect
                x={x2 + 2 + strokeW}
                y={y2 + 2 + strokeW}
                width={Math.max(2, w2 - 4 - strokeW * 2)}
                height={Math.max(2, h2 - 4 - strokeW * 2)}
                rx="3.5"
                fill={fillColor}
              />
            </g>
          {:else}
            <!-- Standard rectangular keycap -->
            <rect
              x={x + 2}
              y={y + 2}
              width={Math.max(4, w - 4)}
              height={Math.max(4, h - 4)}
              rx="5"
              fill={fillColor}
              stroke={strokeColor}
              stroke-width={strokeW}
              class={isSelected ? 'filter drop-shadow-[0_0_6px_rgba(56,189,248,0.65)]' : ''}
            />

            <!-- Top surface inset line for realistic keycap feel -->
            <rect
              x={x + 5.5}
              y={y + 5.5}
              width={Math.max(2, w - 11)}
              height={Math.max(2, h - 11)}
              rx="3"
              fill="none"
              stroke={isSelected ? '#38bdf8' : isAssigned ? '#34d399' : '#9ca3af'}
              stroke-width="0.75"
              stroke-opacity="0.35"
              pointer-events="none"
            />
          {/if}

          <!-- Labels according to encoded KLE slots -->
          {#each keyLabels as lbl}
            <text
              x={lbl.x}
              y={lbl.y}
              text-anchor={lbl.anchor}
              font-size={lbl.fontSize}
              font-weight="600"
              fill={lbl.fill}
              pointer-events="none"
            >
              {lbl.text}
            </text>
          {/each}
        </g>
      </g>
    {/each}
  </svg>
</div>
