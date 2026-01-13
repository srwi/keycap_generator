import { BufferGeometry, Shape, ShapeGeometry, ExtrudeGeometry, Path, Matrix4 } from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'

const svgLoader = new SVGLoader()

export function svgPathToShapes(pathData: string, viewBox: number): Shape[] {
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

export function createIconGeometry(
  pathData: string,
  sizeMm: number,
  extrusionDepth: number,
  viewBox: number
): BufferGeometry {
  const shapes = svgPathToShapes(pathData, viewBox)

  if (shapes.length === 0) {
    return new BufferGeometry()
  }

  const scale = sizeMm / viewBox

  const geometry = new ExtrudeGeometry(shapes, {
    depth: extrusionDepth,
    bevelEnabled: false,
    curveSegments: 3,
  })

  geometry.applyMatrix4(new Matrix4().makeScale(-scale, -scale, 1))

  geometry.computeBoundingBox()
  if (geometry.boundingBox) {
    const centerX = (geometry.boundingBox.max.x + geometry.boundingBox.min.x) / 2
    const centerY = (geometry.boundingBox.max.y + geometry.boundingBox.min.y) / 2
    geometry.translate(-centerX, -centerY, 0)
  }

  geometry.computeVertexNormals()

  return geometry
}

export function createIconShapeGeometry(pathData: string, sizeMm: number, viewBox: number): BufferGeometry {
  const shapes = svgPathToShapes(pathData, viewBox)

  if (shapes.length === 0) {
    return new BufferGeometry()
  }

  const scale = sizeMm / viewBox

  const geometry = new ShapeGeometry(shapes)
  geometry.scale(scale, -scale, 1)

  geometry.computeBoundingBox()
  if (geometry.boundingBox) {
    const centerX = (geometry.boundingBox.max.x + geometry.boundingBox.min.x) / 2
    const centerY = (geometry.boundingBox.max.y + geometry.boundingBox.min.y) / 2
    geometry.translate(-centerX, -centerY, 0)
  }

  return geometry
}
