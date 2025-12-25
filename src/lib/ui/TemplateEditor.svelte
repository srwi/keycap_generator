<script lang="ts">
  import { app, actions, selectedTemplate } from '../state/store'
  import type { SymbolDef } from '../state/types'
  import { clickOutside } from './actions/clickOutside'

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

  const fontFamilies: Array<SymbolDef['fontFamily']> = ['helvetiker']
  const fontWeights: Array<SymbolDef['fontWeight']> = ['regular', 'bold']

  let isTemplateMenuOpen = false
  let lastTemplateId: string | null = null
  let templateNameDraft = ''

  $: if (tpl && tpl.id !== lastTemplateId) {
    lastTemplateId = tpl.id
    templateNameDraft = tpl.name
  }

  function selectTemplate(id: string) {
    actions.selectTemplate(id)
    isTemplateMenuOpen = false
  }
</script>

<div class="grid gap-4 lg:grid-cols-[1fr_2fr]">
  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4">
    <div class="flex items-center justify-between gap-3">
      <div class="text-sm font-semibold">Template</div>
      <button
        class="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800"
        on:click={actions.createTemplate}
      >
        New
      </button>
    </div>

    <div class="mt-3 grid gap-2">
      <div class="grid gap-1 text-xs text-slate-400">
        Template
        <div class="relative" use:clickOutside={() => (isTemplateMenuOpen = false)}>
          <div class="flex">
            <input
              class="min-w-0 flex-1 rounded-l-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500 disabled:opacity-60"
              placeholder="Select template…"
              value={tpl ? templateNameDraft : ''}
              disabled={!tpl}
              on:input={(e) => {
                if (!tpl) return
                templateNameDraft = (e.currentTarget as HTMLInputElement).value
                actions.renameTemplate(tpl.id, templateNameDraft)
              }}
              on:keydown={(e) => {
                if (e.key === 'Escape') isTemplateMenuOpen = false
              }}
            />
            <button
              class="rounded-r-md border border-l-0 border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              type="button"
              aria-label="Select template"
              on:click={() => (isTemplateMenuOpen = !isTemplateMenuOpen)}
            >
              ▾
            </button>
          </div>

          {#if isTemplateMenuOpen}
            <div class="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-800 bg-slate-950 shadow-lg">
              {#each $app.templates as t (t.id)}
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-900"
                  class:bg-slate-900={tpl?.id === t.id}
                  on:click={() => selectTemplate(t.id)}
                >
                  <span class="truncate">{t.name}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      {#if tpl}
        <button
          class="mt-2 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-950/60"
          on:click={onDeleteTemplate}
        >
          Delete template{usedByKeyCount > 0 ? ` (and ${usedByKeyCount} key(s))` : ''}
        </button>
      {/if}
    </div>
  </section>

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4">
    <div class="flex items-center justify-between gap-3">
      <div class="text-sm font-semibold">Symbols</div>
      {#if tpl}
        <button
          class="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800"
          on:click={() => actions.addSymbol(tpl.id)}
        >
          Add symbol
        </button>
      {/if}
    </div>

    {#if !tpl}
      <div class="mt-3 text-sm text-slate-400">Create a template to start.</div>
    {:else}
      <div class="mt-3 overflow-auto">
        <table class="w-full min-w-[980px] text-left text-sm">
          <thead class="text-xs text-slate-400">
            <tr class="border-b border-slate-800">
              <th class="px-2 py-2 font-medium">Slot name</th>
              <th class="px-2 py-2 font-medium">X</th>
              <th class="px-2 py-2 font-medium">Y</th>
              <th class="px-2 py-2 font-medium">Font</th>
              <th class="px-2 py-2 font-medium">Weight</th>
              <th class="px-2 py-2 font-medium">Size (mm)</th>
              <th class="px-2 py-2 font-medium">Color</th>
              <th class="px-2 py-2 font-medium">Rot (deg)</th>
              <th class="px-2 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {#each tpl.symbols as sym (sym.id)}
              <tr class="border-b border-slate-900">
                <td class="px-2 py-2">
                  <input
                    class="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                    value={sym.slotName}
                    on:input={(e) =>
                      actions.updateSymbol(tpl.id, sym.id, { slotName: (e.currentTarget as HTMLInputElement).value })}
                  />
                </td>
                <td class="px-2 py-2">
                  <input
                    class="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={sym.x}
                    on:input={(e) =>
                      actions.updateSymbol(tpl.id, sym.id, { x: Number((e.currentTarget as HTMLInputElement).value) })}
                  />
                </td>
                <td class="px-2 py-2">
                  <input
                    class="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={sym.y}
                    on:input={(e) =>
                      actions.updateSymbol(tpl.id, sym.id, { y: Number((e.currentTarget as HTMLInputElement).value) })}
                  />
                </td>
                <td class="px-2 py-2">
                  <select
                    class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
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
                </td>
                <td class="px-2 py-2">
                  <select
                    class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
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
                </td>
                <td class="px-2 py-2">
                  <input
                    class="w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={sym.fontSizeMm}
                    on:input={(e) =>
                      actions.updateSymbol(tpl.id, sym.id, {
                        fontSizeMm: Number((e.currentTarget as HTMLInputElement).value),
                      })}
                  />
                </td>
                <td class="px-2 py-2">
                  <input
                    class="h-9 w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5"
                    type="color"
                    value={sym.color}
                    on:input={(e) =>
                      actions.updateSymbol(tpl.id, sym.id, { color: (e.currentTarget as HTMLInputElement).value })}
                  />
                </td>
                <td class="px-2 py-2">
                  <input
                    class="w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                    type="number"
                    step="1"
                    value={sym.rotationDeg}
                    on:input={(e) =>
                      actions.updateSymbol(tpl.id, sym.id, {
                        rotationDeg: Number((e.currentTarget as HTMLInputElement).value),
                      })}
                  />
                </td>
                <td class="px-2 py-2 text-right">
                  <button
                    class="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 hover:bg-slate-900"
                    disabled={tpl.symbols.length <= 1}
                    on:click={() => actions.deleteSymbol(tpl.id, sym.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="mt-3 text-xs text-slate-400">
        X/Y are normalized to the keycap face: (0,0)=top-left, (1,1)=bottom-right.
      </div>
    {/if}
  </section>
</div>


