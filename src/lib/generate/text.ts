import { BufferGeometry, MathUtils } from 'three'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { KeyDef, Template } from '../state/types'
import { getFont } from './fonts'

export function buildKeyTextGeometry(opts: {
  key: KeyDef
  template: Template
  extrusionDepthMm: number
  faceMinX: number
  faceMaxX: number
  faceMinY: number
  faceMaxY: number
}): BufferGeometry | null {
  const geoms: BufferGeometry[] = []

  const width = opts.faceMaxX - opts.faceMinX
  const height = opts.faceMaxY - opts.faceMinY

  for (const sym of opts.template.symbols) {
    const text = (opts.key.textsBySymbolId[sym.id] ?? '').trim()
    if (!text) continue

    const font = getFont(sym.fontFamily, sym.fontWeight)
    const g = new TextGeometry(text, {
      font,
      size: sym.fontSizeMm,
      depth: opts.extrusionDepthMm,
      curveSegments: 8,
      bevelEnabled: false,
    })

    g.computeBoundingBox()
    const bb = g.boundingBox!

    const dx = -(bb.min.x + bb.max.x) / 2
    const dy = -(bb.min.y + bb.max.y) / 2

    g.translate(dx, dy, 0)

    const tx = opts.faceMinX + sym.x * width
    const ty = opts.faceMaxY - sym.y * height

    const rz = MathUtils.degToRad(sym.rotationDeg)
    if (rz !== 0) g.rotateZ(rz)
    g.translate(tx, ty, 0)

    geoms.push(g)
  }

  if (geoms.length === 0) return null
  return mergeGeometries(geoms, false)
}


