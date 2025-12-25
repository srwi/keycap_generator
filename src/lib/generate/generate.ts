import type { AppState, KeyDef, Template } from '../state/types'
import { alignMinZToZero, parseStl } from './stl'
import { buildKeyTextGeometry } from './text'
import { subtractGeometry } from './csg'
import { make3mfZip } from './threeTo3mf'

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

export async function generateAll3mfs(
  state: AppState,
  stlBuf: ArrayBuffer,
  onProgress?: (p: { current: number; total: number; keyName: string }) => void,
) {
  const base = parseStl(stlBuf)
  const aligned = alignMinZToZero(base)

  const total = state.keys.length
  for (let i = 0; i < total; i++) {
    const key = state.keys[i]
    onProgress?.({ current: i + 1, total, keyName: key.name })

    const tpl = getTemplate(state, key)
    if (!tpl) continue

    const legendGeom = buildKeyTextGeometry({
      key,
      template: tpl,
      extrusionDepthMm: state.settings.extrusionDepthMm,
      faceMinX: aligned.min.x,
      faceMaxX: aligned.max.x,
      faceMinY: aligned.min.y,
      faceMaxY: aligned.max.y,
    })

    const bodyGeom = legendGeom ? subtractGeometry(aligned.geometry, legendGeom) : aligned.geometry.clone()

    const zip = make3mfZip({
      modelName: key.name,
      bodyGeometry: bodyGeom,
      legendGeometry: legendGeom,
    })

    downloadBytes(zip, `${safeFileName(key.name)}.3mf`)

    // Yield to keep UI responsive when generating many keys.
    await new Promise((r) => setTimeout(r, 0))
  }
}


