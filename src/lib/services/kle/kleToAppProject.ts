import type { AppState, KeyDef, KeycapModel, SymbolDef, Template, FontName } from '../../state/types'
import type { KleKey } from './kleTypes'
import { getKeyActiveSlots } from './kleParser'
import { newId } from '../../utils/id'

export type KleProjectConversionOptions = {
  defaultFont?: FontName
  defaultColor?: string
}

/**
 * Converts keycap unit size (u) to standard MX keycap dimensions in mm.
 * Standard pitch is 19.05mm per unit with 0.75mm gap between keycaps (1u = 18.3mm, 2u = 37.35mm, 6.25u = 118.3125mm).
 */
export function uToMm(u: number): number {
  return Math.max(4, u * 19.05 - 0.75)
}

function getSlotOffsets(slotIndex: number, uWidth: number, uHeight: number): { x: number; y: number } {
  const dx = uWidth <= 1.0 ? 3.2 : Math.min(8.0, 3.2 + (uWidth - 1) * 4.0)
  const dy = uHeight <= 1.0 ? 3.2 : Math.min(8.0, 3.2 + (uHeight - 1) * 4.0)

  switch (slotIndex) {
    case 0: // Top-Left
      return { x: -dx, y: dy }
    case 1: // Top-Center
      return { x: 0, y: dy }
    case 2: // Top-Right
      return { x: dx, y: dy }
    case 3: // Mid-Left
      return { x: -dx, y: 0 }
    case 4: // Center
      return { x: 0, y: 0 }
    case 5: // Mid-Right
      return { x: dx, y: 0 }
    case 6: // Bottom-Left
      return { x: -dx, y: -dy }
    case 7: // Bottom-Center
      return { x: 0, y: -dy }
    case 8: // Bottom-Right
      return { x: dx, y: -dy }
    default:
      return { x: 0, y: 0 }
  }
}

function getSlotHumanName(slotIndex: number, totalSlots: number): string {
  if (totalSlots === 1) return 'Main'
  switch (slotIndex) {
    case 0:
      return 'Top-Left'
    case 1:
      return 'Top-Center'
    case 2:
      return 'Top-Right'
    case 3:
      return 'Mid-Left'
    case 4:
      return 'Center'
    case 5:
      return 'Mid-Right'
    case 6:
      return 'Bottom-Left'
    case 7:
      return 'Bottom-Center'
    case 8:
      return 'Bottom-Right'
    default:
      return `Slot ${slotIndex}`
  }
}

function describeSlotLayout(slotIndices: number[]): string {
  if (slotIndices.length === 0) return 'Blank'
  if (slotIndices.length === 1) {
    return slotIndices[0] === 4 ? 'Centered' : getSlotHumanName(slotIndices[0], 2)
  }
  if (slotIndices.length === 2 && slotIndices.includes(0) && slotIndices.includes(6)) {
    return 'Dual (TL/BL)'
  }
  if (slotIndices.length === 2 && slotIndices.includes(1) && slotIndices.includes(7)) {
    return 'Dual (TC/BC)'
  }
  return slotIndices.map(idx => getSlotHumanName(idx, 2)).join(' + ')
}

/**
 * Converts parsed KLE keys and user model assignments into a valid AppState.
 * Templates are deduplicated per keycap size / model, orientation, and active slot topology.
 */
export function convertKleToProject(
  kleKeys: KleKey[],
  assignedModelByKeyId: Record<string, KeycapModel | null>,
  customModels: KeycapModel[],
  options: KleProjectConversionOptions = {}
): {
  project: AppState
} {
  const defaultFont: FontName = options.defaultFont ?? 'Dongle'
  const defaultColor = options.defaultColor ?? '#ffffff'

  const modelsById = new Map<string, KeycapModel>()
  const placeholderModelsBySize = new Map<string, KeycapModel>()

  // Find or create models for every key
  for (const k of kleKeys) {
    let model = assignedModelByKeyId[k.id] ?? null

    if (!model) {
      // Create a deterministic upload placeholder model for this size
      const sizeKey = `${k.width}x${k.height}`
      let placeholder = placeholderModelsBySize.get(sizeKey)
      if (!placeholder) {
        placeholder = {
          id: newId('model_ph'),
          name: `${k.width.toFixed(2)}u × ${k.height.toFixed(2)}u (Upload required)`,
          widthMm: uToMm(k.width),
          heightMm: uToMm(k.height),
          source: { kind: 'upload', stl: null },
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          extrusionDepthMm: 1.4,
        }
        placeholderModelsBySize.set(sizeKey, placeholder)
      }
      model = placeholder
    }

    modelsById.set(model.id, model)
  }

  // Also include any custom models created during the session
  for (const m of customModels) {
    if (!modelsById.has(m.id)) {
      modelsById.set(m.id, m)
    }
  }

  // Deduplication cache: signature -> { template, rawSlotToSymbolId }
  type TemplateCacheEntry = {
    template: Template
    rawSlotToSymbolId: Map<number, string>
  }
  const templatesBySignature = new Map<string, TemplateCacheEntry>()
  const templates: Template[] = []
  const keys: KeyDef[] = []

  for (const k of kleKeys) {
    const model = assignedModelByKeyId[k.id] ?? placeholderModelsBySize.get(`${k.width}x${k.height}`)!

    // Determine active slot indices (0..8 top surface, or 9..11 front fallback)
    const rawActiveSlots = getKeyActiveSlots(k)

    // Effective slot positioning: keep encoded KLE slots (front legends 9..11 fallback to center)
    const effectiveSlots = rawActiveSlots.map(slotIdx => (slotIdx >= 9 ? 4 : slotIdx))

    const colorSignature = rawActiveSlots.map(slotIdx => k.textColor[slotIdx] || defaultColor).join(',')

    const signature = `${model.id}__${k.width}x${k.height}__slots:${effectiveSlots.join(',')}__colors:${colorSignature}`

    let templateEntry = templatesBySignature.get(signature)

    if (!templateEntry) {
      const templateId = newId('tpl')
      const rawSlotToSymbolId = new Map<number, string>()
      const symbols: SymbolDef[] = []

      // Order Dual (TL/BL) so Bottom-Left (primary) comes first, matching existing presets
      const orderedPairs = rawActiveSlots
        .map((rawSlot, idx) => ({ rawSlot, effectiveSlot: effectiveSlots[idx] }))
        .sort((a, b) => {
          if (rawActiveSlots.length === 2 && a.effectiveSlot === 6 && b.effectiveSlot === 0) return -1
          if (rawActiveSlots.length === 2 && a.effectiveSlot === 0 && b.effectiveSlot === 6) return 1
          return a.effectiveSlot - b.effectiveSlot
        })

      for (const { rawSlot, effectiveSlot } of orderedPairs) {
        const symbolId = newId('sym')
        rawSlotToSymbolId.set(rawSlot, symbolId)

        const rawOffsets = getSlotOffsets(effectiveSlot, k.width, k.height)
        const isSingleCenter = effectiveSlots.length === 1 && effectiveSlot === 4
        const fontSizeMm = isSingleCenter ? 10.5 : 9.0
        const color = k.textColor[rawSlot] || defaultColor

        symbols.push({
          id: symbolId,
          slotName: getSlotHumanName(effectiveSlot, effectiveSlots.length),
          x: rawOffsets.x,
          y: rawOffsets.y,
          fontName: defaultFont,
          fontSizeMm,
          color,
          rotationDeg: 0,
        })
      }

      const layoutDesc = describeSlotLayout(effectiveSlots)
      const template: Template = {
        id: templateId,
        name: `${model.name} (${layoutDesc})`,
        keycapModelId: model.id,
        symbols,
      }

      templateEntry = { template, rawSlotToSymbolId }
      templatesBySignature.set(signature, templateEntry)
      templates.push(template)
    }

    // Key definition
    const contentBySymbolId: Record<string, { kind: 'text'; value: string }> = {}
    for (const rawSlot of rawActiveSlots) {
      const symId = templateEntry.rawSlotToSymbolId.get(rawSlot)
      if (symId) {
        contentBySymbolId[symId] = {
          kind: 'text',
          value: k.labels[rawSlot],
        }
      }
    }

    // Determine human-readable key name
    const primaryLabel =
      k.labels[4] ||
      k.labels[6] ||
      k.labels[0] ||
      k.labels[1] ||
      (rawActiveSlots.length > 0 ? k.labels[rawActiveSlots[0]] : '') ||
      (k.width >= 4 ? 'Space' : `Blank (${k.width}u)`)

    keys.push({
      id: newId('key'),
      name: primaryLabel,
      templateId: templateEntry.template.id,
      contentBySymbolId,
    })
  }

  const project: AppState = {
    version: 1,
    keycapModels: Array.from(modelsById.values()),
    templates,
    keys,
    customFonts: [],
    ui: {
      selectedKeycapModelId: projectFirstId(Array.from(modelsById.values())),
      selectedTemplateId: projectFirstId(templates),
      selectedKeyId: projectFirstId(keys),
    },
  }

  return { project }
}

function projectFirstId<T extends { id: string }>(arr: T[]): string | null {
  return arr[0]?.id ?? null
}
