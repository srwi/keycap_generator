/// <reference lib="webworker" />

import type { AppState } from '../state/types'
import { parseSTL, centerGeometryXY, alignBottomTo } from './stl'
import { exportTo3MF } from 'three-3mf-exporter'
import { generateKeycapModel, getTemplate, getModel, getStlBufferForModel, safeFileName } from './generate'
import { BufferGeometry } from 'three'
import { zipSync } from 'fflate'

let cancelled = false

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data

  if (type === 'cancel') {
    cancelled = true
    return
  }

  if (type === 'generate-all') {
    cancelled = false
    const { state, stlBuffersByModelId } = payload as {
      state: AppState
      stlBuffersByModelId: Record<string, ArrayBuffer | null>
    }

    try {
      const baseGeomByModelId = new Map<string, BufferGeometry>()
      const files: Record<string, Uint8Array> = {}

      if (state.keys.length === 0) {
        throw new Error('No keys configured')
      }

      const yieldAndCheck = async () => {
        await new Promise(r => setTimeout(r, 0))
        if (cancelled) {
          throw new Error('Generation cancelled')
        }
      }

      const total = state.keys.length
      for (let i = 0; i < total; i++) {
        await yieldAndCheck()

        const key = state.keys[i]
        self.postMessage({
          type: 'progress',
          payload: { current: i + 1, total, keyId: key.id },
        })

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
          baseGeom = await parseSTL(stlBuf)
          centerGeometryXY(baseGeom)
          alignBottomTo(baseGeom, 0)
          baseGeom.computeBoundingBox()
          baseGeomByModelId.set(model.id, baseGeom)
        }

        const group = await generateKeycapModel(state, key, template, baseGeom, yieldAndCheck)

        const blob = await exportTo3MF(group)

        const arrayBuffer = await blob.arrayBuffer()
        files[`${safeFileName(key.name)}.3mf`] = new Uint8Array(arrayBuffer)
      }

      await yieldAndCheck()

      const allFilesZip = zipSync(files)

      if (!cancelled) {
        self.postMessage({
          type: 'complete',
          payload: { zipData: allFilesZip },
        })
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
