import { BufferGeometry, MathUtils, Shape, Matrix4 } from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { extrudePolygonsToGeometry } from './csg'
import type { IconTransform } from '../state/types'
import { iconFlipScale, IDENTITY_ICON_TRANSFORM } from '../utils/iconTransform'

const svgLoader = new SVGLoader()

function svgPathToShapes(pathData: string, viewBox: number): Shape[] {
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox} ${viewBox}">
    <path d="${pathData}" />
  </svg>`

  const data = svgLoader.parse(svgString)
  const shapes: Shape[] = []

  for (const path of data.paths) {
    const pathShapes = SVGLoader.createShapes(path)
    shapes.push(...pathShapes)
  }

  return shapes
}

function signedArea(points: Array<[number, number]>): number {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    area += x1 * y2 - x2 * y1
  }
  return area * 0.5
}

function removeClosingDuplicate(points: Array<[number, number]>): Array<[number, number]> {
  if (points.length < 2) return points
  const [sx, sy] = points[0]
  const [ex, ey] = points[points.length - 1]
  if (sx === ex && sy === ey) return points.slice(0, -1)
  return points
}

function toContour(points: { x: number; y: number }[]): Array<[number, number]> {
  const contour = removeClosingDuplicate(points.map(p => [p.x, p.y]))
  if (contour.length < 3) return []
  return contour
}

function orientContour(contour: Array<[number, number]>, ccw: boolean): Array<[number, number]> {
  const isCcw = signedArea(contour) > 0
  if (isCcw === ccw) return contour
  return [...contour].reverse()
}

function shapesToPolygons(shapes: Shape[], curveSegments = 24): Array<Array<[number, number]>> {
  const polygons: Array<Array<[number, number]>> = []

  for (const shape of shapes) {
    const outer = toContour(shape.getPoints(curveSegments))
    if (outer.length >= 3) {
      polygons.push(orientContour(outer, true))
    }

    for (const hole of shape.holes) {
      const holeContour = toContour(hole.getPoints(curveSegments))
      if (holeContour.length >= 3) {
        polygons.push(orientContour(holeContour, false))
      }
    }
  }

  return polygons
}

// Restores outward-facing triangles after a mirroring matrix inverted them.
function reverseTriangleWinding(geometry: BufferGeometry): void {
  const index = geometry.getIndex()
  if (index) {
    for (let i = 0; i + 2 < index.count; i += 3) {
      const first = index.getX(i)
      index.setX(i, index.getX(i + 2))
      index.setX(i + 2, first)
    }
    index.needsUpdate = true
    return
  }

  const position = geometry.getAttribute('position')
  for (let i = 0; i + 2 < position.count; i += 3) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    position.setXYZ(i, position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2))
    position.setXYZ(i + 2, x, y, z)
  }
  position.needsUpdate = true
}

export async function createIconGeometry(
  pathData: string,
  sizeMm: number,
  extrusionDepth: number,
  viewBox: number,
  transform: IconTransform = IDENTITY_ICON_TRANSFORM
): Promise<BufferGeometry> {
  const shapes = svgPathToShapes(pathData, viewBox)

  if (shapes.length === 0) {
    return new BufferGeometry()
  }

  const polygons = shapesToPolygons(shapes, 24)
  if (polygons.length === 0) {
    return new BufferGeometry()
  }

  const geometry = await extrudePolygonsToGeometry(polygons, extrusionDepth)
  const scale = sizeMm / viewBox
  geometry.applyMatrix4(new Matrix4().makeScale(-scale, -scale, 1))

  const flip = iconFlipScale(transform)
  if (flip.x !== 1 || flip.y !== 1) {
    geometry.applyMatrix4(new Matrix4().makeScale(flip.x, flip.y, 1))
    if (flip.x * flip.y < 0) reverseTriangleWinding(geometry)
  }
  if (transform.rotationDeg !== 0) {
    geometry.rotateZ(MathUtils.degToRad(transform.rotationDeg))
  }

  geometry.computeBoundingBox()
  if (geometry.boundingBox) {
    const centerX = (geometry.boundingBox.max.x + geometry.boundingBox.min.x) / 2
    const centerY = (geometry.boundingBox.max.y + geometry.boundingBox.min.y) / 2
    geometry.translate(-centerX, -centerY, 0)
  }
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  return geometry
}
