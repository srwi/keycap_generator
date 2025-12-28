import type { AppState, KeyDef, KeycapModel, Template } from '../state/types'
import { alignMinZToZero, parseStl } from './stl'
import { buildKeyTextGeometry } from './text'
import { subtractGeometry } from './csg'
import { make3mfZip } from './threeTo3mf'
import { zipSync } from 'fflate'

function safeFileName(name: string): string {
  return name
    .trim()
    .replaceAll(/[\s]+/g, '_')
    .replaceAll(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .slice(0, 120) || 'key'
}

function downloadBytes(bytes: Uint8Array, fileName: string, mime = 'model/3mf') {
  const copy = new Uint8Array(bytes)
  const blob = new Blob([copy.buffer], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function getTemplate(state: AppState, key: KeyDef): Template | null {
  return state.templates.find((t) => t.id === key.templateId) ?? null
}

function getModel(state: AppState, tpl: Template): KeycapModel | null {
  return state.keycapModels.find((m) => m.id === tpl.keycapModelId) ?? null
}

const serverStlCache = new Map<string, ArrayBuffer>()

async function getStlBufferForModel(model: KeycapModel, stlBuffersByModelId: Record<string, ArrayBuffer | null>) {
  if (model.source.kind === 'upload') {
    const buf = stlBuffersByModelId[model.id]
    if (!buf) throw new Error(`Missing STL for model "${model.name}". Upload it in the Models step.`)
    return buf
  }

  const cached = serverStlCache.get(model.source.url)
  if (cached) return cached

  const res = await fetch(model.source.url)
  if (!res.ok) {
    throw new Error(`Failed to fetch server STL for model "${model.name}" (${model.source.url}).`)
  }
  const buf = await res.arrayBuffer()
  serverStlCache.set(model.source.url, buf)
  return buf
}

export async function generateAll3mfs(
  state: AppState,
  stlBuffersByModelId: Record<string, ArrayBuffer | null>,
  onProgress?: (p: { current: number; total: number; keyName: string }) => void,
) {
  const alignedByModelId = new Map<string, ReturnType<typeof alignMinZToZero>>()
  const files: Record<string, Uint8Array> = {}

  const total = state.keys.length
  for (let i = 0; i < total; i++) {
    const key = state.keys[i]
    onProgress?.({ current: i + 1, total, keyName: key.name })

    const tpl = getTemplate(state, key)
    if (!tpl) continue

    const model = getModel(state, tpl)
    if (!model) throw new Error(`Template "${tpl.name}" references a missing keycap model.`)

    let aligned = alignedByModelId.get(model.id)
    if (!aligned) {
      const stlBuf = await getStlBufferForModel(model, stlBuffersByModelId)
      aligned = alignMinZToZero(parseStl(stlBuf))
      alignedByModelId.set(model.id, aligned)
    }

    const baseGeom = aligned.geometry.clone()

    const legendGeom = buildKeyTextGeometry({
      key,
      template: tpl,
      modelWidthU: model.widthU,
      modelHeightU: model.heightU,
      extrusionDepthMm: state.settings.extrusionDepthMm,
      faceMinX: aligned.min.x,
      faceMaxX: aligned.max.x,
      faceMinY: aligned.min.y,
      faceMaxY: aligned.max.y,
    })

    const bodyGeom = legendGeom ? subtractGeometry(baseGeom, legendGeom) : baseGeom

    const zip = make3mfZip({
      modelName: key.name,
      bodyGeometry: bodyGeom,
      legendGeometry: legendGeom,
    })

    files[`${safeFileName(key.name)}.3mf`] = zip

    // Yield to keep UI responsive when generating many keys.
    await new Promise((r) => setTimeout(r, 0))
  }

  // Create a single ZIP file containing all 3MF files
  const allFilesZip = zipSync(files)
  downloadBytes(allFilesZip, 'keycaps.zip', 'application/zip')
}


