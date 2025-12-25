export type FontFamily = 'helvetiker'
export type FontWeight = 'regular' | 'bold'

export type SymbolDef = {
  id: string
  slotName: string
  x: number // 0..1 (left..right)
  y: number // 0..1 (top..bottom)
  fontFamily: FontFamily
  fontWeight: FontWeight
  fontSizeMm: number
  color: string // hex
  rotationDeg: number
}

export type Template = {
  id: string
  name: string
  symbols: SymbolDef[]
}

export type KeyDef = {
  id: string
  name: string
  templateId: string
  textsBySymbolId: Record<string, string>
}

export type StlAsset = {
  fileName: string
  pathHint: string
} | null

export type AppSettings = {
  extrusionDepthMm: number
}

export type AppUiState = {
  selectedTemplateId: string | null
  selectedKeyId: string | null
}

export type AppState = {
  version: 1
  templates: Template[]
  keys: KeyDef[]
  stl: StlAsset
  settings: AppSettings
  ui: AppUiState
}


