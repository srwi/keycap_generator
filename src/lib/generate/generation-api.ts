import type { Group } from 'three'
import type { AppState } from '../state/types'
import type { GenerationInput } from './keycap-builder'
import type { GeneratePayload, WorkerResponse } from './generation-worker'
import { groupFromPreviewMeshes } from './previewMesh'

function createWorker(name?: string): Worker {
  return new Worker(new URL('./generation-worker.ts', import.meta.url), {
    type: 'module',
    name,
  })
}

interface WorkerHandle {
  worker: Worker
  terminate: () => void
}

function setupWorker(name: string, signal: AbortSignal | undefined, onAbort: () => void): WorkerHandle {
  const worker = createWorker(name)
  let terminated = false

  const abortHandler = () => {
    if (terminated) return
    try {
      worker.postMessage({ type: 'cancel' })
    } catch {
      // Ignore errors during abort
    }
    onAbort()
  }

  if (signal) {
    if (signal.aborted) {
      abortHandler()
    } else {
      signal.addEventListener('abort', abortHandler, { once: true })
    }
  }

  return {
    worker,
    terminate: () => {
      if (terminated) return
      terminated = true
      if (signal) {
        signal.removeEventListener('abort', abortHandler)
      }
      worker.terminate()
    },
  }
}

export interface PreviewOptions {
  state: AppState
  input: GenerationInput
  stlBuffersByModelId: Record<string, ArrayBuffer | null>
  signal?: AbortSignal
}

export function generatePreview(options: PreviewOptions): Promise<Group | null> {
  const { state, input, stlBuffersByModelId, signal } = options

  return new Promise((resolve, reject) => {
    let finished = false

    const { worker, terminate } = setupWorker('preview', signal, () => {
      finish(() => reject(new Error('Preview generation cancelled')))
    })

    const finish = (fn: () => void) => {
      if (finished) return
      finished = true
      terminate()
      fn()
    }

    if (signal?.aborted) {
      finish(() => reject(new Error('Preview generation cancelled')))
      return
    }

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { type, payload } = e.data

      if (type === 'preview-complete') {
        const { meshes } = payload
        finish(() => resolve(meshes.length ? groupFromPreviewMeshes(meshes) : null))
      } else if (type === 'error') {
        finish(() => reject(new Error(payload.message)))
      }
    }

    worker.onerror = err => {
      const errorEvent = err as ErrorEvent
      const errorMsg = errorEvent.message || errorEvent.filename || 'Preview worker failed'
      finish(() => reject(new Error(`Preview worker failed: ${errorMsg}`)))
    }

    const generatePayload: GeneratePayload = {
      output: 'preview',
      state,
      stlBuffersByModelId,
      items: [input],
    }

    worker.postMessage({ type: 'generate', payload: generatePayload })
  })
}

export interface BatchOptions {
  state: AppState
  stlBuffersByModelId: Record<string, ArrayBuffer | null>
  onProgress?: (progress: { current: number; total: number; keyId: string }) => void
  signal?: AbortSignal
}

export function generateBatch(options: BatchOptions): Promise<void> {
  const { state, stlBuffersByModelId, onProgress, signal } = options

  return new Promise((resolve, reject) => {
    const workers: Worker[] = []
    let cancelled = false
    let zipWorker: Worker | null = null

    const total = state.keys.length
    if (total === 0) {
      reject(new Error('No keys configured'))
      return
    }

    // Determine worker count based on CPU cores
    const cpuCount =
      typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
        ? navigator.hardwareConcurrency
        : 4
    const workerCount = Math.max(1, Math.min(total, Math.max(1, cpuCount - 1)))

    const terminateAll = () => {
      if (signal) signal.removeEventListener('abort', abortHandler)
      for (const w of workers) w.terminate()
      workers.length = 0
      if (zipWorker) {
        zipWorker.terminate()
        zipWorker = null
      }
    }

    const abortHandler = () => {
      cancelled = true
      for (const w of workers) {
        try {
          w.postMessage({ type: 'cancel' })
        } catch {
          // Ignore
        }
      }
      if (zipWorker) {
        try {
          zipWorker.postMessage({ type: 'cancel' })
        } catch {
          // Ignore
        }
      }
      terminateAll()
      reject(new Error('Generation cancelled'))
    }

    if (signal) {
      if (signal.aborted) {
        abortHandler()
        return
      }
      signal.addEventListener('abort', abortHandler, { once: true })
    }

    const files: Record<string, Uint8Array> = {}
    let completed = 0
    let finishedWorkers = 0

    const maybeFinish = () => {
      if (cancelled) return
      if (finishedWorkers !== workerCount) return

      // All workers done - zip the files
      zipWorker = createWorker('zip')

      zipWorker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { type, payload } = e.data

        if (type === 'zip-complete') {
          if (!cancelled) {
            const { zipData } = payload
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
          const errorMsg = errorEvent.message || 'Zip worker failed'
          terminateAll()
          reject(new Error(`Zip worker failed: ${errorMsg}`))
        }
      }

      const transfers = Object.values(files).map(u => u.buffer)
      zipWorker.postMessage({ type: 'zip', payload: { files } }, transfers)
    }

    // Distribute keys across workers
    const keyIds = state.keys.map(k => k.id)
    const chunks: string[][] = Array.from({ length: workerCount }, () => [])
    for (let i = 0; i < keyIds.length; i++) {
      chunks[i % workerCount].push(keyIds[i])
    }

    // Spawn workers
    for (let workerIndex = 0; workerIndex < workerCount; workerIndex++) {
      const worker = createWorker(`generate-${workerIndex + 1}`)
      workers.push(worker)

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { type, payload } = e.data

        if (type === 'batch-progress') {
          if (!cancelled) {
            completed++
            onProgress?.({ current: completed, total, keyId: payload.keyId })
          }
        } else if (type === 'batch-complete') {
          if (!cancelled) {
            for (const [name, bytes] of Object.entries(payload.files)) {
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

      worker.onerror = error => {
        if (!cancelled) {
          cancelled = true
          const errorEvent = error as ErrorEvent
          const errorMsg = errorEvent.message || 'Worker failed'
          terminateAll()
          reject(new Error(`Worker failed: ${errorMsg}`))
        }
      }

      const generatePayload: GeneratePayload = {
        output: 'batch',
        state,
        stlBuffersByModelId,
        items: chunks[workerIndex].map(keyId => ({ kind: 'keyId', keyId })),
      }

      worker.postMessage({ type: 'generate', payload: generatePayload })
    }

    // Emit initial progress
    if (onProgress && total > 0) {
      onProgress({ current: 0, total, keyId: state.keys[0].id })
    }
  })
}

function downloadBytes(bytes: Uint8Array, fileName: string, mime = 'application/octet-stream') {
  const copy = new Uint8Array(bytes)
  const blob = new Blob([copy.buffer], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type { GenerationInput } from './keycap-builder'
export { safeFileName, getTemplate, getModel } from './keycap-builder'
