<script lang="ts">
  import { app, actions, selectedTemplate, getSlotName, getSlotSymbol } from '../state/store'
  import type { SymbolDef } from '../state/types'
  import { DEFAULT_KEYCAP_SIZE_MM } from '../state/types'
  import LabelPreview from './LabelPreview.svelte'
  import KeycapPreview from './KeycapPreview.svelte'
  import { slide } from 'svelte/transition'

  $: tpl = $selectedTemplate
  $: usedByKeyCount =
    tpl == null ? 0 : $app.keys.filter((k) => k.templateId === tpl.id).length

  function onDeleteTemplate() {
    if (!tpl) return
    if (usedByKeyCount > 0) {
      const ok = window.confirm(
        `Template "${tpl.name}" is used by ${usedByKeyCount} key(s).\n\nIf you delete it, those keys will be removed as well.\n\nDelete template?`,
      )
      if (!ok) return
    }
    actions.deleteTemplate(tpl.id)
  }

  const fontFamilies: Array<SymbolDef['fontFamily']> = ['roboto', 'notoserif']
  const fontWeights: Array<SymbolDef['fontWeight']> = ['regular', 'bold']

  $: model =
    tpl == null ? null : $app.keycapModels.find((m) => m.id === tpl.keycapModelId) ?? null
  $: modelWidthMm = model?.widthMm ?? DEFAULT_KEYCAP_SIZE_MM
  $: modelHeightMm = model?.heightMm ?? DEFAULT_KEYCAP_SIZE_MM

  $: previewTextsBySymbolId = tpl
    ? Object.fromEntries(tpl.symbols.map((s, index) => [s.id, getSlotSymbol(index)]))
    : {}

  function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n))
  }

  function getTemplateModel(templateId: string) {
    const t = $app.templates.find((t) => t.id === templateId)
    if (!t) return null
    return $app.keycapModels.find((m) => m.id === t.keycapModelId) ?? null
  }

  let collapsedSymbols = new Set<string>()
  let previousTemplateId: string | null = null
  let previousSymbolIds: Set<string> | null = null

  function toggleSymbol(symbolId: string) {
    if (collapsedSymbols.has(symbolId)) {
      collapsedSymbols.delete(symbolId)
    } else {
      collapsedSymbols.add(symbolId)
    }
    collapsedSymbols = collapsedSymbols
  }

  $: if (tpl) {
    const currentSymbolIds = new Set(tpl.symbols.map(s => s.id))
    
    if (!previousSymbolIds || previousTemplateId !== tpl.id) {
      collapsedSymbols = new Set(currentSymbolIds)
    } else {
      const kept = new Set([...collapsedSymbols].filter(id => currentSymbolIds.has(id)))
      const newIds = new Set([...currentSymbolIds].filter(id => !previousSymbolIds!.has(id)))
      collapsedSymbols = new Set([...kept, ...newIds])
    }
    
    previousTemplateId = tpl.id
    previousSymbolIds = currentSymbolIds
  }
</script>

<div class="grid gap-4 lg:grid-cols-12">
  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4">
    <div class="flex items-center justify-between gap-3">
      <div class="text-sm font-semibold">Templates</div>
      <button
        class="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800"
        on:click={actions.createTemplate}
      >
        New
      </button>
    </div>

    <div class="mt-3 grid gap-2">
      {#each $app.templates as t (t.id)}
        {@const tModel = getTemplateModel(t.id)}
        {@const previewTexts = Object.fromEntries(t.symbols.map((s, index) => [s.id, getSlotSymbol(index)]))}
        <button
          class="flex w-full items-center justify-between gap-2 rounded-md border border-slate-800 px-3 py-2 text-left hover:bg-slate-900"
          class:bg-slate-900={$app.ui.selectedTemplateId === t.id}
          on:click={() => actions.selectTemplate(t.id)}
        >
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium">{t.name}</div>
            <div class="truncate text-xs text-slate-400">
              {$app.keycapModels.find((m) => m.id === t.keycapModelId)?.name ?? '—'}
            </div>
          </div>
          <div class="h-10 w-10 -mr-1 flex-shrink-0 flex items-center justify-center">
            {#if tModel}
              <LabelPreview
                template={t}
                textsBySymbolId={previewTexts}
                widthMm={tModel.widthMm}
                heightMm={tModel.heightMm}
                className="rounded"
              />
            {/if}
          </div>
        </button>
      {/each}
    </div>

    {#if tpl}
      <div class="mt-3">
        <button
          class="w-full rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-950/60"
          on:click={onDeleteTemplate}
        >
          Delete template
        </button>
      </div>
    {/if}
  </section>

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4">
    {#if !tpl}
      <div class="text-sm text-slate-400">Create/select a template to edit.</div>
    {:else}
      <div class="text-sm font-semibold">Template configuration</div>

      <div class="mt-3 grid gap-3">
        <label class="grid gap-1 text-xs text-slate-400">
          Name
          <input
            class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={tpl.name}
            on:input={(e) => actions.renameTemplate(tpl.id, (e.currentTarget as HTMLInputElement).value)}
          />
        </label>

        <label class="grid gap-1 text-xs text-slate-400">
          Keycap model
          <select
            class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={tpl.keycapModelId}
            on:change={(e) => actions.setTemplateKeycapModel(tpl.id, (e.currentTarget as HTMLSelectElement).value)}
          >
            {#each $app.keycapModels as km (km.id)}
              <option value={km.id}>{km.name}</option>
            {/each}
          </select>
        </label>

        <div class="mt-2">
          <div class="flex items-center justify-between gap-3">
            <div class="text-xs font-semibold text-slate-300">Symbols</div>
            <button
              class="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800"
              on:click={() => actions.addSymbol(tpl.id)}
            >
              Add symbol
            </button>
          </div>

          <div class="mt-3 grid gap-3">
            {#each tpl.symbols as sym (sym.id)}
              {@const isCollapsed = collapsedSymbols.has(sym.id)}
              <div class="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
                <div class="flex items-center justify-between gap-2 p-3">
                  <button
                    type="button"
                    class="flex items-center gap-2 flex-1 min-w-0 hover:bg-slate-900/50 transition-colors rounded px-2 py-1 -mx-2 -my-1"
                    on:click={() => toggleSymbol(sym.id)}
                  >
                    <svg
                      class="h-4 w-4 text-slate-400 transition-transform {isCollapsed ? '' : 'rotate-90'}"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                    <span class="text-sm font-medium text-slate-200 truncate capitalize">{getSlotName(tpl.symbols.indexOf(sym))} ({getSlotSymbol(tpl.symbols.indexOf(sym))})</span>
                  </button>
                  <button
                    class="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={tpl.symbols.length <= 1}
                    on:click={() => actions.deleteSymbol(tpl.id, sym.id)}
                  >
                    Remove
                  </button>
                </div>

                {#if !isCollapsed}
                  <div class="p-3 pt-0 space-y-3" transition:slide={{ duration: 200 }}>
                    <div class="grid grid-cols-2 gap-3">
                  <label class="grid gap-1 text-xs text-slate-400">
                    X (mm)
                    <input
                      class="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                      type="number"
                      step="0.1"
                      value={sym.x}
                      on:input={(e) =>
                        actions.updateSymbol(tpl.id, sym.id, {
                          x: Number((e.currentTarget as HTMLInputElement).value),
                        })}
                    />
                  </label>
                  <label class="grid gap-1 text-xs text-slate-400">
                    Y (mm)
                    <input
                      class="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                      type="number"
                      step="0.1"
                      value={sym.y}
                      on:input={(e) =>
                        actions.updateSymbol(tpl.id, sym.id, {
                          y: Number((e.currentTarget as HTMLInputElement).value),
                        })}
                    />
                  </label>
                </div>

                <div class="mt-3 grid grid-cols-2 gap-3">
                  <label class="grid gap-1 text-xs text-slate-400">
                    Font
                    <select
                      class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                      value={sym.fontFamily}
                      on:change={(e) =>
                        actions.updateSymbol(tpl.id, sym.id, {
                          fontFamily: (e.currentTarget as HTMLSelectElement).value as SymbolDef['fontFamily'],
                        })}
                    >
                      {#each fontFamilies as ff}
                        <option value={ff}>{ff}</option>
                      {/each}
                    </select>
                  </label>
                  <label class="grid gap-1 text-xs text-slate-400">
                    Weight
                    <select
                      class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                      value={sym.fontWeight}
                      on:change={(e) =>
                        actions.updateSymbol(tpl.id, sym.id, {
                          fontWeight: (e.currentTarget as HTMLSelectElement).value as SymbolDef['fontWeight'],
                        })}
                    >
                      {#each fontWeights as fw}
                        <option value={fw}>{fw}</option>
                      {/each}
                    </select>
                  </label>
                </div>

                <div class="mt-3 grid grid-cols-2 gap-3">
                  <label class="grid gap-1 text-xs text-slate-400">
                    Size (mm)
                    <input
                      class="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={sym.fontSizeMm}
                      on:input={(e) =>
                        actions.updateSymbol(tpl.id, sym.id, {
                          fontSizeMm: Number((e.currentTarget as HTMLInputElement).value),
                        })}
                    />
                  </label>
                  <label class="grid gap-1 text-xs text-slate-400">
                    Rotation (deg)
                    <input
                      class="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                      type="number"
                      step="1"
                      value={sym.rotationDeg}
                      on:input={(e) =>
                        actions.updateSymbol(tpl.id, sym.id, {
                          rotationDeg: Number((e.currentTarget as HTMLInputElement).value),
                        })}
                    />
                  </label>
                </div>

                    <label class="grid gap-1 text-xs text-slate-400">
                      Color
                      <div class="flex items-center gap-2">
                        <input
                          class="h-9 w-20 rounded-md border border-slate-700 bg-slate-900"
                          type="color"
                          value={sym.color}
                          on:input={(e) =>
                            actions.updateSymbol(tpl.id, sym.id, { color: (e.currentTarget as HTMLInputElement).value })}
                        />
                        <span class="text-xs text-slate-500 font-mono">{sym.color}</span>
                      </div>
                    </label>
                  </div>
                {/if}
              </div>
            {/each}
          </div>

          <div class="mt-3 text-xs text-slate-400">
            X/Y are mm offsets from center: (0,0)=center. Positive X is right, positive Y is down. Model size: {modelWidthMm.toFixed(1)}mm × {modelHeightMm.toFixed(1)}mm.
          </div>
        </div>
      </div>
    {/if}
  </section>

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4">
    {#if tpl}
      <KeycapPreview
        template={tpl}
        textsBySymbolId={previewTextsBySymbolId}
        widthMm={modelWidthMm}
        heightMm={modelHeightMm}
        keyId={null}
      />
    {:else}
      <div class="text-sm text-slate-400">Select a template to preview.</div>
    {/if}
  </section>
</div>


