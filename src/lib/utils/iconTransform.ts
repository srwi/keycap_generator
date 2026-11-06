import type { IconRotationDeg, IconTransform, SymbolContent } from '../state/types'

export const ICON_ROTATIONS: IconRotationDeg[] = [0, 90, 180, 270]

export const IDENTITY_ICON_TRANSFORM: IconTransform = {
  rotationDeg: 0,
  flipAcrossX: false,
  flipAcrossY: false,
}

function normalizeRotationDeg(value: unknown): IconRotationDeg {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const wrapped = (((Math.round(value / 90) * 90) % 360) + 360) % 360
  return wrapped as IconRotationDeg
}

// Reads the stored icon transform, filling in defaults for projects saved before it existed.
export function getIconTransform(content: SymbolContent | null | undefined): IconTransform {
  if (!content || content.kind !== 'icon') return IDENTITY_ICON_TRANSFORM
  return {
    rotationDeg: normalizeRotationDeg(content.rotationDeg),
    flipAcrossX: content.flipAcrossX === true,
    flipAcrossY: content.flipAcrossY === true,
  }
}

export function isIdentityIconTransform(transform: IconTransform): boolean {
  return transform.rotationDeg === 0 && !transform.flipAcrossX && !transform.flipAcrossY
}

// Mirroring across the Y axis swaps left and right, mirroring across the X axis swaps top and bottom.
export function iconFlipScale(transform: IconTransform): { x: number; y: number } {
  return {
    x: transform.flipAcrossY ? -1 : 1,
    y: transform.flipAcrossX ? -1 : 1,
  }
}
