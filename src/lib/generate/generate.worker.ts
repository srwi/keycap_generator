/// <reference lib="webworker" />

import type { AppState } from '../state/types'
import type { KeyDef, Template } from '../state/types'
import { processStlForModel } from './stl'
import { exportTo3MF } from 'three-3mf-exporter'
import { generateKeycapModel, getTemplate, getModel, getStlBufferForModel, safeFileName } from './generate'
import { BufferGeometry, Group } from 'three'
import { zipSync } from 'fflate'
import { registerCustomFonts } from './fonts'
import { serializeGroupToPreviewMeshes } from './previewMesh'

let cancelled = false

function checkCancelled(message: string): void {
  if (cancelled) throw new Error(message)
}

async function baseGeometryForModel(
  state: AppState,
  modelId: string,
  rotationX: number,
  rotationY: number,
  rotationZ: number,
  stlBuffersByModelId: Record<string, ArrayBuffer | null>,
  baseGeomByModelId: Map<string, BufferGeometry>
): Promise<BufferGeometry> {
  const cached = baseGeomByModelId.get(modelId)
  if (cached) return cached

  checkCancelled('Generation cancelled')
  const stlBuf = await getStlBufferForModel(modelId, stlBuffersByModelId, state)
  const baseGeom = await processStlForModel(stlBuf, rotationX, rotationY, rotationZ)
  baseGeomByModelId.set(modelId, baseGeom)
  return baseGeom
}

async function buildKeycapGroup(
  state: AppState,
  key: KeyDef,
  template: Template,
  stlBuffersByModelId: Record<string, ArrayBuffer | null>,
  baseGeomByModelId: Map<string, BufferGeometry>
): Promise<Group> {
  const model = getModel(state, template)
  if (!model) throw new Error(`Template "${template.name}" references a missing keycap model.`)

  const baseGeom = await baseGeometryForModel(
    state,
    model.id,
    model.rotationX,
    model.rotationY,
    model.rotationZ,
    stlBuffersByModelId,
    baseGeomByModelId
  )

  checkCancelled('Generation cancelled')
  return await generateKeycapModel(state, key, template, baseGeom)
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data

  if (type === 'cancel') {
    cancelled = true
    return
  }

  if (type === 'generate') {
    cancelled = false
    const baseGeomByModelId = new Map<string, BufferGeometry>()

    type GenerateItem =
      | { kind: 'keyId'; keyId: string }
      | { kind: 'template'; template: Template; textsBySymbolId: Record<string, string> }

    const p = payload as {
      output: 'preview' | 'batch'
      state: AppState
      stlBuffersByModelId: Record<string, ArrayBuffer | null>
      items: GenerateItem[]
    }

    try {
      registerCustomFonts(p.state.customFonts)

      const resolveItem = (item: GenerateItem): { key: KeyDef; template: Template } | null => {
        if (item.kind === 'keyId') {
          const key = p.state.keys.find(k => k.id === item.keyId) ?? null
          if (!key) return null
          const tpl = getTemplate(p.state, key)
          if (!tpl) return null
          return { key, template: tpl }
        }

        const key: KeyDef = {
          id: '__preview__',
          name: 'Preview',
          templateId: item.template.id,
          textsBySymbolId: item.textsBySymbolId,
        }
        return { key, template: item.template }
      }

      if (!p.items || p.items.length === 0) {
        throw new Error('No keys configured')
      }

      if (p.output === 'preview') {
        // Preview is intentionally a single-item job.
        const resolved = resolveItem(p.items[0])
        if (!resolved) {
          self.postMessage({ type: 'complete', payload: { output: 'preview', meshes: [] } })
          return
        }
        checkCancelled('Preview generation cancelled')
        const group = await buildKeycapGroup(
          p.state,
          resolved.key,
          resolved.template,
          p.stlBuffersByModelId,
          baseGeomByModelId
        )
        const { meshes, transfers } = serializeGroupToPreviewMeshes(group)
        if (!cancelled) self.postMessage({ type: 'complete', payload: { output: 'preview', meshes } }, transfers)
        return
      }

      // batch output
      const files: Record<string, Uint8Array> = {}
      for (const item of p.items) {
        checkCancelled('Generation cancelled')
        const resolved = resolveItem(item)
        if (!resolved) continue

        const group = await buildKeycapGroup(
          p.state,
          resolved.key,
          resolved.template,
          p.stlBuffersByModelId,
          baseGeomByModelId
        )
        const blob = await exportTo3MF(group)

        const arrayBuffer = await blob.arrayBuffer()
        const keyIndex = p.state.keys.findIndex(k => k.id === resolved.key.id) + 1
        files[`${keyIndex}. ${safeFileName(resolved.key.name)}.3mf`] = new Uint8Array(arrayBuffer)

        self.postMessage({ type: 'progress', payload: { keyId: resolved.key.id } })
      }

      checkCancelled('Generation cancelled')
      if (!cancelled) {
        const transfers = Object.values(files).map(u => u.buffer)
        self.postMessage({ type: 'complete', payload: { output: 'batch', files } }, transfers)
      }
      return
    } catch (error) {
      if (!cancelled) {
        self.postMessage({
          type: 'error',
          payload: {
            message:
              error instanceof Error ? error.message : p.output === 'preview' ? 'Preview generation failed.' : 'Generation failed.',
          },
        })
      }
      return
    }
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

}
