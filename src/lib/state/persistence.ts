import { app } from './store'
import { stlBuffersByModelId } from './sessionAssets'
import type { AppState, KeyDef, KeycapModel, Template, CustomFont } from './types'
import { getPublicPath } from '../utils/paths'

export function applyLoadedProject(project: AppState) {
  stlBuffersByModelId.set({})
  app.set(project)
}

function normalizeModelUrls(keycapModels: KeycapModel[]): KeycapModel[] {
  return keycapModels.map(m => {
    if (m.source.kind === 'server' && m.source.url.startsWith('/')) {
      const pathWithoutLeadingSlash = m.source.url.slice(1)
      return {
        ...m,
        source: {
          ...m.source,
          url: getPublicPath(pathWithoutLeadingSlash),
        },
      }
    }
    return m
  })
}

function prepareForExport(state: AppState): Omit<AppState, 'ui'> {
  // UI state is runtime-only and not exported.
  const { ui, ...rest } = state
  return {
    ...rest,
    keycapModels: state.keycapModels.map(m => {
      if (m.source.kind === 'upload') {
        return { ...m, source: { ...m.source, stl: m.source.stl ? { ...m.source.stl } : null } }
      }
      return { ...m, source: { ...m.source, stl: { ...m.source.stl } } }
    }),
  }
}

type RawProjectV1 = {
  version: 1
  keycapModels: KeycapModel[]
  templates: Template[]
  keys: KeyDef[]
  customFonts: CustomFont[]
}

function parseProjectV1(raw: unknown): AppState | null {
  if (typeof raw !== 'object' || raw === null) return null

  const project = raw as RawProjectV1

  if (project.version !== 1) return null
  if (!Array.isArray(project.keycapModels) || !Array.isArray(project.templates) || !Array.isArray(project.keys))
    return null
  if (!Array.isArray(project.customFonts)) return null

  // Normalize URLs in keycap models to handle preset files
  const normalizedModels = normalizeModelUrls(project.keycapModels)

  return {
    version: 1,
    keycapModels: normalizedModels,
    templates: project.templates,
    keys: project.keys,
    customFonts: project.customFonts,
    ui: {
      selectedKeycapModelId: normalizedModels[0]?.id ?? null,
      selectedTemplateId: project.templates[0]?.id ?? null,
      selectedKeyId: project.keys[0]?.id ?? null,
    },
  }
}

export function downloadStateFile(state: AppState) {
  const prepared = prepareForExport(state)
  const json = JSON.stringify(prepared, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = 'keycap-generator-project.json'
  a.click()

  setTimeout(() => URL.revokeObjectURL(url), 500)
}

function parseProjectJsonText(jsonText: string): AppState | null {
  try {
    return parseProjectV1(JSON.parse(jsonText) as unknown)
  } catch {
    return null
  }
}

export type ProjectReadResult = { project: AppState } | { error: string }

export async function readProjectFromFile(ev: Event): Promise<ProjectReadResult | null> {
  const input = ev.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return null

  try {
    const text = await file.text()
    const parsed = parseProjectJsonText(text)
    if (!parsed) return { error: 'Invalid project file.' }
    return { project: parsed }
  } catch (error) {
    return { error: `Failed to read project file: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

export async function readPresetProject(presetName: string): Promise<ProjectReadResult> {
  try {
    const response = await fetch(getPublicPath(`presets/${presetName}.json`))
    if (!response.ok) {
      return { error: `Failed to load preset: ${response.statusText}` }
    }

    const text = await response.text()
    const parsed = parseProjectJsonText(text)
    if (!parsed) return { error: 'Invalid preset file.' }
    return { project: parsed }
  } catch (error) {
    return { error: `Failed to load preset: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}
