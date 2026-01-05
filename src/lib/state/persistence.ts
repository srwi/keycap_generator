import { app } from './store'
import type { AppState, KeyDef, KeycapModel, Template } from './types'
import { stlBuffersByModelId } from './sessionAssets'

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
}

function parseProjectV1(raw: unknown): AppState | null {
  if (typeof raw !== 'object' || raw === null) return null

  const project = raw as RawProjectV1

  if (project.version !== 1) return null
  if (!Array.isArray(project.keycapModels) || !Array.isArray(project.templates) || !Array.isArray(project.keys))
    return null

  return {
    version: 1,
    keycapModels: project.keycapModels,
    templates: project.templates,
    keys: project.keys,
    ui: {
      selectedKeycapModelId: project.keycapModels[0]?.id ?? null,
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

async function loadStateFromJson(jsonText: string, errorContext: string): Promise<string | null> {
  const parsed = parseProjectV1(JSON.parse(jsonText) as unknown)
  if (!parsed) {
    return `Invalid ${errorContext}.`
  }

  stlBuffersByModelId.set({})
  app.set(parsed)
  return null
}

export async function loadStateFromFile(ev: Event): Promise<string | null> {
  const input = ev.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return null

  const text = await file.text()
  return await loadStateFromJson(text, 'project file')
}

export async function loadPreset(presetName: string): Promise<string | null> {
  try {
    const response = await fetch(`/presets/${presetName}.json`)
    if (!response.ok) {
      return `Failed to load preset: ${response.statusText}`
    }

    const text = await response.text()
    return await loadStateFromJson(text, 'preset file')
  } catch (error) {
    return `Failed to load preset: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}
