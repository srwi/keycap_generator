import type { AppState, KeyDef, KeycapModel, Template } from '../state/types'
import { processStlForModel, centerGeometryXY, alignBottomTo } from './stl'
import { makeMesh, csgIntersect, csgSubtract, csgUnionMeshes } from './csg'
import { KEYCAP_BODY_COLOR } from './materials'
import { getFont } from './fonts'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { MathUtils, Group, Mesh, BufferGeometry } from 'three'

function createGenerateWorker(name?: string): Worker {
  // Important for GitHub Pages: avoid root-absolute `/assets/...` worker URLs.
  // Vite will bundle this and rewrite it relative to the configured `base`.
  return new Worker(new URL('./generate.worker.ts', import.meta.url), {
    type: 'module',
    name,
  })
}

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
  const modelObj = typeof model === 'string' ? (state?.keycapModels.find(m => m.id === model) ?? null) : model

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

export async function generateKeycapModel(
  state: AppState,
  key: KeyDef,
  template: Template,
  baseGeom: BufferGeometry,
  yieldAndCheck?: () => Promise<void>
): Promise<Group> {
  if (yieldAndCheck) await yieldAndCheck()

  const model = getModel(state, template)
  if (!model) throw new Error(`Template "${template.name}" references a missing keycap model.`)

  const baseMinZ = baseGeom.boundingBox!.min.z
  const textMeshes: { mesh: Mesh; color: number; name?: string }[] = []
  const extrusionMeshes: Mesh[] = []

  for (const sym of template.symbols) {
    if (yieldAndCheck) await yieldAndCheck()

    const text = (key.textsBySymbolId[sym.id] ?? '').trim()
    if (!text) continue
    const fontResult = getFont(sym.fontName)
    const font = fontResult instanceof Promise ? await fontResult : fontResult
    const textGeom = new TextGeometry(text, {
      font,
      size: sym.fontSizeMm,
      depth: model.extrusionDepthMm,
      curveSegments: 3,
      bevelEnabled: false,
    } as any)

    textGeom.computeVertexNormals()
    centerGeometryXY(textGeom)

    const rz = MathUtils.degToRad(sym.rotationDeg)
    textGeom.rotateY(Math.PI)
    if (rz !== 0) textGeom.rotateZ(rz)
    textGeom.translate(-sym.x, sym.y, 0)
    alignBottomTo(textGeom, baseMinZ)

    const color = parseInt(sym.color.replace('#', '0x'))
    const extrMesh = makeMesh(textGeom, color)
    extrusionMeshes.push(extrMesh)

    const interMesh = makeMesh(textGeom.clone() as BufferGeometry, color)
    textMeshes.push({ mesh: interMesh, color, name: text })
  }

  if (yieldAndCheck) await yieldAndCheck()

  const baseMesh = makeMesh(baseGeom.clone() as BufferGeometry, KEYCAP_BODY_COLOR)
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

export function generateAll3mfsWithWorker(
  state: AppState,
  stlBuffersByModelId: Record<string, ArrayBuffer | null>,
  onProgress?: (p: { current: number; total: number; keyId: string }) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const workers: Worker[] = []
    let cancelled = false
    let zipWorker: Worker | null = null

    const total = state.keys.length
    if (total === 0) {
      reject(new Error('No keys configured'))
      return
    }

    const cpuCount =
      typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
        ? navigator.hardwareConcurrency
        : 4
    const workerCount = Math.max(1, Math.min(total, Math.max(1, cpuCount - 1)))

    const abortHandler = () => {
      cancelled = true
      for (const w of workers) w.postMessage({ type: 'cancel' })
      if (zipWorker) zipWorker.postMessage({ type: 'cancel' })
      terminateAll()
      reject(new Error('Generation cancelled'))
    }

    const terminateAll = () => {
      if (signal) signal.removeEventListener('abort', abortHandler)
      for (const w of workers) w.terminate()
      workers.length = 0
      if (zipWorker) {
        zipWorker.terminate()
        zipWorker = null
      }
    }

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true })
    }

    const files: Record<string, Uint8Array> = {}
    let completed = 0
    let finishedWorkers = 0

    const maybeFinish = () => {
      if (cancelled) return
      if (finishedWorkers !== workerCount) return

      zipWorker = createGenerateWorker('zip')
      zipWorker.onmessage = e => {
        const { type, payload } = e.data
        if (type === 'zip-complete') {
          if (!cancelled) {
            const { zipData } = payload as { zipData: Uint8Array }
            downloadBytes(zipData, 'keycaps.zip', 'application/zip')
            terminateAll()
            resolve()
          }
        } else if (type === 'error') {
          if (!cancelled) {
            terminateAll()
            reject(new Error(payload.message))
          }
        }
      }
      zipWorker.onerror = err => {
        if (!cancelled) {
          const errorEvent = err as ErrorEvent
          const errorMsg = errorEvent.message || errorEvent.filename || 'Zip worker failed to load or execute'
          console.error('Zip worker error:', {
            message: errorEvent.message,
            filename: errorEvent.filename,
            lineno: errorEvent.lineno,
            colno: errorEvent.colno,
            error: errorEvent.error,
          })
          terminateAll()
          reject(new Error(`Zip worker failed: ${errorMsg}`))
        }
      }

      const transfers = Object.values(files).map(u => u.buffer)
      zipWorker.postMessage({ type: 'zip', payload: { files } }, transfers)
    }

    const keyIds = state.keys.map(k => k.id)
    const chunks: string[][] = Array.from({ length: workerCount }, () => [])
    for (let i = 0; i < keyIds.length; i++) {
      chunks[i % workerCount].push(keyIds[i])
    }

    for (let workerIndex = 0; workerIndex < workerCount; workerIndex++) {
      const w = createGenerateWorker(`generate-${workerIndex + 1}`)
      workers.push(w)

      w.onmessage = e => {
        const { type, payload } = e.data

        if (type === 'progress') {
          if (!cancelled) {
            const { keyId } = payload as { keyId: string }
            completed++
            onProgress?.({ current: completed, total, keyId })
          }
        } else if (type === 'batch-complete') {
          if (!cancelled) {
            const batchFiles = (payload as { files: Record<string, Uint8Array> }).files
            for (const [name, bytes] of Object.entries(batchFiles)) {
              files[name] = bytes
            }
            finishedWorkers++
            maybeFinish()
          }
        } else if (type === 'error') {
          if (!cancelled) {
            cancelled = true
            terminateAll()
            reject(new Error(payload.message))
          }
        }
      }

      w.onerror = error => {
        if (!cancelled) {
          cancelled = true
          const errorEvent = error as ErrorEvent
          const errorMsg = errorEvent.message || errorEvent.filename || 'Worker failed to load or execute'
          console.error('Worker error:', {
            message: errorEvent.message,
            filename: errorEvent.filename,
            lineno: errorEvent.lineno,
            colno: errorEvent.colno,
            error: errorEvent.error,
          })
          terminateAll()
          reject(new Error(`Worker failed: ${errorMsg}`))
        }
      }

      w.postMessage({
        type: 'generate-batch',
        payload: { state, stlBuffersByModelId, keyIds: chunks[workerIndex] },
      })
    }

    // Emit an initial progress event so UI can show something immediately.
    if (onProgress && total > 0) {
      onProgress({ current: 0, total, keyId: state.keys[0].id })
    }
  })
}

export async function generatePreviewModel(
  state: AppState,
  keyId: string,
  stlBuffersByModelId: Record<string, ArrayBuffer | null>,
  signal?: AbortSignal
): Promise<Group | null> {
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

  const baseGeom = await processStlForModel(stlBuf, model.rotationX, model.rotationY, model.rotationZ)

  await yieldAndCheck()

  return await generateKeycapModel(state, key, template, baseGeom, yieldAndCheck)
}
