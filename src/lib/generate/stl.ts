import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { BufferGeometry } from 'three'

export async function parseSTL(arrayBuffer: ArrayBuffer): Promise<BufferGeometry> {
  const loader = new STLLoader()
  const geometry = loader.parse(arrayBuffer)
  const geom = geometry as BufferGeometry
  geom.computeVertexNormals()
  return geom
}

export function centerGeometryXY(geometry: BufferGeometry): void {
  geometry.computeBoundingBox()
  const bb = geometry.boundingBox!
  const centerX = (bb.max.x + bb.min.x) / 2
  const centerY = (bb.max.y + bb.min.y) / 2
  geometry.translate(-centerX, -centerY, 0)
}

export function alignBottomTo(geometry: BufferGeometry, targetZ = 0): void {
  geometry.computeBoundingBox()
  const minZ = geometry.boundingBox!.min.z
  geometry.translate(0, 0, targetZ - minZ)
}
