import { derived, writable } from 'svelte/store'
import type { AppState, KeyDef, SymbolDef, Template } from './types'
import { newId } from '../utils/id'

function defaultSymbol(): SymbolDef {
  return {
    id: newId('sym'),
    slotName: 'main',
    x: 0.5,
    y: 0.5,
    fontFamily: 'helvetiker',
    fontWeight: 'regular',
    fontSizeMm: 4,
    color: '#ffffff',
    rotationDeg: 0,
  }
}

function defaultTemplate(): Template {
  return {
    id: newId('tpl'),
    name: 'New template',
    symbols: [defaultSymbol()],
  }
}

function defaultState(): AppState {
  const tpl = defaultTemplate()
  const key: KeyDef = {
    id: newId('key'),
    name: 'Key 1',
    templateId: tpl.id,
    textsBySymbolId: { [tpl.symbols[0].id]: '' },
  }

  return {
    version: 1,
    templates: [tpl],
    keys: [key],
    stl: null,
    settings: {
      extrusionDepthMm: 0.8,
    },
    ui: {
      selectedTemplateId: tpl.id,
      selectedKeyId: key.id,
    },
  }
}

export const app = writable<AppState>(defaultState())

export const selectedTemplate = derived(app, ($app) =>
  $app.templates.find((t) => t.id === $app.ui.selectedTemplateId) ?? null,
)

export const selectedKey = derived(app, ($app) => $app.keys.find((k) => k.id === $app.ui.selectedKeyId) ?? null)

export const actions = {
  selectTemplate(templateId: string | null) {
    app.update((s) => ({ ...s, ui: { ...s.ui, selectedTemplateId: templateId } }))
  },

  selectKey(keyId: string | null) {
    app.update((s) => ({ ...s, ui: { ...s.ui, selectedKeyId: keyId } }))
  },

  createTemplate() {
    const tpl = defaultTemplate()
    app.update((s) => ({
      ...s,
      templates: [...s.templates, tpl],
      ui: { ...s.ui, selectedTemplateId: tpl.id },
    }))
  },

  renameTemplate(templateId: string, name: string) {
    app.update((s) => ({
      ...s,
      templates: s.templates.map((t) => (t.id === templateId ? { ...t, name } : t)),
    }))
  },

  deleteTemplate(templateId: string) {
    app.update((s) => {
      const keysToRemove = s.keys.filter((k) => k.templateId === templateId).map((k) => k.id)
      const nextTemplates = s.templates.filter((t) => t.id !== templateId)
      const nextKeys = s.keys.filter((k) => k.templateId !== templateId)

      const nextSelectedTemplateId =
        s.ui.selectedTemplateId === templateId ? (nextTemplates[0]?.id ?? null) : s.ui.selectedTemplateId
      const nextSelectedKeyId = keysToRemove.includes(s.ui.selectedKeyId ?? '')
        ? (nextKeys[0]?.id ?? null)
        : s.ui.selectedKeyId

      return {
        ...s,
        templates: nextTemplates,
        keys: nextKeys,
        ui: { ...s.ui, selectedTemplateId: nextSelectedTemplateId, selectedKeyId: nextSelectedKeyId },
      }
    })
  },

  addSymbol(templateId: string) {
    const sym = defaultSymbol()
    app.update((s) => {
      const tpl = s.templates.find((t) => t.id === templateId)
      if (!tpl) return s

      const nextTemplates = s.templates.map((t) => (t.id === templateId ? { ...t, symbols: [...t.symbols, sym] } : t))
      const nextKeys = s.keys.map((k) => {
        if (k.templateId !== templateId) return k
        return { ...k, textsBySymbolId: { ...k.textsBySymbolId, [sym.id]: '' } }
      })
      return { ...s, templates: nextTemplates, keys: nextKeys }
    })
  },

  deleteSymbol(templateId: string, symbolId: string) {
    app.update((s) => {
      const tpl = s.templates.find((t) => t.id === templateId)
      if (!tpl) return s
      if (tpl.symbols.length <= 1) return s

      const nextTemplates = s.templates.map((t) =>
        t.id === templateId ? { ...t, symbols: t.symbols.filter((sym) => sym.id !== symbolId) } : t,
      )
      const nextKeys = s.keys.map((k) => {
        if (k.templateId !== templateId) return k
        const { [symbolId]: _, ...rest } = k.textsBySymbolId
        return { ...k, textsBySymbolId: rest }
      })
      return { ...s, templates: nextTemplates, keys: nextKeys }
    })
  },

  updateSymbol(templateId: string, symbolId: string, patch: Partial<SymbolDef>) {
    app.update((s) => ({
      ...s,
      templates: s.templates.map((t) =>
        t.id === templateId
          ? { ...t, symbols: t.symbols.map((sym) => (sym.id === symbolId ? { ...sym, ...patch } : sym)) }
          : t,
      ),
    }))
  },

  createKey() {
    app.update((s) => {
      const tplId = s.ui.selectedTemplateId ?? s.templates[0]?.id
      if (!tplId) return s
      const tpl = s.templates.find((t) => t.id === tplId)
      if (!tpl) return s

      const key: KeyDef = {
        id: newId('key'),
        name: `Key ${s.keys.length + 1}`,
        templateId: tpl.id,
        textsBySymbolId: Object.fromEntries(tpl.symbols.map((sym) => [sym.id, ''])),
      }
      return { ...s, keys: [...s.keys, key], ui: { ...s.ui, selectedKeyId: key.id } }
    })
  },

  renameKey(keyId: string, name: string) {
    app.update((s) => ({ ...s, keys: s.keys.map((k) => (k.id === keyId ? { ...k, name } : k)) }))
  },

  deleteKey(keyId: string) {
    app.update((s) => {
      const nextKeys = s.keys.filter((k) => k.id !== keyId)
      const nextSelectedKeyId = s.ui.selectedKeyId === keyId ? (nextKeys[0]?.id ?? null) : s.ui.selectedKeyId
      return { ...s, keys: nextKeys, ui: { ...s.ui, selectedKeyId: nextSelectedKeyId } }
    })
  },

  setKeyTemplate(keyId: string, templateId: string) {
    app.update((s) => {
      const tpl = s.templates.find((t) => t.id === templateId)
      if (!tpl) return s
      return {
        ...s,
        keys: s.keys.map((k) => {
          if (k.id !== keyId) return k
          return {
            ...k,
            templateId,
            textsBySymbolId: Object.fromEntries(tpl.symbols.map((sym) => [sym.id, k.textsBySymbolId[sym.id] ?? ''])),
          }
        }),
      }
    })
  },

  setKeyText(keyId: string, symbolId: string, text: string) {
    app.update((s) => ({
      ...s,
      keys: s.keys.map((k) =>
        k.id === keyId ? { ...k, textsBySymbolId: { ...k.textsBySymbolId, [symbolId]: text } } : k,
      ),
    }))
  },

  setExtrusionDepthMm(extrusionDepthMm: number) {
    app.update((s) => ({ ...s, settings: { ...s.settings, extrusionDepthMm } }))
  },

  setStlAsset(stl: AppState['stl']) {
    app.update((s) => ({ ...s, stl }))
  },
}


