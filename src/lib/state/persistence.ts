import { get } from 'svelte/store'
import { app } from './store'
import type { AppState } from './types'
import { stlArrayBuffer } from './sessionAssets'

function sanitizeForExport(state: AppState): AppState {
  // Never embed STL bytes in the project file. Only keep the persisted reference.
  if (!state.stl) return state
  return { ...state, stl: { fileName: state.stl.fileName, pathHint: state.stl.pathHint } }
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
  const raw = JSON.parse(text) as any

  if (!raw || raw.version !== 1 || !Array.isArray(raw.templates) || !Array.isArray(raw.keys)) {
    window.alert('Invalid project file.')
    return
  }

  const parsed: AppState = {
    version: 1,
    templates: raw.templates,
    keys: raw.keys,
    stl:
      raw.stl && typeof raw.stl.fileName === 'string'
        ? { fileName: raw.stl.fileName, pathHint: typeof raw.stl.pathHint === 'string' ? raw.stl.pathHint : '' }
        : null,
    settings: { extrusionDepthMm: Number(raw.settings?.extrusionDepthMm ?? 0.8) },
    ui: {
      selectedTemplateId: raw.ui?.selectedTemplateId ?? null,
      selectedKeyId: raw.ui?.selectedKeyId ?? null,
    },
  }

  // Loaded projects only contain the STL reference; require re-upload for generation.
  stlArrayBuffer.set(null)
  app.set(parsed)
}

export function exportState(): AppState {
  return sanitizeForExport(get(app))
}


