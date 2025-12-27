<script lang="ts">
  import { app, actions } from '../state/store'
  import { stlBuffersByModelId } from '../state/sessionAssets'

  type ServerModel = {
    id: string
    name: string
    widthU: number
    heightU: number
    url: string
  }

  // Placeholder server-provided STLs (not actually present yet).
  const serverModels: ServerModel[] = [
    { id: '1u', name: '1u', widthU: 1, heightU: 1, url: '/stls/1u.stl' },
    { id: '125u', name: '1.25u', widthU: 1.25, heightU: 1, url: '/stls/1_25u.stl' },
    { id: '2u', name: '2u', widthU: 2, heightU: 1, url: '/stls/2u.stl' },
    { id: '625u', name: '6.25u Space', widthU: 6.25, heightU: 1, url: '/stls/6_25u_space.stl' },
  ]

  $: selectedId = $app.ui.selectedKeycapModelId
  $: model = selectedId ? $app.keycapModels.find((m) => m.id === selectedId) ?? null : null

  $: usedByTemplateCount = model ? $app.templates.filter((t) => t.keycapModelId === model.id).length : 0
  $: usedByKeyCount =
    model == null
      ? 0
      : $app.keys.filter((k) => {
          const t = $app.templates.find((tpl) => tpl.id === k.templateId)
          return t?.keycapModelId === model.id
        }).length

  function onDeleteModel() {
    if (!model) return
    if (usedByTemplateCount > 0) {
      const ok = window.confirm(
        `Model "${model.name}" is used by ${usedByTemplateCount} template(s) and ${usedByKeyCount} key(s).\n\nDeleting it will remove those templates and keys.\n\nDelete model?`,
      )
      if (!ok) return
    }

    stlBuffersByModelId.update((m) => {
      const next = { ...m }
      delete next[model.id]
      return next
    })
    actions.deleteKeycapModel(model.id)
  }

  async function onUploadStl(ev: Event) {
    if (!model) return
    const input = ev.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    const buf = await file.arrayBuffer()
    stlBuffersByModelId.update((m) => ({ ...m, [model.id]: buf }))
    actions.setKeycapModelSource(model.id, {
      kind: 'upload',
      stl: { fileName: file.name, pathHint: (file as any).webkitRelativePath || file.name },
    })
  }

  function onSelectServerModel(serverId: string) {
    if (!model) return
    const entry = serverModels.find((s) => s.id === serverId)
    if (!entry) return
    actions.renameKeycapModel(model.id, entry.name)
    actions.updateKeycapModel(model.id, { widthU: entry.widthU, heightU: entry.heightU })
    actions.setKeycapModelSource(model.id, {
      kind: 'server',
      serverId: entry.id,
      url: entry.url,
      stl: { fileName: `${entry.name}.stl`, pathHint: `server:${entry.id}` },
    })
  }
</script>

<div class="grid gap-4 lg:grid-cols-12">
  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4">
    <div class="flex items-center justify-between gap-3">
      <div class="text-sm font-semibold">Models</div>
      <button
        class="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800"
        on:click={actions.createKeycapModel}
      >
        New
      </button>
    </div>

    <div class="mt-3 grid gap-2">
      {#each $app.keycapModels as m (m.id)}
        <button
          class="flex w-full items-center justify-between gap-2 rounded-md border border-slate-800 px-3 py-2 text-left hover:bg-slate-900"
          class:bg-slate-900={selectedId === m.id}
          on:click={() => actions.selectKeycapModel(m.id)}
        >
          <div class="min-w-0">
            <div class="truncate text-sm font-medium">{m.name}</div>
            <div class="truncate text-xs text-slate-400">{m.widthU}u × {m.heightU}u</div>
          </div>
        </button>
      {/each}
    </div>

    {#if model}
      <div class="mt-3">
        <button
          class="w-full rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-950/60"
          on:click={onDeleteModel}
        >
          Delete model
        </button>
      </div>
    {/if}
  </section>

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-8">
    {#if !model}
      <div class="text-sm text-slate-400">Create/select a model to edit.</div>
    {:else}
      <div class="text-sm font-semibold">Model configuration</div>

      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <label class="grid gap-1 text-xs text-slate-400">
          Name
          <input
            class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={model.name}
            on:input={(e) => actions.renameKeycapModel(model.id, (e.currentTarget as HTMLInputElement).value)}
          />
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="grid gap-1 text-xs text-slate-400">
            Width (u)
            <input
              class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              type="number"
              min="0.25"
              step="0.25"
              value={model.widthU}
              on:input={(e) => actions.updateKeycapModel(model.id, { widthU: Number((e.currentTarget as HTMLInputElement).value) })}
            />
          </label>

          <label class="grid gap-1 text-xs text-slate-400">
            Height (u)
            <input
              class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              type="number"
              min="0.25"
              step="0.25"
              value={model.heightU}
              on:input={(e) => actions.updateKeycapModel(model.id, { heightU: Number((e.currentTarget as HTMLInputElement).value) })}
            />
          </label>
        </div>
      </div>

      <div class="mt-4 grid gap-3">
        <div class="text-xs font-semibold text-slate-300">STL source</div>

        <label class="grid gap-1 text-xs text-slate-400">
          Select from server (placeholder)
          <select
            class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={model.source.kind === 'server' ? model.source.serverId : ''}
            on:change={(e) => onSelectServerModel((e.currentTarget as HTMLSelectElement).value)}
          >
            <option value="">—</option>
            {#each serverModels as s}
              <option value={s.id}>{s.name} ({s.widthU}u×{s.heightU}u)</option>
            {/each}
          </select>
        </label>

        <label class="grid gap-1 text-xs text-slate-400">
          Or upload your own STL
          <input
            class="block w-full cursor-pointer rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:text-slate-100 hover:file:bg-slate-700"
            type="file"
            accept=".stl,model/stl"
            on:change={onUploadStl}
          />
        </label>

        <div class="text-sm">
          <div class="text-xs text-slate-400">Current reference</div>
          <div class="font-mono text-xs text-slate-200">
            {model.source.kind === 'server'
              ? `${model.source.stl.fileName} (${model.source.url})`
              : model.source.stl?.fileName ?? '—'}
          </div>
        </div>
      </div>
    {/if}
  </section>
</div>


