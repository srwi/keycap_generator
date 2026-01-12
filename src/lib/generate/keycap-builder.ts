import type { AppState, KeyDef, KeycapModel, Template } from '../state/types'
import { processStlForModel, centerGeometryXY, alignBottomTo } from './stl'
import { makeMesh, csgIntersect, csgSubtract, csgUnionMeshes } from './csg'
import { KEYCAP_BODY_COLOR } from './materials'
import { getFont } from './fonts'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { BufferGeometry, Group, MathUtils, Mesh } from 'three'

export type GenerationInput =
  | { kind: 'keyId'; keyId: string }
  | { kind: 'template'; template: Template; textsBySymbolId: Record<string, string> }

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

  // Template mode - create synthetic key
  const { template, textsBySymbolId } = input

  const model = getModel(state, template.keycapModelId)
  if (!model) return null

  const key: KeyDef = {
    id: '__preview__',
    name: 'Preview',
    templateId: template.id,
    textsBySymbolId,
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

  async get(
    model: KeycapModel,
    stlBuffersByModelId: Record<string, ArrayBuffer | null>
  ): Promise<BufferGeometry> {
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
  const textMeshes: { mesh: Mesh; color: number; name?: string }[] = []
  const extrusionMeshes: Mesh[] = []

  // Process each text symbol
  for (const sym of template.symbols) {
    if (checkCancelled) await checkCancelled()

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

  if (checkCancelled) await checkCancelled()

  const baseMesh = makeMesh(baseGeom.clone() as BufferGeometry, KEYCAP_BODY_COLOR)
  const unionExtrusion = await csgUnionMeshes(extrusionMeshes, checkCancelled)

  if (checkCancelled) await checkCancelled()

  const bodyResult = unionExtrusion ? csgSubtract(baseMesh, unionExtrusion) : baseMesh

  if (checkCancelled) await checkCancelled()

  const group = new Group()
  bodyResult.name = 'body'
  group.add(bodyResult)

  for (let j = 0; j < textMeshes.length; j++) {
    if (checkCancelled) await checkCancelled()
    const tr = textMeshes[j]
    const r = csgIntersect(baseMesh, tr.mesh)
    r.material = tr.mesh.material
    r.name = tr.name || `text_${j}`
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
