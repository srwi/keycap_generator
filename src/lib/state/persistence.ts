import { get } from 'svelte/store'
import { app } from './store'
import type { AppState } from './types'
import { stlBuffersByModelId } from './sessionAssets'

function sanitizeForExport(state: AppState): AppState {
  // Never embed STL bytes in the project file. Only keep refs on models.
  return {
    ...state,
    keycapModels: state.keycapModels.map(m => {
      if (m.source.kind === 'upload') {
        return { ...m, source: { ...m.source, stl: m.source.stl ? { ...m.source.stl } : null } }
      }
      return { ...m, source: { ...m.source, stl: { ...m.source.stl } } }
    }),
  }
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function asNumber(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function parseProjectV1(raw: unknown): AppState | null {
  if (!isRecord(raw)) return null
  if (raw.version !== 1) return null
  if (!Array.isArray((raw as any).keycapModels) || !Array.isArray(raw.templates) || !Array.isArray(raw.keys))
    return null

  const settingsRaw = isRecord(raw.settings) ? raw.settings : null
  const uiRaw = isRecord(raw.ui) ? raw.ui : null

  // Note: templates/keys are kept as-is (already app-internal shape) but we still
  // guard the outer envelope so project loading is predictable.
  return {
    version: 1,
    keycapModels: (raw as any).keycapModels as AppState['keycapModels'],
    templates: raw.templates as AppState['templates'],
    keys: raw.keys as AppState['keys'],
    settings: { extrusionDepthMm: asNumber(settingsRaw?.extrusionDepthMm, 0.8) },
    ui: {
      selectedKeycapModelId:
        typeof (uiRaw as any)?.selectedKeycapModelId === 'string' ? (uiRaw as any).selectedKeycapModelId : null,
      selectedTemplateId: typeof uiRaw?.selectedTemplateId === 'string' ? uiRaw.selectedTemplateId : null,
      selectedKeyId: typeof uiRaw?.selectedKeyId === 'string' ? uiRaw.selectedKeyId : null,
    },
  }
}

export function downloadStateFile(state: AppState) {
  const safe = sanitizeForExport(state)
  const json = JSON.stringify(safe, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = 'keycap-generator.project.json'
  a.click()

  setTimeout(() => URL.revokeObjectURL(url), 500)
}

export async function loadStateFromFile(ev: Event) {
  const input = ev.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const text = await file.text()
  const parsed = parseProjectV1(JSON.parse(text) as unknown)
  if (!parsed) {
    window.alert('Invalid project file.')
    return
  }

  // Loaded projects only contain STL references; require re-upload / server fetch for generation.
  stlBuffersByModelId.set({})
  app.set(parsed)
}

export function exportState(): AppState {
  return sanitizeForExport(get(app))
}
