<script lang="ts">
  import { app, actions, selectedTemplate, getSlotName, getSlotSymbol, MAX_SLOTS } from '../state/store'
  import type { SymbolDef } from '../state/types'
  import LabelPreview from './LabelPreview.svelte'
  import KeycapPreview from './KeycapPreview.svelte'
  import { showConfirm } from '../state/modalStore'
  import { slide } from 'svelte/transition'
  import { Trash2, Plus, ChevronRight } from 'lucide-svelte'
  import HelpTooltip from './HelpTooltip.svelte'

  $: tpl = $selectedTemplate
  $: usedByKeyCount = tpl == null ? 0 : $app.keys.filter(k => k.templateId === tpl.id).length
  $: hasModels = $app.keycapModels.length > 0

  let showTooltip = false

  function onDeleteTemplate() {
    if (!tpl) return
    if (usedByKeyCount > 0) {
      showConfirm(
        `Template "${tpl.name}" is used by ${usedByKeyCount} key(s).\n\nIf you delete it, those keys will be removed as well.\n\nDelete template?`,
        () => {
          actions.deleteTemplate(tpl.id)
        }
      )
      return
    }
    actions.deleteTemplate(tpl.id)
  }

  import { AVAILABLE_FONTS } from '../generate/fonts'

  $: model = tpl == null ? null : ($app.keycapModels.find(m => m.id === tpl.keycapModelId) ?? null)
  $: modelWidthMm = model?.widthMm ?? 0
  $: modelHeightMm = model?.heightMm ?? 0

  $: previewTextsBySymbolId = tpl ? Object.fromEntries(tpl.symbols.map((s, index) => [s.id, getSlotSymbol(index)])) : {}

  function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n))
  }

  function getTemplateModel(templateId: string) {
    const t = $app.templates.find(t => t.id === templateId)
    if (!t) return null
    return $app.keycapModels.find(m => m.id === t.keycapModelId) ?? null
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
    <div class="flex items-center justify-between gap-3 min-h-[2rem]">
      <div class="flex items-center gap-2">
        <div class="text-sm font-semibold">Templates</div>
        <HelpTooltip
          text="A template defines the layout and styling of symbols (labels) on a keycap. It specifies where text appears, what font, size, color, and rotation to use. Multiple keys can share the same template but display different text values. Templates are linked to a specific keycap model size."
        />
      </div>
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!tpl}
          on:click={onDeleteTemplate}
          title="Delete template"
        >
          <Trash2 class="h-4 w-4" />
          <span>Delete</span>
        </button>
        <div class="relative inline-flex items-center">
          <button
            class="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!hasModels}
            on:click={actions.createTemplate}
            on:mouseenter={() => !hasModels && (showTooltip = true)}
            on:mouseleave={() => (showTooltip = false)}
            title={hasModels ? 'New template' : ''}
          >
            <Plus class="h-4 w-4" />
            <span>New</span>
          </button>
          {#if !hasModels && showTooltip}
            <div
              class="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-50 w-64 p-3 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-200 shadow-lg"
              role="tooltip"
            >
              <div class="whitespace-normal">
                Create at least one model before creating a template. Templates require a keycap model to define their
                size and shape.
              </div>
              <!-- Arrow -->
              <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                <div class="w-2 h-2 border-l border-b border-slate-700 bg-slate-900 rotate-[-45deg]"></div>
              </div>
            </div>
          {/if}
        </div>
      </div>
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
              {$app.keycapModels.find(m => m.id === t.keycapModelId)?.name ?? '—'}
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
  </section>

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4">
    <div class="flex items-center min-h-[2rem]">
      <div class="text-sm font-semibold">Template configuration</div>
    </div>

    {#if !tpl}
      <div class="mt-3 flex items-center justify-center h-64 text-sm text-slate-400">
        Create/select a template to edit.
      </div>
    {:else}
      <div class="mt-3 grid gap-3">
        <label class="grid gap-1 text-xs text-slate-400">
          Name
          <input
            class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={tpl.name}
            on:input={e => actions.renameTemplate(tpl.id, (e.currentTarget as HTMLInputElement).value)}
          />
        </label>

        <label class="grid gap-1 text-xs text-slate-400">
          Keycap model
          <select
            class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={tpl.keycapModelId}
            on:change={e => actions.setTemplateKeycapModel(tpl.id, (e.currentTarget as HTMLSelectElement).value)}
          >
            {#each $app.keycapModels as km (km.id)}
              <option value={km.id}>{km.name}</option>
            {/each}
          </select>
        </label>

        <div class="mt-2">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <div class="text-xs font-semibold text-slate-300">Symbols</div>
              <HelpTooltip
                text="Symbols represent different label positions on a keycap (e.g., primary, secondary, tertiary). You can add multiple symbols to create keys with multiple labels, each with its own position, font, size, rotation, and color. This allows you to create keys with legends, modifiers, or multi-character labels."
              />
            </div>
            <button
              class="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={tpl.symbols.length >= MAX_SLOTS}
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
                    <ChevronRight
                      class="h-4 w-4 text-slate-400 transition-transform {isCollapsed ? '' : 'rotate-90'}"
                    />
                    <span class="text-sm font-medium text-slate-200 truncate capitalize"
                      >{getSlotName(tpl.symbols.indexOf(sym))} ({getSlotSymbol(tpl.symbols.indexOf(sym))})</span
                    >
                  </button>
                  <button
                    class="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 hover:bg-slate-900"
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
                          on:input={e =>
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
                          on:input={e =>
                            actions.updateSymbol(tpl.id, sym.id, {
                              y: Number((e.currentTarget as HTMLInputElement).value),
                            })}
                        />
                      </label>
                    </div>

                    <div class="mt-3">
                      <label class="grid gap-1 text-xs text-slate-400">
                        Font
                        <select
                          class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                          value={sym.fontName}
                          on:change={e =>
                            actions.updateSymbol(tpl.id, sym.id, {
                              fontName: (e.currentTarget as HTMLSelectElement).value as SymbolDef['fontName'],
                            })}
                        >
                          {#each AVAILABLE_FONTS as fontName}
                            <option value={fontName}>{fontName}</option>
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
                          on:input={e =>
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
                          on:input={e =>
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
                          on:input={e =>
                            actions.updateSymbol(tpl.id, sym.id, {
                              color: (e.currentTarget as HTMLInputElement).value,
                            })}
                        />
                        <span class="text-xs text-slate-500 font-mono">{sym.color}</span>
                      </div>
                    </label>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </section>

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4">
    <KeycapPreview
      template={tpl}
      textsBySymbolId={previewTextsBySymbolId}
      widthMm={modelWidthMm}
      heightMm={modelHeightMm}
      keyId={null}
    />
  </section>
</div>
