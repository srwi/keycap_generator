import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { BufferGeometry, Vector3 } from 'three'

export function parseStl(arrayBuffer: ArrayBuffer): BufferGeometry {
  const loader = new STLLoader()
  const geom = loader.parse(arrayBuffer)
  geom.computeVertexNormals()
  geom.computeBoundingBox()
  return geom
}

export function alignMinZToZero(geom: BufferGeometry): { geometry: BufferGeometry; min: Vector3; max: Vector3 } {
  const g = geom.clone()
  g.computeBoundingBox()
  const bb = g.boundingBox
  if (!bb) throw new Error('No bounding box')
  g.translate(0, 0, -bb.min.z)
  g.computeBoundingBox()
  const bb2 = g.boundingBox!
  return { geometry: g, min: bb2.min.clone(), max: bb2.max.clone() }
}


