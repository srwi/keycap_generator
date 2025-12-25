<script lang="ts">
  import { app, actions, selectedKey } from '../state/store'
  import LabelPreview from './LabelPreview.svelte'

  $: key = $selectedKey
  $: tpl =
    key == null ? null : $app.templates.find((t) => t.id === key.templateId) ?? null
</script>

<div class="grid gap-4 lg:grid-cols-[320px_1fr]">
  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4">
    <div class="flex items-center justify-between gap-3">
      <div class="text-sm font-semibold">Keys</div>
      <button
        class="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800"
        on:click={actions.createKey}
      >
        New
      </button>
    </div>

    <div class="mt-3 grid gap-2">
      {#each $app.keys as k (k.id)}
        <button
          class="flex w-full items-center justify-between gap-2 rounded-md border border-slate-800 px-3 py-2 text-left hover:bg-slate-900"
          class:bg-slate-900={$app.ui.selectedKeyId === k.id}
          on:click={() => actions.selectKey(k.id)}
        >
          <div class="min-w-0">
            <div class="truncate text-sm font-medium">{k.name}</div>
            <div class="truncate text-xs text-slate-400">
              {$app.templates.find((t) => t.id === k.templateId)?.name ?? '—'}
            </div>
          </div>
        </button>
      {/each}
    </div>

    {#if key}
      <div class="mt-3 border-t border-slate-800 pt-3">
        <button
          class="w-full rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-950/60"
          on:click={() => actions.deleteKey(key.id)}
        >
          Delete key
        </button>
      </div>
    {/if}
  </section>

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4">
    {#if !key}
      <div class="text-sm text-slate-400">Create/select a key to edit.</div>
    {:else}
      <div class="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <div class="flex items-start justify-between gap-3">
            <div class="text-sm font-semibold">Key definition</div>
          </div>

          <div class="mt-3 grid gap-3">
            <div class="grid gap-1">
              <div class="text-xs text-slate-400">Name</div>
              <input
                class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                value={key.name}
                on:input={(e) => actions.renameKey(key.id, (e.currentTarget as HTMLInputElement).value)}
              />
            </div>

            <div class="grid gap-1">
              <div class="text-xs text-slate-400">Template</div>
              <select
                class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                value={key.templateId}
                on:change={(e) => actions.setKeyTemplate(key.id, (e.currentTarget as HTMLSelectElement).value)}
              >
                {#each $app.templates as t (t.id)}
                  <option value={t.id}>{t.name}</option>
                {/each}
              </select>
            </div>

            {#if !tpl}
              <div class="text-sm text-slate-400">This key references a missing template.</div>
            {:else}
              <div class="rounded-lg border border-slate-800 bg-slate-950/50">
                <div class="border-b border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300">Symbols</div>
                <div class="grid gap-2 p-3">
                  {#each tpl.symbols as sym (sym.id)}
                    <label class="grid gap-1">
                      <div class="text-xs text-slate-400">{sym.slotName}</div>
                      <input
                        class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                        value={key.textsBySymbolId[sym.id] ?? ''}
                        on:input={(e) =>
                          actions.setKeyText(key.id, sym.id, (e.currentTarget as HTMLInputElement).value)}
                      />
                    </label>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>

        <div class="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <div class="text-xs font-semibold text-slate-300">2D preview</div>

          <div class="mt-3 flex items-center justify-center">
            <LabelPreview template={tpl} textsBySymbolId={key.textsBySymbolId} sizePx={288} />
          </div>

          <div class="mt-3 text-xs text-slate-400">
            Preview is schematic; generation uses the same normalized X/Y anchors on the STL face plane.
          </div>
        </div>
      </div>
    {/if}
  </section>
</div>


