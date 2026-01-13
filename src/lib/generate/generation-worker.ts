/// <reference lib="webworker" />

// three/examples/jsm/loaders/SVGLoader uses DOMParser internally; workers don't provide it.
// Provide a small polyfill so batch generation can extrude SVG icons.
import { DOMParser as XmldomDOMParser } from '@xmldom/xmldom'
if (!(globalThis as any).DOMParser) {
  ;(globalThis as any).DOMParser = XmldomDOMParser as any
}

import type { AppState } from '../state/types'
import { exportTo3MF } from 'three-3mf-exporter'
import { zipSync } from 'fflate'
import { registerCustomFonts } from './fonts'
import { serializeGroupToPreviewMeshes, type PreviewMeshPayload } from './previewMesh'
import {
  type GenerationInput,
  BaseGeometryCache,
  resolveKeycap,
  safeFileName,
  buildKeycapGroup,
} from './keycap-builder'

export type WorkerRequest =
  | { type: 'generate'; payload: GeneratePayload }
  | { type: 'zip'; payload: ZipPayload }
  | { type: 'cancel' }

export interface GeneratePayload {
  output: 'preview' | 'batch'
  state: AppState
  stlBuffersByModelId: Record<string, ArrayBuffer | null>
  items: GenerationInput[]
}

export interface ZipPayload {
  files: Record<string, Uint8Array>
}

export type WorkerResponse =
  | { type: 'preview-complete'; payload: { meshes: PreviewMeshPayload[] } }
  | { type: 'batch-progress'; payload: { keyId: string } }
  | { type: 'batch-complete'; payload: { files: Record<string, Uint8Array> } }
  | { type: 'zip-complete'; payload: { zipData: Uint8Array } }
  | { type: 'error'; payload: { message: string } }

let cancelled = false

function checkCancelled(message = 'Generation cancelled'): void {
  if (cancelled) throw new Error(message)
}

async function yieldWithCancellationCheck(message?: string): Promise<void> {
  await new Promise(r => setTimeout(r, 0))
  checkCancelled(message)
}

async function handleGenerate(payload: GeneratePayload): Promise<void> {
  const { output, state, stlBuffersByModelId, items } = payload

  if (!items || items.length === 0) {
    throw new Error('No items to generate')
  }

  registerCustomFonts(state.customFonts)

  const geometryCache = new BaseGeometryCache()

  if (output === 'preview') {
    await handlePreviewGeneration(state, stlBuffersByModelId, items[0], geometryCache)
  } else {
    await handleBatchGeneration(state, stlBuffersByModelId, items, geometryCache)
  }
}

async function handlePreviewGeneration(
  state: AppState,
  stlBuffersByModelId: Record<string, ArrayBuffer | null>,
  input: GenerationInput,
  geometryCache: BaseGeometryCache
): Promise<void> {
  const resolved = resolveKeycap(state, input)

  if (!resolved) {
    self.postMessage({ type: 'preview-complete', payload: { meshes: [] } } satisfies WorkerResponse)
    return
  }

  checkCancelled('Preview generation cancelled')

  const baseGeom = await geometryCache.get(resolved.model, stlBuffersByModelId)
  checkCancelled('Preview generation cancelled')

  const group = await buildKeycapGroup(state, resolved, baseGeom, () =>
    yieldWithCancellationCheck('Preview generation cancelled')
  )

  const { meshes, transfers } = serializeGroupToPreviewMeshes(group)

  if (!cancelled) {
    self.postMessage({ type: 'preview-complete', payload: { meshes } } satisfies WorkerResponse, transfers)
  }
}

async function handleBatchGeneration(
  state: AppState,
  stlBuffersByModelId: Record<string, ArrayBuffer | null>,
  items: GenerationInput[],
  geometryCache: BaseGeometryCache
): Promise<void> {
  const files: Record<string, Uint8Array> = {}

  for (const item of items) {
    checkCancelled('Generation cancelled')

    const resolved = resolveKeycap(state, item)
    if (!resolved) continue

    const baseGeom = await geometryCache.get(resolved.model, stlBuffersByModelId)
    checkCancelled('Generation cancelled')

    const group = await buildKeycapGroup(state, resolved, baseGeom, () =>
      yieldWithCancellationCheck('Generation cancelled')
    )

    const blob = await exportTo3MF(group)
    const arrayBuffer = await blob.arrayBuffer()

    // Generate filename with index for ordering
    const keyIndex = state.keys.findIndex(k => k.id === resolved.key.id) + 1
    const filename = `${keyIndex}. ${safeFileName(resolved.key.name)}.3mf`
    files[filename] = new Uint8Array(arrayBuffer)

    // Report progress
    self.postMessage({
      type: 'batch-progress',
      payload: { keyId: resolved.key.id },
    } satisfies WorkerResponse)
  }

  checkCancelled('Generation cancelled')

  if (!cancelled) {
    const transfers = Object.values(files).map(u => u.buffer)
    self.postMessage({ type: 'batch-complete', payload: { files } } satisfies WorkerResponse, transfers)
  }
}

async function handleZip(payload: ZipPayload): Promise<void> {
  const { files } = payload
  const zipData = zipSync(files)

  if (!cancelled) {
    self.postMessage({ type: 'zip-complete', payload: { zipData } } satisfies WorkerResponse, [zipData.buffer])
  }
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { type } = e.data

  if (type === 'cancel') {
    cancelled = true
    return
  }

  if (type === 'generate') {
    cancelled = false
    try {
      await handleGenerate(e.data.payload)
    } catch (error) {
      if (!cancelled) {
        self.postMessage({
          type: 'error',
          payload: {
            message: error instanceof Error ? error.message : 'Generation failed.',
          },
        } satisfies WorkerResponse)
      }
    }
    return
  }

  if (type === 'zip') {
    cancelled = false
    try {
      await handleZip(e.data.payload)
    } catch (error) {
      if (!cancelled) {
        self.postMessage({
          type: 'error',
          payload: {
            message: error instanceof Error ? error.message : 'Zip failed.',
          },
        } satisfies WorkerResponse)
      }
    }
    return
  }
}
