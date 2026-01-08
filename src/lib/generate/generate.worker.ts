/// <reference lib="webworker" />

import type { AppState } from '../state/types'
import { processStlForModel } from './stl'
import { exportTo3MF } from 'three-3mf-exporter'
import { generateKeycapModel, getTemplate, getModel, getStlBufferForModel, safeFileName } from './generate'
import { BufferGeometry } from 'three'
import { zipSync } from 'fflate'
import { registerCustomFonts } from './fonts'

let cancelled = false

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data

  if (type === 'cancel') {
    cancelled = true
    return
  }

  if (type === 'zip') {
    cancelled = false
    const { files } = payload as { files: Record<string, Uint8Array> }
    try {
      const zipData = zipSync(files)
      if (!cancelled) {
        self.postMessage({ type: 'zip-complete', payload: { zipData } }, [zipData.buffer])
      }
    } catch (error) {
      if (!cancelled) {
        self.postMessage({
          type: 'error',
          payload: { message: error instanceof Error ? error.message : 'Zip failed.' },
        })
      }
    }
    return
  }

  if (type === 'generate-batch') {
    cancelled = false
    const { state, stlBuffersByModelId, keyIds } = payload as {
      state: AppState
      stlBuffersByModelId: Record<string, ArrayBuffer | null>
      keyIds: string[]
    }

    try {
      registerCustomFonts(state.customFonts)
      const baseGeomByModelId = new Map<string, BufferGeometry>()
      const files: Record<string, Uint8Array> = {}

      const keysById = new Map(state.keys.map(k => [k.id, k]))

      if (keyIds.length === 0) {
        throw new Error('No keys configured')
      }

      const yieldAndCheck = async () => {
        await new Promise(r => setTimeout(r, 0))
        if (cancelled) {
          throw new Error('Generation cancelled')
        }
      }

      for (const keyId of keyIds) {
        await yieldAndCheck()

        const key = keysById.get(keyId)
        if (!key) continue

        const template = getTemplate(state, key)
        if (!template) {
          continue
        }

        const model = getModel(state, template)
        if (!model) throw new Error(`Template "${template.name}" references a missing keycap model.`)

        let baseGeom = baseGeomByModelId.get(model.id)
        if (!baseGeom) {
          await yieldAndCheck()
          const stlBuf = await getStlBufferForModel(model.id, stlBuffersByModelId, state)
          baseGeom = await processStlForModel(stlBuf, model.rotationX, model.rotationY, model.rotationZ)
          baseGeomByModelId.set(model.id, baseGeom)
        }

        const group = await generateKeycapModel(state, key, template, baseGeom, yieldAndCheck)
        const blob = await exportTo3MF(group)

        const arrayBuffer = await blob.arrayBuffer()
        const keyIndex = state.keys.findIndex(k => k.id === keyId) + 1
        files[`${keyIndex}. ${safeFileName(key.name)}.3mf`] = new Uint8Array(arrayBuffer)

        self.postMessage({ type: 'progress', payload: { keyId: key.id } })
      }

      await yieldAndCheck()

      if (!cancelled) {
        const transfers = Object.values(files).map(u => u.buffer)
        self.postMessage(
          {
            type: 'batch-complete',
            payload: { files },
          },
          transfers
        )
      }
    } catch (error) {
      if (!cancelled) {
        self.postMessage({
          type: 'error',
          payload: { message: error instanceof Error ? error.message : 'Generation failed.' },
        })
      }
    }
  }
}
