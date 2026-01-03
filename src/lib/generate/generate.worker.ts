/// <reference lib="webworker" />

import type { AppState } from '../state/types'
import { parseSTL, centerGeometryXY, alignBottomTo } from './stl'
import { makeMesh, csgIntersect, csgSubtract, csgUnionMeshes } from './csg'
import { exportTo3MF } from './threeTo3mf'
import { getFont } from './fonts'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { MathUtils, Group, Mesh, BufferGeometry } from 'three'
import { zipSync } from 'fflate'

const serverStlCache = new Map<string, ArrayBuffer>()

function getTemplate(state: AppState, key: { id: string; templateId: string }) {
  return state.templates.find(t => t.id === key.templateId) ?? null
}

function getModel(state: AppState, template: { keycapModelId: string }) {
  return state.keycapModels.find(m => m.id === template.keycapModelId) ?? null
}

async function getStlBufferForModel(
  modelId: string,
  stlBuffersByModelId: Record<string, ArrayBuffer | null>,
  state: AppState
): Promise<ArrayBuffer> {
  const model = state.keycapModels.find(m => m.id === modelId)
  if (!model) throw new Error(`Model not found: ${modelId}`)

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

function safeFileName(name: string): string {
  return (
    name
      .trim()
      .replaceAll(/[\s]+/g, '_')
      .replaceAll(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .slice(0, 120) || 'key'
  )
}

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

      // Helper to yield and check for cancellation
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

        // Get or create base geometry for this model
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

        const baseMinZ = baseGeom.boundingBox!.min.z
        const textMeshes: { mesh: Mesh; color: number; name?: string }[] = []
        const extrusionMeshes: Mesh[] = []

        // Process each symbol in the template
        for (const sym of template.symbols) {
          await yieldAndCheck()

          const text = (key.textsBySymbolId[sym.id] ?? '').trim()
          if (!text) continue

          const fontResult = getFont(sym.fontFamily, sym.fontWeight)
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

        await yieldAndCheck()

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

        await yieldAndCheck()

        const blob = await exportTo3MF(group, { printer_name: 'Bambu Lab A1' })
        const arrayBuffer = await blob.arrayBuffer()
        files[`${safeFileName(key.name)}.3mf`] = new Uint8Array(arrayBuffer)
      }

      await yieldAndCheck()

      // Create a single ZIP file containing all 3MF files
      const allFilesZip = zipSync(files)

      // Send the result back
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

