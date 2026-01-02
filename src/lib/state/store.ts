import { derived, writable } from 'svelte/store'
import type { AppState, KeyDef, KeycapModel, SymbolDef, Template } from './types'
import { newId } from '../utils/id'

export const SLOT_NAMES = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa']
export const SLOT_SYMBOLS = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ']

export function getSlotName(index: number): string {
  return SLOT_NAMES[index] ?? `slot${index + 1}`
}

export function getSlotSymbol(index: number): string {
  return SLOT_SYMBOLS[index] ?? String(index + 1)
}

function defaultSymbol(x?: number, y?: number): SymbolDef {
  return {
    id: newId('sym'),
    slotName: '',
    x: x ?? 0.5,
    y: y ?? 0.5,
    fontFamily: 'helvetiker',
    fontWeight: 'regular',
    fontSizeMm: 4,
    color: '#ffffff',
    rotationDeg: 0,
  }
}

function defaultKeycapModel(): KeycapModel {
  return {
    id: newId('model'),
    name: '1u',
    widthU: 1,
    heightU: 1,
    source: { kind: 'upload', stl: null },
  }
}

function defaultTemplate(keycapModelId: string): Template {
  return {
    id: newId('tpl'),
    name: 'Regular key',
    keycapModelId,
    symbols: [defaultSymbol()],
  }
}

function defaultState(): AppState {
  const model = defaultKeycapModel()
  const tpl = defaultTemplate(model.id)
  const key: KeyDef = {
    id: newId('key'),
    name: 'Key 1',
    templateId: tpl.id,
    textsBySymbolId: { [tpl.symbols[0].id]: '' },
  }

  return {
    version: 1,
    keycapModels: [model],
    templates: [tpl],
    keys: [key],
    settings: {
      extrusionDepthMm: 0.8,
    },
    ui: {
      selectedKeycapModelId: model.id,
      selectedTemplateId: tpl.id,
      selectedKeyId: key.id,
    },
  }
}

export const app = writable<AppState>(defaultState())

export const selectedTemplate = derived(
  app,
  $app => $app.templates.find(t => t.id === $app.ui.selectedTemplateId) ?? null
)

export const selectedKey = derived(app, $app => $app.keys.find(k => k.id === $app.ui.selectedKeyId) ?? null)

export const actions = {
  selectKeycapModel(modelId: string | null) {
    app.update(s => ({ ...s, ui: { ...s.ui, selectedKeycapModelId: modelId } }))
  },

  selectTemplate(templateId: string | null) {
    app.update(s => ({ ...s, ui: { ...s.ui, selectedTemplateId: templateId } }))
  },

  selectKey(keyId: string | null) {
    app.update(s => ({ ...s, ui: { ...s.ui, selectedKeyId: keyId } }))
  },

  createTemplate() {
    app.update(s => {
      const modelId = s.ui.selectedKeycapModelId ?? s.keycapModels[0]?.id
      if (!modelId) return s
      const tpl = defaultTemplate(modelId)
      return {
        ...s,
        templates: [...s.templates, tpl],
        ui: { ...s.ui, selectedTemplateId: tpl.id },
      }
    })
  },

  renameTemplate(templateId: string, name: string) {
    app.update(s => ({
      ...s,
      templates: s.templates.map(t => (t.id === templateId ? { ...t, name } : t)),
    }))
  },

  deleteTemplate(templateId: string) {
    app.update(s => {
      const keysToRemove = s.keys.filter(k => k.templateId === templateId).map(k => k.id)
      const nextTemplates = s.templates.filter(t => t.id !== templateId)
      const nextKeys = s.keys.filter(k => k.templateId !== templateId)

      const nextSelectedTemplateId =
        s.ui.selectedTemplateId === templateId ? (nextTemplates[0]?.id ?? null) : s.ui.selectedTemplateId
      const nextSelectedKeyId = keysToRemove.includes(s.ui.selectedKeyId ?? '')
        ? (nextKeys[0]?.id ?? null)
        : s.ui.selectedKeyId

      return {
        ...s,
        templates: nextTemplates,
        keys: nextKeys,
        ui: {
          ...s.ui,
          selectedTemplateId: nextSelectedTemplateId,
          selectedKeyId: nextSelectedKeyId,
        },
      }
    })
  },

  setTemplateKeycapModel(templateId: string, keycapModelId: string) {
    app.update(s => ({
      ...s,
      templates: s.templates.map(t => (t.id === templateId ? { ...t, keycapModelId } : t)),
    }))
  },

  createKeycapModel() {
    const model = defaultKeycapModel()
    app.update(s => ({
      ...s,
      keycapModels: [...s.keycapModels, model],
      ui: { ...s.ui, selectedKeycapModelId: model.id },
    }))
  },

  renameKeycapModel(modelId: string, name: string) {
    app.update(s => ({
      ...s,
      keycapModels: s.keycapModels.map(m => (m.id === modelId ? { ...m, name } : m)),
    }))
  },

  updateKeycapModel(modelId: string, patch: Partial<Pick<KeycapModel, 'widthU' | 'heightU'>>) {
    app.update(s => ({
      ...s,
      keycapModels: s.keycapModels.map(m => (m.id === modelId ? { ...m, ...patch } : m)),
    }))
  },

  setKeycapModelSource(modelId: string, source: KeycapModel['source']) {
    app.update(s => ({
      ...s,
      keycapModels: s.keycapModels.map(m => (m.id === modelId ? { ...m, source } : m)),
    }))
  },

  deleteKeycapModel(modelId: string) {
    app.update(s => {
      const templatesToRemove = s.templates.filter(t => t.keycapModelId === modelId).map(t => t.id)
      const keysToRemove = s.keys.filter(k => templatesToRemove.includes(k.templateId)).map(k => k.id)

      const nextModels = s.keycapModels.filter(m => m.id !== modelId)
      const nextTemplates = s.templates.filter(t => t.keycapModelId !== modelId)
      const nextKeys = s.keys.filter(k => !templatesToRemove.includes(k.templateId))

      const nextSelectedModelId =
        s.ui.selectedKeycapModelId === modelId ? (nextModels[0]?.id ?? null) : s.ui.selectedKeycapModelId
      const nextSelectedTemplateId = templatesToRemove.includes(s.ui.selectedTemplateId ?? '')
        ? (nextTemplates[0]?.id ?? null)
        : s.ui.selectedTemplateId
      const nextSelectedKeyId = keysToRemove.includes(s.ui.selectedKeyId ?? '')
        ? (nextKeys[0]?.id ?? null)
        : s.ui.selectedKeyId

      return {
        ...s,
        keycapModels: nextModels,
        templates: nextTemplates,
        keys: nextKeys,
        ui: {
          ...s.ui,
          selectedKeycapModelId: nextSelectedModelId,
          selectedTemplateId: nextSelectedTemplateId,
          selectedKeyId: nextSelectedKeyId,
        },
      }
    })
  },

  addSymbol(templateId: string) {
    app.update(s => {
      const tpl = s.templates.find(t => t.id === templateId)
      if (!tpl) return s

      const model = s.keycapModels.find(m => m.id === tpl.keycapModelId)
      const x = model ? model.widthU / 2 : 0.5
      const y = model ? model.heightU / 2 : 0.5
      const sym = defaultSymbol(x, y)

      const nextTemplates = s.templates.map(t => (t.id === templateId ? { ...t, symbols: [...t.symbols, sym] } : t))
      const nextKeys = s.keys.map(k => {
        if (k.templateId !== templateId) return k
        return { ...k, textsBySymbolId: { ...k.textsBySymbolId, [sym.id]: '' } }
      })
      return { ...s, templates: nextTemplates, keys: nextKeys }
    })
  },

  deleteSymbol(templateId: string, symbolId: string) {
    app.update(s => {
      const tpl = s.templates.find(t => t.id === templateId)
      if (!tpl) return s
      if (tpl.symbols.length <= 1) return s

      const nextTemplates = s.templates.map(t =>
        t.id === templateId ? { ...t, symbols: t.symbols.filter(sym => sym.id !== symbolId) } : t
      )
      const nextKeys = s.keys.map(k => {
        if (k.templateId !== templateId) return k
        const { [symbolId]: _, ...rest } = k.textsBySymbolId
        return { ...k, textsBySymbolId: rest }
      })
      return { ...s, templates: nextTemplates, keys: nextKeys }
    })
  },

  updateSymbol(templateId: string, symbolId: string, patch: Partial<SymbolDef>) {
    app.update(s => {
      const { slotName, ...restPatch } = patch
      return {
        ...s,
        templates: s.templates.map(t =>
          t.id === templateId
            ? {
                ...t,
                symbols: t.symbols.map(sym => (sym.id === symbolId ? { ...sym, ...restPatch } : sym)),
              }
            : t
        ),
      }
    })
  },

  createKey() {
    app.update(s => {
      const tplId = s.ui.selectedTemplateId ?? s.templates[0]?.id
      if (!tplId) return s
      const tpl = s.templates.find(t => t.id === tplId)
      if (!tpl) return s

      const key: KeyDef = {
        id: newId('key'),
        name: `Key ${s.keys.length + 1}`,
        templateId: tpl.id,
        textsBySymbolId: Object.fromEntries(tpl.symbols.map(sym => [sym.id, ''])),
      }
      return { ...s, keys: [...s.keys, key], ui: { ...s.ui, selectedKeyId: key.id } }
    })
  },

  renameKey(keyId: string, name: string) {
    app.update(s => ({ ...s, keys: s.keys.map(k => (k.id === keyId ? { ...k, name } : k)) }))
  },

  deleteKey(keyId: string) {
    app.update(s => {
      const nextKeys = s.keys.filter(k => k.id !== keyId)
      const nextSelectedKeyId = s.ui.selectedKeyId === keyId ? (nextKeys[0]?.id ?? null) : s.ui.selectedKeyId
      return { ...s, keys: nextKeys, ui: { ...s.ui, selectedKeyId: nextSelectedKeyId } }
    })
  },

  setKeyTemplate(keyId: string, templateId: string) {
    app.update(s => {
      const tpl = s.templates.find(t => t.id === templateId)
      if (!tpl) return s
      return {
        ...s,
        keys: s.keys.map(k => {
          if (k.id !== keyId) return k
          return {
            ...k,
            templateId,
            textsBySymbolId: Object.fromEntries(tpl.symbols.map(sym => [sym.id, k.textsBySymbolId[sym.id] ?? ''])),
          }
        }),
      }
    })
  },

  setKeyText(keyId: string, symbolId: string, text: string) {
    app.update(s => ({
      ...s,
      keys: s.keys.map(k =>
        k.id === keyId ? { ...k, textsBySymbolId: { ...k.textsBySymbolId, [symbolId]: text } } : k
      ),
    }))
  },

  setExtrusionDepthMm(extrusionDepthMm: number) {
    app.update(s => ({ ...s, settings: { ...s.settings, extrusionDepthMm } }))
  },
}
