<script lang="ts">
  import { app, actions, selectedKey, getSlotName, getSlotSymbol } from '../state/store'
  import LabelPreview from './LabelPreview.svelte'
  import KeycapPreview from './KeycapPreview.svelte'
  import { Trash2, Plus } from 'lucide-svelte'
  import HelpTooltip from './HelpTooltip.svelte'

  $: key = $selectedKey
  $: tpl = key == null ? null : ($app.templates.find(t => t.id === key.templateId) ?? null)
  $: model = tpl == null ? null : ($app.keycapModels.find(m => m.id === tpl.keycapModelId) ?? null)
  $: modelWidthMm = model?.widthMm ?? 0
  $: modelHeightMm = model?.heightMm ?? 0
  $: hasTemplates = $app.templates.length > 0

  let showTooltip = false

  function onDeleteKey() {
    if (!key) return
    actions.deleteKey(key.id)
  }

  function getKeyTemplate(keyId: string) {
    const k = $app.keys.find(k => k.id === keyId)
    if (!k) return null
    return $app.templates.find(t => t.id === k.templateId) ?? null
  }

  function getKeyModel(keyId: string) {
    const t = getKeyTemplate(keyId)
    if (!t) return null
    return $app.keycapModels.find(m => m.id === t.keycapModelId) ?? null
  }
</script>

<div class="grid gap-4 lg:grid-cols-12">
  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4">
    <div class="flex items-center justify-between gap-3 min-h-[2rem]">
      <div class="flex items-center gap-2">
        <div class="text-sm font-semibold">Keys</div>
        <HelpTooltip
          text="A key is a specific instance of a keycap that uses a template and contains actual text values. Each key represents one physical keycap you'll generate. Keys share the layout and styling from their template but have unique text for each symbol position (e.g., 'Q', 'Shift', 'Enter')."
        />
      </div>
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!key}
          on:click={onDeleteKey}
          title="Delete key"
        >
          <Trash2 class="h-4 w-4" />
          <span>Delete</span>
        </button>
        <div class="relative inline-flex items-center">
          <button
            class="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!hasTemplates}
            on:click={actions.createKey}
            on:mouseenter={() => !hasTemplates && (showTooltip = true)}
            on:mouseleave={() => (showTooltip = false)}
            title={hasTemplates ? 'New key' : ''}
          >
            <Plus class="h-4 w-4" />
            <span>New</span>
          </button>
          {#if !hasTemplates && showTooltip}
            <div
              class="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-50 w-64 p-3 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-200 shadow-lg"
              role="tooltip"
            >
              <div class="whitespace-normal">
                Create at least one template before creating a key. Keys require a template to define their layout and
                styling.
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
      {#each $app.keys as k (k.id)}
        {@const kTpl = getKeyTemplate(k.id)}
        {@const kModel = getKeyModel(k.id)}
        <button
          class="flex w-full items-center justify-between gap-2 rounded-md border border-slate-800 px-3 py-2 text-left hover:bg-slate-900"
          class:bg-slate-900={$app.ui.selectedKeyId === k.id}
          on:click={() => actions.selectKey(k.id)}
        >
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium">{k.name}</div>
            <div class="truncate text-xs text-slate-400">
              {$app.templates.find(t => t.id === k.templateId)?.name ?? '—'}
            </div>
          </div>
          <div class="h-10 w-10 -mr-1 flex-shrink-0 flex items-center justify-center">
            {#if kTpl && kModel}
              <LabelPreview
                template={kTpl}
                textsBySymbolId={k.textsBySymbolId}
                widthMm={kModel.widthMm}
                heightMm={kModel.heightMm}
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
      <div class="text-sm font-semibold">Key configuration</div>
    </div>

    {#if !key}
      <div class="mt-3 flex items-center justify-center h-64 text-sm text-slate-400">Create/select a key to edit.</div>
    {:else}
      <div class="mt-3 grid gap-3">
        <label class="grid gap-1 text-xs text-slate-400">
          Name
          <input
            class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={key.name}
            on:input={e => actions.renameKey(key.id, (e.currentTarget as HTMLInputElement).value)}
          />
        </label>

        <label class="grid gap-1 text-xs text-slate-400">
          Template
          <select
            class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={key.templateId}
            on:change={e => actions.setKeyTemplate(key.id, (e.currentTarget as HTMLSelectElement).value)}
          >
            {#each $app.templates as t (t.id)}
              <option value={t.id}>{t.name}</option>
            {/each}
          </select>
        </label>

        {#if !tpl}
          <div class="text-sm text-slate-400">This key references a missing template.</div>
        {:else}
          <div class="mt-2">
            <div class="text-xs font-semibold text-slate-300 mb-2">Symbols</div>
            <div class="space-y-2">
              {#each tpl.symbols as sym, index (sym.id)}
                <div class="rounded-md border border-slate-800 bg-slate-900/30 p-2.5">
                  <div class="text-xs font-medium text-slate-300 mb-1.5 capitalize">
                    {getSlotName(index)} ({getSlotSymbol(index)})
                  </div>
                  <input
                    class="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-600"
                    placeholder="Enter text..."
                    value={key.textsBySymbolId[sym.id] ?? ''}
                    on:input={e => actions.setKeyText(key.id, sym.id, (e.currentTarget as HTMLInputElement).value)}
                  />
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </section>

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4">
    <KeycapPreview
      template={tpl}
      textsBySymbolId={key?.textsBySymbolId ?? {}}
      widthMm={modelWidthMm}
      heightMm={modelHeightMm}
      keyId={key?.id ?? null}
    />
  </section>
</div>
