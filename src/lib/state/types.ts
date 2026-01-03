export type FontFamily = 'roboto' | 'notoserif'
export type FontWeight = 'regular' | 'bold'

// Standard keycap unit size in millimeters (1u = 19.05mm)
export const DEFAULT_KEYCAP_SIZE_MM = 19.05

export type SymbolDef = {
  id: string
  slotName: string
  x: number // mm offset from center (left is negative, right is positive)
  y: number // mm offset from center (top is negative, bottom is positive)
  fontFamily: FontFamily
  fontWeight: FontWeight
  fontSizeMm: number
  color: string // hex
  rotationDeg: number
}

export type StlRef = {
  fileName: string
  pathHint: string
}

export type KeycapModelSource =
  | { kind: 'upload'; stl: StlRef | null }
  | { kind: 'server'; serverId: string; url: string; stl: StlRef }

export type KeycapModel = {
  id: string
  name: string
  widthMm: number
  heightMm: number
  source: KeycapModelSource
}

export type Template = {
  id: string
  name: string
  keycapModelId: string
  symbols: SymbolDef[]
}

export type KeyDef = {
  id: string
  name: string
  templateId: string
  textsBySymbolId: Record<string, string>
}

export type AppSettings = {
  extrusionDepthMm: number
}

export type AppUiState = {
  selectedKeycapModelId: string | null
  selectedTemplateId: string | null
  selectedKeyId: string | null
}

export type AppState = {
  version: 1
  keycapModels: KeycapModel[]
  templates: Template[]
  keys: KeyDef[]
  settings: AppSettings
  ui: AppUiState
}
