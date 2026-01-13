import type { AppState, KeyDef, KeycapModel, SymbolContent, Template } from '../state/types'
import { processStlForModel, centerGeometryXY, alignBottomTo } from './stl'
import { makeMesh, csgIntersect, csgSubtract, csgUnionMeshes } from './csg'
import { KEYCAP_BODY_COLOR } from './materials'
import { getFont } from './fonts'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { BufferGeometry, Group, MathUtils, Mesh, Matrix4 } from 'three'
import { createIconGeometry } from './svg-geometry'
import { loadRawIconPath, PHOSPHOR_ICON_VIEWBOX } from '../services/icons'

export type GenerationInput =
  | { kind: 'keyId'; keyId: string }
  | { kind: 'template'; template: Template; contentBySymbolId: Record<string, SymbolContent> }

export function getSymbolContent(key: KeyDef, symbolId: string): SymbolContent | null {
  return key.contentBySymbolId[symbolId] ?? null
}

export interface ResolvedKeycap {
  key: KeyDef
  template: Template
  model: KeycapModel
}

export type CancellationCheck = () => Promise<void>

export function getTemplate(state: AppState, templateId: string): Template | null {
  return state.templates.find(t => t.id === templateId) ?? null
}

export function getModel(state: AppState, keycapModelId: string): KeycapModel | null {
  return state.keycapModels.find(m => m.id === keycapModelId) ?? null
}

export function resolveKeycap(state: AppState, input: GenerationInput): ResolvedKeycap | null {
  if (input.kind === 'keyId') {
    const key = state.keys.find(k => k.id === input.keyId)
    if (!key) return null

    const template = getTemplate(state, key.templateId)
    if (!template) return null

    const model = getModel(state, template.keycapModelId)
    if (!model) return null

    return { key, template, model }
  }

  const { template, contentBySymbolId } = input

  const model = getModel(state, template.keycapModelId)
  if (!model) return null

  const key: KeyDef = {
    id: '__preview__',
    name: 'Preview',
    templateId: template.id,
    contentBySymbolId,
  }

  return { key, template, model }
}

const serverStlCache = new Map<string, ArrayBuffer>()

export async function getStlBuffer(
  model: KeycapModel,
  stlBuffersByModelId: Record<string, ArrayBuffer | null>
): Promise<ArrayBuffer> {
  if (model.source.kind === 'upload') {
    const buf = stlBuffersByModelId[model.id]
    if (!buf) {
      throw new Error(`Missing STL for model "${model.name}". Upload it in the Models step.`)
    }
    return buf
  }

  const cached = serverStlCache.get(model.source.url)
  if (cached) return cached

  const res = await fetch(model.source.url)
  if (!res.ok) {
    throw new Error(`Failed to fetch STL for model "${model.name}" (${model.source.url}).`)
  }

  const buf = await res.arrayBuffer()
  serverStlCache.set(model.source.url, buf)
  return buf
}

export class BaseGeometryCache {
  private cache = new Map<string, BufferGeometry>()

  private getCacheKey(model: KeycapModel): string {
    return `${model.id}:${model.rotationX}:${model.rotationY}:${model.rotationZ}`
  }

  async get(model: KeycapModel, stlBuffersByModelId: Record<string, ArrayBuffer | null>): Promise<BufferGeometry> {
    const key = this.getCacheKey(model)
    const cached = this.cache.get(key)
    if (cached) return cached

    const stlBuf = await getStlBuffer(model, stlBuffersByModelId)
    const geom = await processStlForModel(stlBuf, model.rotationX, model.rotationY, model.rotationZ)

    this.cache.set(key, geom)
    return geom
  }
}

export async function buildKeycapGroup(
  state: AppState,
  resolved: ResolvedKeycap,
  baseGeom: BufferGeometry,
  checkCancelled?: CancellationCheck
): Promise<Group> {
  const { key, template, model } = resolved

  if (checkCancelled) await checkCancelled()

  const baseMinZ = baseGeom.boundingBox!.min.z
  const symbolMeshes: { mesh: Mesh; color: number; name?: string }[] = []
  const extrusionMeshes: Mesh[] = []

  // Process each symbol
  for (const sym of template.symbols) {
    if (checkCancelled) await checkCancelled()

    const content = getSymbolContent(key, sym.id)
    if (!content) continue

    let symbolGeom: BufferGeometry

    if (content.kind === 'text') {
      // Text content - use font geometry
      const fontResult = getFont(sym.fontName)
      const font = fontResult instanceof Promise ? await fontResult : fontResult

      symbolGeom = new TextGeometry(content.value, {
        font,
        size: sym.fontSizeMm,
        depth: model.extrusionDepthMm,
        curveSegments: 3,
        bevelEnabled: false,
      } as any)
      symbolGeom.rotateY(Math.PI)
    } else {
      // Icon content - use SVG geometry
      const iconPath = await loadRawIconPath(content.iconName)
      if (!iconPath) continue

      symbolGeom = createIconGeometry(iconPath, sym.fontSizeMm, model.extrusionDepthMm, PHOSPHOR_ICON_VIEWBOX)
    }

    symbolGeom.computeVertexNormals()
    centerGeometryXY(symbolGeom)

    const rz = MathUtils.degToRad(sym.rotationDeg)
    if (rz !== 0) symbolGeom.rotateZ(rz)
    symbolGeom.translate(-sym.x, sym.y, 0)
    alignBottomTo(symbolGeom, baseMinZ)

    const color = parseInt(sym.color.replace('#', '0x'))
    const extrMesh = makeMesh(symbolGeom, color)
    extrusionMeshes.push(extrMesh)

    const interMesh = makeMesh(symbolGeom.clone() as BufferGeometry, color)
    const name = content.kind === 'text' ? content.value : content.iconName
    symbolMeshes.push({ mesh: interMesh, color, name })
  }

  if (checkCancelled) await checkCancelled()

  const baseMesh = makeMesh(baseGeom.clone() as BufferGeometry, KEYCAP_BODY_COLOR)
  const unionExtrusion = await csgUnionMeshes(extrusionMeshes, checkCancelled)

  if (checkCancelled) await checkCancelled()

  const bodyResult = unionExtrusion ? csgSubtract(baseMesh, unionExtrusion) : baseMesh

  if (checkCancelled) await checkCancelled()

  const group = new Group()
  bodyResult.name = 'body'
  group.add(bodyResult)

  for (let j = 0; j < symbolMeshes.length; j++) {
    if (checkCancelled) await checkCancelled()
    const tr = symbolMeshes[j]
    const r = csgIntersect(baseMesh, tr.mesh)
    r.material = tr.mesh.material
    r.name = tr.name || `symbol_${j}`
    group.add(r)
  }

  return group
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
