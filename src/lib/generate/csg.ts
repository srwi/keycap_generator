import { BufferGeometry } from 'three'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'

export function subtractGeometry(a: BufferGeometry, b: BufferGeometry): BufferGeometry {
  const evaluator = new Evaluator()
  evaluator.useGroups = false

  const brushA = new Brush(a)
  brushA.updateMatrixWorld()

  const brushB = new Brush(b)
  brushB.updateMatrixWorld()

  const result = evaluator.evaluate(brushA, brushB, SUBTRACTION)
  const out = (result.geometry as BufferGeometry).clone()
  out.computeVertexNormals()
  out.computeBoundingBox()
  return out
}


