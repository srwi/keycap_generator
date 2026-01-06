import * as THREE from 'three'

export const KEYCAP_BODY_COLOR = 0x64748b // slate-500
export const KEYCAP_MATERIAL_METALNESS = 0.2
export const KEYCAP_MATERIAL_ROUGHNESS = 0.6

export function createKeycapMaterial(color: number = KEYCAP_BODY_COLOR): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: KEYCAP_MATERIAL_METALNESS,
    roughness: KEYCAP_MATERIAL_ROUGHNESS,
  })
}
