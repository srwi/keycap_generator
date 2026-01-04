import type { BufferGeometry } from 'three'
import * as THREE from 'three'
import { zipSync, strToU8 } from 'fflate'

function escapeName(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function geometryToMeshXml(geometry: BufferGeometry): string {
  const g = geometry.clone()
  g.computeBoundingBox()

  const nonIndexed = g.index ? g.toNonIndexed() : g
  const pos = nonIndexed.getAttribute('position')
  const vCount = pos.count
  const triCount = Math.floor(vCount / 3)

  let vertices = ''
  for (let i = 0; i < vCount; i++) {
    const x = pos.getX(i).toFixed(6)
    const y = pos.getY(i).toFixed(6)
    const z = pos.getZ(i).toFixed(6)
    vertices += `<vertex x="${x}" y="${y}" z="${z}"/>`
  }

  let triangles = ''
  for (let t = 0; t < triCount; t++) {
    const v1 = 3 * t
    const v2 = 3 * t + 1
    const v3 = 3 * t + 2
    triangles += `<triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`
  }

  return `<mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh>`
}

export async function exportTo3MF(group: THREE.Group, options?: { printer_name?: string }): Promise<Blob> {
  const resources: string[] = []
  const buildItems: string[] = []
  let objectId = 1

  group.traverse(child => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry.clone()

      if (child.matrix) {
        geometry.applyMatrix4(child.matrix)
      }

      const name = child.name || `object_${objectId}`
      const meshXml = geometryToMeshXml(geometry)
      resources.push(
        `<object id="${objectId}" type="model"><metadata name="name">${escapeName(name)}</metadata>${meshXml}</object>`
      )
      buildItems.push(`<item objectid="${objectId}"/>`)
      objectId++
    }
  })

  const modelXml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
    `<metadata name="printer_name">${options?.printer_name || 'Unknown'}</metadata>` +
    `<resources>${resources.join('')}</resources>` +
    `<build>${buildItems.join('')}</build>` +
    `</model>`

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>` +
    `</Types>`

  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model"/>` +
    `</Relationships>`

  const zipBytes = zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    '3D/3dmodel.model': strToU8(modelXml),
  })

  return new Blob([new Uint8Array(zipBytes)], { type: 'model/3mf' })
}
