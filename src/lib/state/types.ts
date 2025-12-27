export type FontFamily = 'helvetiker'
export type FontWeight = 'regular' | 'bold'

export const U_MM = 19.05

export type SymbolDef = {
  id: string
  slotName: string
  x: number // in u (left..right)
  y: number // in u (top..bottom)
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
  widthU: number
  heightU: number
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


