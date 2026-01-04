import type { AppState, KeyDef, KeycapModel, Template } from '../state/types'
import { parseSTL, centerGeometryXY, alignBottomTo } from './stl'
import { makeMesh, csgIntersect, csgSubtract, csgUnionMeshes } from './csg'
import { getFont } from './fonts'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { MathUtils, Group, Mesh, BufferGeometry } from 'three'

// Shared helper functions
export function safeFileName(name: string): string {
  return (
    name
      .trim()
      .replaceAll(/[\s]+/g, '_')
      .replaceAll(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .slice(0, 120) || 'key'
  )
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

export function getTemplate(state: AppState, key: KeyDef | { id: string; templateId: string }): Template | null {
  return state.templates.find(t => t.id === key.templateId) ?? null
}

export function getModel(state: AppState, template: Template | { keycapModelId: string }): KeycapModel | null {
  return state.keycapModels.find(m => m.id === template.keycapModelId) ?? null
}

const serverStlCache = new Map<string, ArrayBuffer>()

export async function getStlBufferForModel(
  model: KeycapModel | string,
  stlBuffersByModelId: Record<string, ArrayBuffer | null>,
  state?: AppState
): Promise<ArrayBuffer> {
  const modelObj = typeof model === 'string' 
    ? (state?.keycapModels.find(m => m.id === model) ?? null)
    : model
  
  if (!modelObj) {
    throw new Error(typeof model === 'string' ? `Model not found: ${model}` : `Invalid model`)
  }

  if (modelObj.source.kind === 'upload') {
    const buf = stlBuffersByModelId[modelObj.id]
    if (!buf) throw new Error(`Missing STL for model "${modelObj.name}". Upload it in the Models step.`)
    return buf
  }

  const cached = serverStlCache.get(modelObj.source.url)
  if (cached) return cached

  const res = await fetch(modelObj.source.url)
  if (!res.ok) {
    throw new Error(`Failed to fetch server STL for model "${modelObj.name}" (${modelObj.source.url}).`)
  }
  const buf = await res.arrayBuffer()
  serverStlCache.set(modelObj.source.url, buf)
  return buf
}

/**
 * Core function to generate a keycap model from a base geometry and template.
 * This is the shared implementation used by both preview and batch generation.
 */
export async function generateKeycapModel(
  state: AppState,
  key: KeyDef,
  template: Template,
  baseGeom: BufferGeometry,
  yieldAndCheck?: () => Promise<void>
): Promise<Group> {
  if (yieldAndCheck) await yieldAndCheck()

  const baseMinZ = baseGeom.boundingBox!.min.z
  const textMeshes: { mesh: Mesh; color: number; name?: string }[] = []
  const extrusionMeshes: Mesh[] = []

  // Process each symbol in the template
  for (const sym of template.symbols) {
    if (yieldAndCheck) await yieldAndCheck()

    const text = (key.textsBySymbolId[sym.id] ?? '').trim()
    if (!text) continue

    const fontResult = getFont(sym.fontName)
    const font = fontResult instanceof Promise ? await fontResult : fontResult
    const textGeom = new TextGeometry(text, {
      font,
      size: sym.fontSizeMm,
      height: state.settings.extrusionDepthMm,
      curveSegments: 6,
      bevelEnabled: false,
    } as any)

    textGeom.computeVertexNormals()
    centerGeometryXY(textGeom)

    // Calculate position based on symbol coordinates (mm offsets from center)
    // Since the base geometry is centered at (0,0), we can directly use the offsets
    // x: left is negative, right is positive
    // y: top is negative, bottom is positive (matches SVG coordinate system)
    const tx = sym.x
    const ty = sym.y

    const rz = MathUtils.degToRad(sym.rotationDeg)
    if (rz !== 0) textGeom.rotateZ(rz)
    textGeom.translate(tx, ty, 0)
    alignBottomTo(textGeom, baseMinZ)

    const color = parseInt(sym.color.replace('#', '0x'))
    const extrMesh = makeMesh(textGeom, color)
    extrusionMeshes.push(extrMesh)

    const interMesh = makeMesh(textGeom.clone() as BufferGeometry, color)
    textMeshes.push({ mesh: interMesh, color, name: text })
  }

  if (yieldAndCheck) await yieldAndCheck()

  const baseMesh = makeMesh(baseGeom.clone() as BufferGeometry, 0xdddddd)
  const unionExtrusion = csgUnionMeshes(extrusionMeshes)
  const bodyResult = unionExtrusion ? csgSubtract(baseMesh, unionExtrusion) : baseMesh

  const group = new Group()
  bodyResult.name = 'body'
  group.add(bodyResult)

  textMeshes.forEach((tr, j) => {
    const r = csgIntersect(baseMesh, tr.mesh)
    r.material = tr.mesh.material
    r.name = tr.name || `text_${j}`
    group.add(r)
  })

  if (yieldAndCheck) await yieldAndCheck()

  return group
}

// Worker-based generation for better performance
export function generateAll3mfsWithWorker(
  state: AppState,
  stlBuffersByModelId: Record<string, ArrayBuffer | null>,
  onProgress?: (p: { current: number; total: number; keyId: string }) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const workerUrl = new URL('./generate.worker.ts', import.meta.url)
    const worker = new Worker(workerUrl, { type: 'module' })
    let cancelled = false

    if (signal) {
      signal.addEventListener('abort', () => {
        cancelled = true
        worker.postMessage({ type: 'cancel' })
        worker.terminate()
        reject(new Error('Generation cancelled'))
      })
    }

    worker.onmessage = (e) => {
      const { type, payload } = e.data

      if (type === 'progress') {
        if (!cancelled) {
          onProgress?.(payload)
        }
      } else if (type === 'complete') {
        if (!cancelled) {
          const { zipData } = payload
          downloadBytes(zipData, 'keycaps.zip', 'application/zip')
          worker.terminate()
          resolve()
        }
      } else if (type === 'error') {
        if (!cancelled) {
          worker.terminate()
          reject(new Error(payload.message))
        }
      }
    }

    worker.onerror = (error) => {
      if (!cancelled) {
        worker.terminate()
        reject(error)
      }
    }

    worker.postMessage({
      type: 'generate-all',
      payload: { state, stlBuffersByModelId },
    })
  })
}

export async function generatePreviewModel(
  state: AppState,
  keyId: string,
  stlBuffersByModelId: Record<string, ArrayBuffer | null>,
  signal?: AbortSignal
): Promise<Group | null> {
  // Helper to yield and check for cancellation
  const yieldAndCheck = async () => {
    await new Promise(r => setTimeout(r, 0))
    if (signal?.aborted) {
      throw new Error('Preview generation cancelled')
    }
  }

  const key = state.keys.find(k => k.id === keyId)
  if (!key) return null

  await yieldAndCheck()

  const template = getTemplate(state, key)
  if (!template) return null

  const model = getModel(state, template)
  if (!model) return null

  await yieldAndCheck()
  const stlBuf = await getStlBufferForModel(model, stlBuffersByModelId)
  await yieldAndCheck()
  const baseGeom = await parseSTL(stlBuf)
  centerGeometryXY(baseGeom)
  alignBottomTo(baseGeom, 0)
  baseGeom.computeBoundingBox()

  await yieldAndCheck()

  // Use the shared core generation function
  return await generateKeycapModel(state, key, template, baseGeom, yieldAndCheck)
}
