import type { AppState } from '../state/types'
import type { GenerationInput } from './keycap-builder'
import type { GeneratePayload, WorkerResponse } from './generation-worker'

function createWorker(name?: string): Worker {
  return new Worker(new URL('./generation-worker.ts', import.meta.url), {
    type: 'module',
    name,
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
    const lastStartedKeyIdByWorker = new Map<Worker, string>()
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
    const workerCount = Math.min(Math.max(1, Math.min(total, Math.max(1, cpuCount - 1))), 2) // Limit to 2 workers (Chrome has a hard memory limit)

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

        if (type === 'batch-item-start') {
          if (!cancelled) {
            lastStartedKeyIdByWorker.set(worker, payload.keyId)
            onProgress?.({ current: completed, total, keyId: payload.keyId })
          }
        } else if (type === 'batch-progress') {
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
            const keyContext = getKeyContextMessage(state, lastStartedKeyIdByWorker.get(worker))
            reject(new Error(withKeyContext(payload.message, keyContext)))
          }
        }
      }

      worker.onerror = error => {
        if (!cancelled) {
          cancelled = true
          const errorEvent = error as ErrorEvent
          const errorMsg = errorEvent.message || 'Worker failed'
          terminateAll()
          const keyContext = getKeyContextMessage(state, lastStartedKeyIdByWorker.get(worker))
          reject(new Error(withKeyContext(`Worker failed: ${errorMsg}`, keyContext)))
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

function getKeyContextMessage(state: AppState, keyId: string | undefined): string | null {
  if (!keyId || keyId === '__template__') return null

  const key = state.keys.find(k => k.id === keyId)
  if (!key) return `key id: ${keyId}`

  const template = state.templates.find(t => t.id === key.templateId)
  const model = template ? state.keycapModels.find(m => m.id === template.keycapModelId) : null

  const templatePart = template ? `, template: "${template.name}" (${template.id})` : ''
  const modelPart = model ? `, model: "${model.name}" (${model.id})` : ''
  return `key: "${key.name}" (${key.id})${templatePart}${modelPart}`
}

function withKeyContext(message: string, keyContext: string | null): string {
  if (!keyContext) return message
  if (message.includes('key "') || message.includes('key id "') || message.includes('key: "')) return message
  return `${message} (${keyContext})`
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

export async function generatePreview(
  state: AppState,
  input: GenerationInput,
  stlBuffersByModelId: Record<string, ArrayBuffer | null>
): Promise<any> {
  return new Promise((resolve, reject) => {
    const worker = createWorker('preview')
    let cancelled = false

    const terminate = () => {
      worker.terminate()
    }

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { type, payload } = e.data

      if (type === 'preview-complete') {
        if (!cancelled) {
          resolve(payload.geometry)
          terminate()
        }
      } else if (type === 'error') {
        if (!cancelled) {
          terminate()
          reject(new Error(payload.message))
        }
      }
    }

    worker.onerror = error => {
      if (!cancelled) {
        cancelled = true
        terminate()
        reject(new Error('Worker failed'))
      }
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

export type { GenerationInput } from './keycap-builder'
export { safeFileName, getTemplate, getModel } from './keycap-builder'
