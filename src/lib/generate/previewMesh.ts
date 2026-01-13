import { BufferAttribute, BufferGeometry, Group, Mesh } from 'three'
import { createKeycapMaterial } from './materials'

export type PreviewMeshPayload = {
  name: string
  color: number
  position: Float32Array
  normal?: Float32Array
  index?: Uint16Array | Uint32Array
}

function getMeshColor(mesh: Mesh): number {
  const mat: any = mesh.material
  const hex = mat?.color?.getHex?.()
  return typeof hex === 'number' ? hex : 0xffffff
}

export function serializeGroupToPreviewMeshes(group: Group): {
  meshes: PreviewMeshPayload[]
  transfers: Transferable[]
} {
  const meshes: PreviewMeshPayload[] = []
  const transfers: Transferable[] = []

  group.traverse(obj => {
    if (!(obj instanceof Mesh)) return
    const geom = obj.geometry as BufferGeometry
    const posAttr = geom.getAttribute('position') as BufferAttribute | null
    if (!posAttr) return

    const position = new Float32Array((posAttr.array as Float32Array).slice(0))
    transfers.push(position.buffer)

    const normalAttr = geom.getAttribute('normal') as BufferAttribute | null
    const normal = normalAttr ? new Float32Array((normalAttr.array as Float32Array).slice(0)) : undefined
    if (normal) transfers.push(normal.buffer)

    const idxAttr = geom.getIndex()
    let index: Uint16Array | Uint32Array | undefined
    if (idxAttr?.array) {
      const arr = idxAttr.array as Uint16Array | Uint32Array
      index = arr instanceof Uint32Array ? new Uint32Array(arr.slice(0)) : new Uint16Array(arr.slice(0))
      transfers.push(index.buffer)
    }

    meshes.push({
      name: obj.name || '',
      color: getMeshColor(obj),
      position,
      normal,
      index,
    })
  })

  return { meshes, transfers }
}

export function groupFromPreviewMeshes(meshes: PreviewMeshPayload[]): Group {
  const group = new Group()

  for (const m of meshes) {
    const geom = new BufferGeometry()
    geom.setAttribute('position', new BufferAttribute(m.position, 3))
    if (m.normal) geom.setAttribute('normal', new BufferAttribute(m.normal, 3))
    if (m.index) geom.setIndex(new BufferAttribute(m.index, 1))
    geom.computeBoundingBox()

    const mesh = new Mesh(geom, createKeycapMaterial(m.color))
    mesh.name = m.name
    mesh.updateMatrix()
    mesh.matrixAutoUpdate = false
    group.add(mesh)
  }

  return group
}
