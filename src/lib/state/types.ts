import type { FontName } from '../generate/fonts'
export type { FontName }

export type CustomFont = {
  id: string
  name: string
  fileName: string
  ttfBase64: string
}

export type SymbolDef = {
  id: string
  slotName: string
  x: number
  y: number
  fontName: FontName
  fontSizeMm: number
  color: string
  rotationDeg: number
}

export type SymbolContent = { kind: 'text'; value: string } | { kind: 'icon'; iconName: string }

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
  rotationX: number
  rotationY: number
  rotationZ: number
  extrusionDepthMm: number
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
  contentBySymbolId: Record<string, SymbolContent>
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
  customFonts: CustomFont[]
  ui: AppUiState
}
