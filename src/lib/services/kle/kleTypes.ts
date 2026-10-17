export type KleKey = {
  id: string
  labels: string[] // 12 standard positions
  textColor: Array<string | undefined>
  x: number
  y: number
  width: number
  height: number
  x2: number
  y2: number
  width2: number
  height2: number
  rotation_x: number
  rotation_y: number
  rotation_angle: number
  profile: string
}

export type KleKeyboardMetadata = {
  name: string
}

export type KleKeyboard = {
  meta: KleKeyboardMetadata
  keys: KleKey[]
}

export type LayoutBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
}
