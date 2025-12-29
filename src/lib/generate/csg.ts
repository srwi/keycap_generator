import * as THREE from 'three'
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg'

export function makeMesh(geometry: THREE.BufferGeometry, color = 0xcccccc): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }))
  mesh.updateMatrix()
  mesh.matrixAutoUpdate = false
  return mesh
}

export function csgIntersect(meshA: THREE.Mesh, meshB: THREE.Mesh): THREE.Mesh {
  const evaluator = new Evaluator()
  evaluator.attributes = ['position']
  evaluator.useGroups = false

  const brushA = new Brush(meshA.geometry as THREE.BufferGeometry)
  brushA.matrix.copy(meshA.matrix)
  brushA.prepareGeometry()
  brushA.updateMatrixWorld()

  const brushB = new Brush(meshB.geometry as THREE.BufferGeometry)
  brushB.matrix.copy(meshB.matrix)
  brushB.prepareGeometry()
  brushB.updateMatrixWorld()

  const result = evaluator.evaluate(brushA, brushB, INTERSECTION)
  const out = (result.geometry as THREE.BufferGeometry).clone()
  out.computeVertexNormals()
  out.computeBoundingBox()

  const resultMesh = new THREE.Mesh(out, meshB.material)
  resultMesh.updateMatrix()
  resultMesh.matrixAutoUpdate = false
  return resultMesh
}

export function csgSubtract(meshA: THREE.Mesh, meshB: THREE.Mesh): THREE.Mesh {
  const evaluator = new Evaluator()
  evaluator.attributes = ['position']
  evaluator.useGroups = false

  const brushA = new Brush(meshA.geometry as THREE.BufferGeometry)
  brushA.matrix.copy(meshA.matrix)
  brushA.prepareGeometry()
  brushA.updateMatrixWorld()

  const brushB = new Brush(meshB.geometry as THREE.BufferGeometry)
  brushB.matrix.copy(meshB.matrix)
  brushB.prepareGeometry()
  brushB.updateMatrixWorld()

  const result = evaluator.evaluate(brushA, brushB, SUBTRACTION)
  const out = (result.geometry as THREE.BufferGeometry).clone()
  out.computeVertexNormals()
  out.computeBoundingBox()

  const resultMesh = new THREE.Mesh(out, meshA.material)
  resultMesh.updateMatrix()
  resultMesh.matrixAutoUpdate = false
  return resultMesh
}

export function csgUnionMeshes(meshes: THREE.Mesh[]): THREE.Mesh | null {
  if (!meshes || meshes.length === 0) return null

  const evaluator = new Evaluator()
  evaluator.attributes = ['position']
  evaluator.useGroups = false

  let resultBrush = new Brush(meshes[0].geometry as THREE.BufferGeometry)
  resultBrush.matrix.copy(meshes[0].matrix)
  resultBrush.prepareGeometry()
  resultBrush.updateMatrixWorld()

  for (let i = 1; i < meshes.length; i++) {
    const nextBrush = new Brush(meshes[i].geometry as THREE.BufferGeometry)
    nextBrush.matrix.copy(meshes[i].matrix)
    nextBrush.prepareGeometry()
    nextBrush.updateMatrixWorld()
    const result = evaluator.evaluate(resultBrush, nextBrush, ADDITION)
    resultBrush = new Brush(result.geometry as THREE.BufferGeometry)
    resultBrush.prepareGeometry()
    resultBrush.updateMatrixWorld()
  }

  const out = (resultBrush.geometry as THREE.BufferGeometry).clone()
  out.computeVertexNormals()
  out.computeBoundingBox()

  const resultMesh = new THREE.Mesh(out, meshes[0].material)
  resultMesh.updateMatrix()
  resultMesh.matrixAutoUpdate = false
  return resultMesh
}
