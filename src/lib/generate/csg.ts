import * as THREE from 'three'
import * as CSG from 'three-csg-ts'

export function makeMesh(geometry: THREE.BufferGeometry, color = 0xcccccc): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }))
  mesh.updateMatrix()
  mesh.matrixAutoUpdate = false
  return mesh
}

export function csgIntersect(meshA: THREE.Mesh, meshB: THREE.Mesh): THREE.Mesh {
  const a = CSG.CSG.fromMesh(meshA)
  const b = CSG.CSG.fromMesh(meshB)
  const r = a.intersect(b)
  return CSG.CSG.toMesh(r, meshA.matrix, meshB.material)
}

export function csgSubtract(meshA: THREE.Mesh, meshB: THREE.Mesh): THREE.Mesh {
  const a = CSG.CSG.fromMesh(meshA)
  const b = CSG.CSG.fromMesh(meshB)
  const r = a.subtract(b)
  return CSG.CSG.toMesh(r, meshA.matrix, meshA.material)
}

export function csgUnionMeshes(meshes: THREE.Mesh[]): THREE.Mesh | null {
  if (!meshes || meshes.length === 0) return null
  let acc = CSG.CSG.fromMesh(meshes[0])
  for (let i = 1; i < meshes.length; i++) {
    const next = CSG.CSG.fromMesh(meshes[i])
    acc = acc.union(next)
  }
  return CSG.CSG.toMesh(acc, meshes[0].matrix, meshes[0].material)
}
