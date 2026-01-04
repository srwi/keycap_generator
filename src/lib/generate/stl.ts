import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { BufferGeometry } from 'three'
import { MathUtils } from 'three'

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

export function applyRotation(geometry: BufferGeometry, rotationX: number, rotationY: number, rotationZ: number): void {
  if (rotationX !== 0 || rotationY !== 0 || rotationZ !== 0) {
    const rx = MathUtils.degToRad(rotationX)
    const ry = MathUtils.degToRad(rotationY)
    const rz = MathUtils.degToRad(rotationZ)
    if (rx !== 0) geometry.rotateX(rx)
    if (ry !== 0) geometry.rotateY(ry)
    if (rz !== 0) geometry.rotateZ(rz)
  }
}

export async function processStlForModel(
  arrayBuffer: ArrayBuffer,
  rotationX: number,
  rotationY: number,
  rotationZ: number
): Promise<BufferGeometry> {
  const geometry = await parseSTL(arrayBuffer)

  applyRotation(geometry, rotationX, rotationY, rotationZ)
  centerGeometryXY(geometry)
  alignBottomTo(geometry, 0)

  geometry.computeBoundingBox()

  return geometry
}

export async function getStlDimensions(arrayBuffer: ArrayBuffer): Promise<{ widthMm: number; heightMm: number }> {
  const geometry = await parseSTL(arrayBuffer)
  geometry.computeBoundingBox()
  const bb = geometry.boundingBox!
  const widthMm = bb.max.x - bb.min.x
  const heightMm = bb.max.y - bb.min.y
  return { widthMm, heightMm }
}
