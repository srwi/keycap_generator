<script lang="ts">
  import { app, actions } from '../state/store'
  import { stlBuffersByModelId } from '../state/sessionAssets'
  import { getStlDimensions } from '../generate/stl'
  import Model3DViewer from './Model3DViewer.svelte'

  type ServerModel = {
    id: string
    name: string
    url: string
  }

  const serverModels: ServerModel[] = [
    { id: '1u', name: '1u', url: '/stls/1u.stl' },
    { id: '125u', name: '1.25u', url: '/stls/1_25u.stl' },
    { id: '2u', name: '2u', url: '/stls/2u.stl' },
    { id: '625u', name: '6.25u Space', url: '/stls/6_25u_space.stl' },
  ]

  $: selectedId = $app.ui.selectedKeycapModelId
  $: model = selectedId ? ($app.keycapModels.find(m => m.id === selectedId) ?? null) : null

  // Automatically load dimensions for server models that haven't been loaded yet (0 indicates not loaded)
  $: if (model?.source.kind === 'server' && (model.widthMm === 0 || model.heightMm === 0)) {
    fetch(model.source.url)
      .then(res => res.arrayBuffer())
      .then(buf => getStlDimensions(buf))
      .then(({ widthMm, heightMm }) => actions.updateKeycapModel(model.id, { widthMm, heightMm }))
      .catch(err => console.error('Failed to load server STL dimensions:', err))
  }

  $: modelStlUrl = model?.source.kind === 'server' ? model.source.url : null
  $: modelStlBuffer = model?.source.kind === 'upload' && model ? ($stlBuffersByModelId[model.id] ?? null) : null

  $: usedByTemplateCount = model ? $app.templates.filter(t => t.keycapModelId === model.id).length : 0
  $: usedByKeyCount =
    model == null
      ? 0
      : $app.keys.filter(k => {
          const t = $app.templates.find(tpl => tpl.id === k.templateId)
          return t?.keycapModelId === model.id
        }).length

  function onDeleteModel() {
    if (!model) return
    if (usedByTemplateCount > 0) {
      const ok = window.confirm(
        `Model "${model.name}" is used by ${usedByTemplateCount} template(s) and ${usedByKeyCount} key(s).\n\nDeleting it will remove those templates and keys.\n\nDelete model?`
      )
      if (!ok) return
    }

    stlBuffersByModelId.update(m => {
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
    stlBuffersByModelId.update(m => ({ ...m, [model.id]: buf }))

    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    actions.renameKeycapModel(model.id, fileNameWithoutExt)
    actions.updateKeycapModel(model.id, { rotationX: 0, rotationY: 0, rotationZ: 0 })

    const { widthMm, heightMm } = await getStlDimensions(buf)
    actions.updateKeycapModel(model.id, { widthMm, heightMm })

    actions.setKeycapModelSource(model.id, {
      kind: 'upload',
      stl: { fileName: file.name, pathHint: (file as any).webkitRelativePath || file.name },
    })
  }

  function onSwitchToUpload() {
    if (!model) return
    // Switch to upload mode
    // If we already have an upload source with STL reference, keep it
    // Otherwise, clear it (user will need to upload again)
    actions.setKeycapModelSource(model.id, {
      kind: 'upload',
      stl: model.source.kind === 'upload' ? model.source.stl : null,
    })
    // Reset rotation when switching to upload (new file may need different orientation)
    actions.updateKeycapModel(model.id, { rotationX: 0, rotationY: 0, rotationZ: 0 })
  }

  async function onSelectServerModel(serverId: string) {
    if (!model) return
    const entry = serverModels.find(s => s.id === serverId)
    if (!entry) return

    actions.renameKeycapModel(model.id, entry.name)
    actions.updateKeycapModel(model.id, { rotationX: 0, rotationY: 0, rotationZ: 0 })
    actions.setKeycapModelSource(model.id, {
      kind: 'server',
      serverId: entry.id,
      url: entry.url,
      stl: { fileName: `${entry.name}.stl`, pathHint: `server:${entry.id}` },
    })

    // Reset to 0 so reactive statement will reload dimensions
    actions.updateKeycapModel(model.id, { widthMm: 0, heightMm: 0 })
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
            <div class="truncate text-xs text-slate-400">{m.widthMm.toFixed(1)}mm × {m.heightMm.toFixed(1)}mm</div>
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

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4">
    {#if !model}
      <div class="text-sm text-slate-400">Create/select a model to edit.</div>
    {:else}
      <div class="text-sm font-semibold">Model configuration</div>

      <div class="mt-3 grid gap-3">
        <label class="grid gap-1 text-xs text-slate-400">
          Name
          <input
            class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={model.name}
            on:input={e => actions.renameKeycapModel(model.id, (e.currentTarget as HTMLInputElement).value)}
          />
        </label>

        <div class="mt-2 grid gap-3">
          <div class="text-xs font-semibold text-slate-300">STL source</div>

          <div class="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="stl-source-{model.id}"
                  class="h-4 w-4 border-slate-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                  checked={model.source.kind === 'server'}
                  on:change={() => {
                    if (model.source.kind !== 'server' && serverModels.length > 0) {
                      // Clear uploaded buffer when switching to server mode
                      if (model.source.kind === 'upload') {
                        stlBuffersByModelId.update(m => {
                          const next = { ...m }
                          delete next[model.id]
                          return next
                        })
                        // Reset rotation when switching to server (server models are pre-oriented)
                        actions.updateKeycapModel(model.id, { rotationX: 0, rotationY: 0, rotationZ: 0 })
                      }
                      onSelectServerModel(serverModels[0].id)
                    }
                  }}
                />
                <span class="text-xs text-slate-300 font-medium">From server</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="stl-source-{model.id}"
                  class="h-4 w-4 border-slate-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                  checked={model.source.kind === 'upload'}
                  on:change={onSwitchToUpload}
                />
                <span class="text-xs text-slate-300 font-medium">Upload file</span>
              </label>
            </div>

            {#if model.source.kind === 'server'}
              <label class="grid gap-1 text-xs text-slate-400">
                Select model
                <select
                  class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  value={model.source.serverId}
                  on:change={e => onSelectServerModel((e.currentTarget as HTMLSelectElement).value)}
                >
                  {#each serverModels as s}
                    <option value={s.id}>{s.name}</option>
                  {/each}
                </select>
              </label>
            {:else}
              <label class="grid gap-1 text-xs text-slate-400">
                Choose STL file
                <div class="flex items-center gap-2">
                  <input
                    id="file-input-{model.id}"
                    class="hidden"
                    type="file"
                    accept=".stl,model/stl"
                    on:change={onUploadStl}
                  />
                  <button
                    type="button"
                    class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                    on:click={() => {
                      const fileInput = document.getElementById(`file-input-${model.id}`) as HTMLInputElement
                      fileInput?.click()
                    }}
                  >
                    Browse...
                  </button>
                  {#if model.source.stl?.fileName}
                    <span class="text-xs text-slate-300 truncate flex-1">
                      {model.source.stl.fileName}
                    </span>
                  {:else}
                    <span class="text-xs text-slate-500">No file selected</span>
                  {/if}
                </div>
              </label>
            {/if}
          </div>
        </div>

        {#if model.source.kind === 'upload' && model.source.stl}
          <div class="mt-2 grid gap-3">
            <div class="text-xs font-semibold text-slate-300">Model Orientation</div>
            <div class="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div class="text-xs text-slate-400 mb-1">Rotate the model until the face points towards the camera.</div>
              <div class="grid grid-cols-3 gap-2">
                <div class="grid gap-1">
                  <div class="text-xs text-slate-400 text-center">X-axis</div>
                  <div class="flex gap-1">
                    <button
                      class="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                      on:click={() => {
                        const current = model.rotationX
                        actions.updateKeycapModel(model.id, { rotationX: (current - 90 + 360) % 360 })
                      }}
                    >
                      -90°
                    </button>
                    <button
                      class="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                      on:click={() => {
                        const current = model.rotationX
                        actions.updateKeycapModel(model.id, { rotationX: (current + 90) % 360 })
                      }}
                    >
                      +90°
                    </button>
                  </div>
                  <div class="text-xs text-slate-500 text-center">{model.rotationX}°</div>
                </div>
                <div class="grid gap-1">
                  <div class="text-xs text-slate-400 text-center">Y-axis</div>
                  <div class="flex gap-1">
                    <button
                      class="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                      on:click={() => {
                        const current = model.rotationY
                        actions.updateKeycapModel(model.id, { rotationY: (current - 90 + 360) % 360 })
                      }}
                    >
                      -90°
                    </button>
                    <button
                      class="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                      on:click={() => {
                        const current = model.rotationY
                        actions.updateKeycapModel(model.id, { rotationY: (current + 90) % 360 })
                      }}
                    >
                      +90°
                    </button>
                  </div>
                  <div class="text-xs text-slate-500 text-center">{model.rotationY}°</div>
                </div>
                <div class="grid gap-1">
                  <div class="text-xs text-slate-400 text-center">Z-axis</div>
                  <div class="flex gap-1">
                    <button
                      class="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                      on:click={() => {
                        const current = model.rotationZ
                        actions.updateKeycapModel(model.id, { rotationZ: (current - 90 + 360) % 360 })
                      }}
                    >
                      -90°
                    </button>
                    <button
                      class="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                      on:click={() => {
                        const current = model.rotationZ
                        actions.updateKeycapModel(model.id, { rotationZ: (current + 90) % 360 })
                      }}
                    >
                      +90°
                    </button>
                  </div>
                  <div class="text-xs text-slate-500 text-center">{model.rotationZ}°</div>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </section>

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4">
    <div class="text-sm font-semibold">3D Preview</div>
    <div class="mt-3 h-96 rounded-lg border border-slate-800 overflow-hidden">
      {#if !model}
        <div class="flex h-full items-center justify-center text-sm text-slate-400">
          Create/select a model to preview
        </div>
      {:else if modelStlUrl || modelStlBuffer}
        <Model3DViewer
          stlUrl={modelStlUrl}
          stlBuffer={modelStlBuffer}
          rotationX={model.rotationX}
          rotationY={model.rotationY}
          rotationZ={model.rotationZ}
        />
      {:else}
        <div class="flex h-full items-center justify-center text-sm text-slate-400">
          Upload or select an STL file to preview
        </div>
      {/if}
    </div>
  </section>
</div>
