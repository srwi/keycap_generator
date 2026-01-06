<script lang="ts">
  import { app, actions } from '../state/store'
  import { stlBuffersByModelId } from '../state/sessionAssets'
  import { getStlDimensions } from '../generate/stl'
  import { showConfirm } from '../state/modalStore'
  import { Trash2, Plus } from 'lucide-svelte'
  import { getPublicPath } from '../utils/paths'
  import { onMount } from 'svelte'
  import HelpTooltip from './HelpTooltip.svelte'
  import Model3DViewer from './Model3DViewer.svelte'

  type KeycapEntry = {
    path: string
    displayName: string
    author: string
    authorLink: string
    license: string
  }

  type Category = {
    name: string
    keycaps: KeycapEntry[]
  }

  type Registry = {
    categories: Category[]
  }

  let registry: Registry | null = null

  function extractPathFromUrl(url: string): string | null {
    const baseUrl = getPublicPath('stls/')
    if (url.startsWith(baseUrl)) {
      return url.slice(baseUrl.length)
    }
    const stlsIndex = url.indexOf('stls/')
    if (stlsIndex !== -1) {
      return url.slice(stlsIndex + 5)
    }
    return null
  }

  function findKeycapByPath(path: string): { category: string; keycap: KeycapEntry } | null {
    if (!registry) return null
    for (const category of registry.categories) {
      const keycap = category.keycaps.find(k => k.path === path)
      if (keycap) {
        return { category: category.name, keycap }
      }
    }
    return null
  }

  onMount(async () => {
    try {
      const response = await fetch(getPublicPath('stls/registry.json'))
      registry = await response.json()
    } catch (err) {
      console.error('Failed to load STL registry:', err)
    }
  })

  $: selectedId = $app.ui.selectedKeycapModelId
  $: model = selectedId ? ($app.keycapModels.find(m => m.id === selectedId) ?? null) : null

  // Derive selected category and keycap from the current model's URL
  $: selectedKeycapInfo = (() => {
    if (!model || !registry || model.source.kind !== 'server') return null
    const path = extractPathFromUrl(model.source.url)
    return path ? findKeycapByPath(path) : null
  })()

  $: selectedCategory = selectedKeycapInfo?.category ?? registry?.categories[0]?.name ?? ''
  $: selectedKeycapPath = selectedKeycapInfo?.keycap.path ?? registry?.categories[0]?.keycaps[0]?.path ?? ''

  $: categories = registry ? registry.categories.map(c => c.name) : []
  $: selectedCategoryData = registry ? registry.categories.find(c => c.name === selectedCategory) : null
  $: keycapsInCategory = selectedCategoryData ? selectedCategoryData.keycaps : []
  $: selectedKeycap = selectedKeycapInfo?.keycap ?? null

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
      showConfirm(
        `Model "${model.name}" is used by ${usedByTemplateCount} template(s) and ${usedByKeyCount} key(s).\n\nDeleting it will remove those templates and keys.\n\nDelete model?`,
        () => {
          stlBuffersByModelId.update(m => {
            const next = { ...m }
            delete next[model.id]
            return next
          })
          actions.deleteKeycapModel(model.id)
        }
      )
      return
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

  function applyServerModel(keycapPath: string) {
    if (!model || !registry) return
    const found = findKeycapByPath(keycapPath)
    if (!found) return

    const entry = found.keycap
    const url = getPublicPath(`stls/${entry.path}`)
    const serverId = entry.path.replace(/[^a-zA-Z0-9]/g, '_')

    actions.renameKeycapModel(model.id, entry.displayName)
    actions.updateKeycapModel(model.id, { rotationX: 0, rotationY: 0, rotationZ: 0 })
    actions.setKeycapModelSource(model.id, {
      kind: 'server',
      serverId: serverId,
      url: url,
      stl: { fileName: entry.path.split('/').pop() || `${entry.displayName}.stl`, pathHint: `server:${serverId}` },
    })

    // Reset to 0 so reactive statement will reload dimensions
    actions.updateKeycapModel(model.id, { widthMm: 0, heightMm: 0 })
  }

  function onCategoryChange(category: string) {
    if (!model || !registry) return
    const categoryData = registry.categories.find(c => c.name === category)
    if (!categoryData || categoryData.keycaps.length === 0) return

    // Check if current keycap is in new category
    const currentInCategory = categoryData.keycaps.find(k => k.path === selectedKeycapPath)
    const keycapPath = currentInCategory ? currentInCategory.path : categoryData.keycaps[0].path

    applyServerModel(keycapPath)
  }

  function onKeycapChange(keycapPath: string) {
    if (model) {
      applyServerModel(keycapPath)
    }
  }
</script>

<div class="grid gap-4 lg:grid-cols-12">
  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4">
    <div class="flex items-center justify-between gap-3 min-h-[2rem]">
      <div class="flex items-center gap-2">
        <div class="text-sm font-semibold">Models</div>
        <HelpTooltip
          text="A model defines the 3D shape and size of a keycap (e.g., 1u, 1.25u, 2u, 6.25u space bar). Different models represent different key sizes. Each model specifies the physical dimensions that affect how labels are positioned and scaled on the keycap surface."
        />
      </div>
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!model}
          on:click={onDeleteModel}
          title="Delete model"
        >
          <Trash2 class="h-4 w-4" />
          <span>Delete</span>
        </button>
        <button
          class="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800"
          on:click={actions.createKeycapModel}
          title="New model"
        >
          <Plus class="h-4 w-4" />
          <span>New</span>
        </button>
      </div>
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
  </section>

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-4">
    <div class="flex items-center min-h-[2rem]">
      <div class="text-sm font-semibold">Model configuration</div>
    </div>

    {#if !model}
      <div class="mt-3 flex items-center justify-center h-64 text-sm text-slate-400">
        Create/select a model to edit.
      </div>
    {:else}
      <div class="mt-3 grid gap-3">
        <label class="grid gap-1 text-xs text-slate-400">
          Name
          <input
            class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={model.name}
            on:input={e => actions.renameKeycapModel(model.id, (e.currentTarget as HTMLInputElement).value)}
          />
        </label>

        <label class="grid gap-1 text-xs text-slate-400">
          <div class="flex items-center gap-2">
            <span>Symbol extrusion depth (mm)</span>
            <HelpTooltip
              text="The depth at which text is extruded into the keycap surface. Higher values result in deeper engraving. Setting this too high may cause the text to break through to the inside of the keycap. When printing on the top surface, use a multiple of your layer height."
            />
          </div>
          <input
            class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            type="number"
            min="0.1"
            step="0.1"
            value={model.extrusionDepthMm}
            on:input={e =>
              actions.updateKeycapModel(model.id, {
                extrusionDepthMm: Number((e.currentTarget as HTMLInputElement).value),
              })}
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
                    if (model.source.kind !== 'server' && registry && selectedKeycapPath) {
                      // Clear uploaded buffer when switching to server mode
                      if (model.source.kind === 'upload') {
                        stlBuffersByModelId.update(m => {
                          const next = { ...m }
                          delete next[model.id]
                          return next
                        })
                      }
                      applyServerModel(selectedKeycapPath)
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
              {#if registry}
                <div class="grid gap-2">
                  <div class="grid grid-cols-2 gap-2">
                    <label class="grid gap-1 text-xs text-slate-400">
                      Category
                      <select
                        class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                        value={selectedCategory}
                        on:change={e => onCategoryChange((e.currentTarget as HTMLSelectElement).value)}
                      >
                        {#each categories as cat}
                          <option value={cat}>{cat}</option>
                        {/each}
                      </select>
                    </label>
                    <label class="grid gap-1 text-xs text-slate-400">
                      Keycap
                      <select
                        class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                        value={selectedKeycapPath}
                        on:change={e => onKeycapChange((e.currentTarget as HTMLSelectElement).value)}
                      >
                        {#each keycapsInCategory as keycap}
                          <option value={keycap.path}>{keycap.displayName}</option>
                        {/each}
                      </select>
                    </label>
                  </div>
                  {#if selectedKeycap}
                    <div class="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-400">
                      {#if selectedKeycap.author}
                        <div class="mb-1">
                          Author:
                          {#if selectedKeycap.authorLink}
                            <a
                              href={selectedKeycap.authorLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-blue-400 hover:text-blue-300 underline"
                            >
                              {selectedKeycap.author}
                            </a>
                          {:else}
                            <span class="text-slate-300">{selectedKeycap.author}</span>
                          {/if}
                        </div>
                      {/if}
                      {#if selectedKeycap.license}
                        <div>
                          License: <span class="text-slate-300">{selectedKeycap.license}</span>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {:else}
                <div class="text-xs text-slate-500">Loading registry...</div>
              {/if}
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
            <div class="flex items-center gap-2">
              <div class="text-xs font-semibold text-slate-300">Model Orientation</div>
              <HelpTooltip
                text="The model must be oriented with its face pointing forward (towards the camera) so that labels are correctly positioned and extruded into the keycap surface. If the model is rotated incorrectly, the text will appear on the wrong side or be extruded in the wrong direction when generating the final keycap."
              />
            </div>
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
    <div class="flex items-center justify-between gap-3 min-h-[2rem]">
      <div class="flex items-center gap-2">
        <div class="text-sm font-semibold">Preview</div>
        <HelpTooltip
          text="Preview the 3D model shape and orientation. This helps verify that uploaded models are correctly oriented before generating keycaps."
        />
      </div>
    </div>
    <div class="mt-3">
      {#if !model}
        <div class="flex items-center justify-center h-64 text-sm text-slate-400">Select a model to preview</div>
      {:else if modelStlUrl || modelStlBuffer}
        <div class="h-96 overflow-hidden">
          {#key model.id}
            <Model3DViewer
              stlUrl={modelStlUrl}
              stlBuffer={modelStlBuffer}
              rotationX={model.rotationX}
              rotationY={model.rotationY}
              rotationZ={model.rotationZ}
            />
          {/key}
        </div>
      {:else}
        <div class="flex items-center justify-center h-64 text-sm text-slate-400">
          Upload or select an STL file to preview
        </div>
      {/if}
    </div>
  </section>
</div>
