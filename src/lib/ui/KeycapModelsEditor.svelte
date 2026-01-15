<script lang="ts">
  import { app, actions } from '../state/store'
  import { stlBuffersByModelId } from '../state/sessionAssets'
  import { getStlDimensions } from '../generate/stl'
  import { fetchStlDimensions } from '../services/stlDimensions'
  import { extractPathFromUrl, findKeycapByPath, loadStlRegistry, type Registry } from '../services/stlRegistry'
  import { showConfirm } from '../state/modalStore'
  import { X, Plus, RotateCcw, RotateCw } from 'lucide-svelte'
  import { getPublicPath } from '../utils/paths'
  import { onMount } from 'svelte'
  import HelpTooltip from './HelpTooltip.svelte'
  import Model3DViewer from './Model3DViewer.svelte'
  import { Button } from '@/lib/components/ui/button'
  import { ButtonGroup } from '@/lib/components/ui/button-group'
  import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card'
  import { Field, FieldGroup, FieldLabel } from '@/lib/components/ui/field'
  import { Input } from '@/lib/components/ui/input'
  import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/lib/components/ui/item'
  import { Label } from '@/lib/components/ui/label'
  import { RadioGroup, RadioGroupItem } from '@/lib/components/ui/radio-group'
  import { ScrollArea } from '@/lib/components/ui/scroll-area'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/lib/components/ui/select'

  let registry: Registry | null = null

  onMount(async () => {
    try {
      registry = await loadStlRegistry()
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
    return path ? findKeycapByPath(registry, path) : null
  })()

  $: selectedCategory = selectedKeycapInfo?.category ?? registry?.categories[0]?.name ?? ''
  $: selectedKeycapPath = selectedKeycapInfo?.keycap.path ?? registry?.categories[0]?.keycaps[0]?.path ?? ''

  $: categories = registry ? registry.categories.map(c => c.name) : []
  $: selectedCategoryData = registry ? registry.categories.find(c => c.name === selectedCategory) : null
  $: keycapsInCategory = selectedCategoryData ? selectedCategoryData.keycaps : []
  $: selectedKeycap = selectedKeycapInfo?.keycap ?? null

  let categoryValue: string = ''
  let keycapPathValue: string = ''
  let prevSelectedCategory: string | null = null
  let prevSelectedKeycapPath: string | null = null
  $: if (selectedCategory !== prevSelectedCategory) {
    prevSelectedCategory = selectedCategory
    categoryValue = selectedCategory
  }
  $: if (selectedKeycapPath !== prevSelectedKeycapPath) {
    prevSelectedKeycapPath = selectedKeycapPath
    keycapPathValue = selectedKeycapPath
  }
  $: if (categoryValue && categoryValue !== selectedCategory) {
    onCategoryChange(categoryValue)
  }
  $: if (keycapPathValue && keycapPathValue !== selectedKeycapPath) {
    onKeycapChange(keycapPathValue)
  }

  let stlSourceKind: 'server' | 'upload' = 'server'
  let prevStlSourceKind: 'server' | 'upload' | null = null
  $: if (model && model.source.kind !== prevStlSourceKind) {
    prevStlSourceKind = model.source.kind
    stlSourceKind = model.source.kind
  }

  function onStlSourceKindChange(next: 'server' | 'upload') {
    if (!model) return
    if (next === model.source.kind) return

    if (next === 'server') {
      if (registry && selectedKeycapPath) {
        // Clear uploaded buffer when switching to server mode
        if (model.source.kind === 'upload') {
          stlBuffersByModelId.update(m => {
            const nextMap = { ...m }
            delete nextMap[model.id]
            return nextMap
          })
        }
        applyServerModel(selectedKeycapPath)
      }
      return
    }

    onSwitchToUpload()
  }

  $: if (model?.source.kind === 'server' && (model.widthMm === 0 || model.heightMm === 0)) {
    fetchStlDimensions(model.source.url)
      .then(({ widthMm, heightMm }) => actions.updateKeycapModel(model.id, { widthMm, heightMm }))
      .catch(err => console.error('Failed to load server STL dimensions:', err))
  }

  $: modelStlUrl = model?.source.kind === 'server' ? model.source.url : null
  $: modelStlBuffer = model?.source.kind === 'upload' && model ? ($stlBuffersByModelId[model.id] ?? null) : null

  function deleteModelById(modelId: string) {
    const m = $app.keycapModels.find(m => m.id === modelId)
    if (!m) return

    const usedByTemplateCount = $app.templates.filter(t => t.keycapModelId === m.id).length
    const usedByKeyCount = $app.keys.filter(k => {
      const t = $app.templates.find(tpl => tpl.id === k.templateId)
      return t?.keycapModelId === m.id
    }).length

    const performDelete = () => {
      stlBuffersByModelId.update(map => {
        const next = { ...map }
        delete next[m.id]
        return next
      })
      actions.deleteKeycapModel(m.id)
    }

    if (usedByTemplateCount > 0) {
      showConfirm(
        `Model "${m.name}" is used by ${usedByTemplateCount} template(s) and ${usedByKeyCount} key(s).\n\nDeleting it will remove those templates and keys.\n\nDelete model?`,
        performDelete
      )
      return
    }

    performDelete()
  }

  function onRowKeydown(ev: KeyboardEvent, action: () => void) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault()
      action()
    }
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
    const found = findKeycapByPath(registry, keycapPath)
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
  <Card class="lg:col-span-4 lg:h-[calc(100vh-20rem)] lg:min-h-[24rem] flex flex-col">
    <CardHeader class="border-b">
      <div class="flex items-center justify-between gap-3 min-h-8">
        <div class="flex items-center gap-2 min-w-0">
          <CardTitle class="text-base">Models</CardTitle>
          <HelpTooltip
            text="A model defines the 3D shape and size of a keycap (e.g., 1u, 1.25u, 2u, 6.25u space bar). Different models represent different key sizes. Each model specifies the physical dimensions that affect how labels are positioned and scaled on the keycap surface."
          />
        </div>
        <Button size="sm" onclick={actions.createKeycapModel} title="New model">
          <Plus class="size-4" />
          <span class="hidden sm:inline">New</span>
        </Button>
      </div>
    </CardHeader>

    <CardContent class="flex-1 min-h-0 px-1">
      <ScrollArea class="lg:h-full w-full min-h-0 px-3">
        {#if $app.keycapModels.length === 0}
          <div class="flex items-center justify-center h-64 text-sm text-muted-foreground">No models created yet.</div>
        {:else}
          <div class="grid gap-2 px-1 py-6">
            {#each $app.keycapModels as m (m.id)}
              <Item size="sm" variant={selectedId === m.id ? 'muted' : 'outline'} class="w-full justify-between">
                {#snippet child({ props })}
                  <div
                    {...props}
                    class={(props.class as string) + ' w-full flex items-center gap-2'}
                    role="button"
                    tabindex="0"
                    onclick={() => actions.selectKeycapModel(m.id)}
                    onkeydown={(ev: KeyboardEvent) => onRowKeydown(ev, () => actions.selectKeycapModel(m.id))}
                  >
                    <ItemContent class="min-w-0 flex-1">
                      <ItemTitle class="truncate">{m.name}</ItemTitle>
                      <ItemDescription class="truncate">
                        {m.widthMm.toFixed(1)}mm × {m.heightMm.toFixed(1)}mm
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions class="ms-auto">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="text-foreground/70 hover:text-foreground hover:bg-muted"
                        title="Delete model"
                        onclick={(ev: MouseEvent) => {
                          ev.preventDefault()
                          ev.stopPropagation()
                          deleteModelById(m.id)
                        }}
                      >
                        <X class="size-4" />
                      </Button>
                    </ItemActions>
                  </div>
                {/snippet}
              </Item>
            {/each}
          </div>
        {/if}
      </ScrollArea>
    </CardContent>
  </Card>

  <Card class="lg:col-span-4 lg:h-[calc(100vh-20rem)] lg:min-h-[24rem] flex flex-col">
    <CardHeader class="border-b">
      <div class="flex items-center justify-between gap-3 min-h-8">
        <CardTitle class="text-base">Model configuration</CardTitle>
      </div>
    </CardHeader>

    <CardContent class="flex-1 min-h-0 px-1">
      <ScrollArea class="lg:h-full w-full min-h-0 px-3">
        {#if !model}
          <div class="flex items-center justify-center h-64 text-sm text-muted-foreground">
            Select a model to configure.
          </div>
        {:else}
          {@const modelNameId = `model-${model.id}-name`}
          {@const extrusionDepthId = `model-${model.id}-extrusion-depth`}
          {@const stlSourceServerId = `stl-source-${model.id}-server`}
          {@const stlSourceUploadId = `stl-source-${model.id}-upload`}
          {@const categoryId = `model-${model.id}-category`}
          {@const keycapId = `model-${model.id}-keycap`}

          <FieldGroup class="py-5">
            <Field>
              <FieldLabel for={modelNameId}>Name</FieldLabel>
              <Input
                id={modelNameId}
                value={model.name}
                oninput={e => actions.renameKeycapModel(model.id, (e.currentTarget as HTMLInputElement).value)}
              />
            </Field>

            <Field>
              <FieldLabel for={extrusionDepthId}>
                Symbol extrusion depth (mm)
                <HelpTooltip
                  text="The depth at which text is extruded into the keycap surface. Higher values result in deeper engraving. Setting this too high may cause the text to break through to the inside of the keycap. When printing on the top surface, use a multiple of your layer height."
                />
              </FieldLabel>
              <Input
                id={extrusionDepthId}
                type="number"
                min="0.1"
                step="0.1"
                value={model.extrusionDepthMm}
                oninput={e =>
                  actions.updateKeycapModel(model.id, {
                    extrusionDepthMm: Number((e.currentTarget as HTMLInputElement).value),
                  })}
              />
            </Field>

            <div class="grid gap-3">
              <div class="text-sm font-medium">STL source</div>

              <div class="card-box grid gap-2 p-3">
                <RadioGroup
                  bind:value={stlSourceKind}
                  onValueChange={(next: string) => onStlSourceKindChange(next as 'server' | 'upload')}
                  class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div class="flex items-center gap-3">
                    <RadioGroupItem value="server" id={stlSourceServerId} />
                    <Label for={stlSourceServerId}>From server</Label>
                  </div>
                  <div class="flex items-center gap-3">
                    <RadioGroupItem value="upload" id={stlSourceUploadId} />
                    <Label for={stlSourceUploadId}>Upload file</Label>
                  </div>
                </RadioGroup>

                {#if model.source.kind === 'server'}
                  {#if registry}
                    <div class="grid gap-2">
                      <div class="grid grid-cols-2 gap-2">
                        <Field>
                          <FieldLabel for={categoryId}>Category</FieldLabel>
                          <Select type="single" bind:value={categoryValue}>
                            <SelectTrigger id={categoryId} class="w-full" data-placeholder={!categoryValue}>
                              <SelectValue placeholder="Select a category" value={categoryValue || null} />
                            </SelectTrigger>
                            <SelectContent class="w-full">
                              {#each categories as cat}
                                <SelectItem value={cat} label={cat} />
                              {/each}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field>
                          <FieldLabel for={keycapId}>Keycap</FieldLabel>
                          <Select type="single" bind:value={keycapPathValue}>
                            <SelectTrigger id={keycapId} class="w-full" data-placeholder={!keycapPathValue}>
                              <SelectValue
                                placeholder="Select a keycap"
                                value={keycapsInCategory.find(k => k.path === keycapPathValue)?.displayName ?? null}
                              />
                            </SelectTrigger>
                            <SelectContent class="w-full">
                              {#each keycapsInCategory as keycap}
                                <SelectItem value={keycap.path} label={keycap.displayName} />
                              {/each}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                      {#if selectedKeycap}
                        <div class="mt-2 pt-2 border-t text-xs text-muted-foreground">
                          {#if selectedKeycap.author}
                            <div class="mb-1">
                              Author:
                              {#if selectedKeycap.authorLink}
                                <a
                                  href={selectedKeycap.authorLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  class="text-primary hover:text-primary/90 underline"
                                >
                                  {selectedKeycap.author}
                                </a>
                              {:else}
                                <span class="text-foreground">{selectedKeycap.author}</span>
                              {/if}
                            </div>
                          {/if}
                          {#if selectedKeycap.license}
                            <div>
                              License: <span class="text-foreground">{selectedKeycap.license}</span>
                            </div>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {:else}
                    <div class="text-xs text-muted-foreground">Loading registry...</div>
                  {/if}
                {:else}
                  <Field>
                    <FieldLabel for="file-input-{model.id}">Choose STL file</FieldLabel>
                    <div class="flex items-center gap-2">
                      <input
                        id="file-input-{model.id}"
                        class="hidden"
                        type="file"
                        accept=".stl,model/stl"
                        onchange={onUploadStl}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onclick={() => {
                          const fileInput = document.getElementById(`file-input-${model.id}`) as HTMLInputElement
                          fileInput?.click()
                        }}
                      >
                        Browse...
                      </Button>
                      {#if model.source.stl?.fileName}
                        <span class="text-xs text-foreground truncate flex-1">
                          {model.source.stl.fileName}
                        </span>
                      {:else}
                        <span class="text-xs text-muted-foreground">No file selected</span>
                      {/if}
                    </div>
                  </Field>
                {/if}
              </div>
            </div>

            {#if model.source.kind === 'upload' && model.source.stl}
              <div class="grid gap-3">
                <div class="flex items-center gap-2">
                  <div class="text-sm font-medium">Model Orientation</div>
                  <HelpTooltip
                    text="The model must be oriented with its face pointing forward (towards the camera) so that labels are correctly positioned and extruded into the keycap surface. If the model is rotated incorrectly, the text will appear on the wrong side or be extruded in the wrong direction when generating the final keycap."
                  />
                </div>
                <div class="card-box grid gap-2 p-3">
                  <div class="text-xs text-muted-foreground mb-1">
                    Rotate the model until the face points towards the camera.
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <div class="grid gap-1">
                      <div class="text-xs text-muted-foreground text-center">X-axis</div>
                      <ButtonGroup class="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          class="flex-1"
                          title="-90°"
                          onclick={() => {
                            const current = model.rotationX
                            actions.updateKeycapModel(model.id, { rotationX: (current - 90 + 360) % 360 })
                          }}
                        >
                          <RotateCcw class="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          class="flex-1"
                          title="+90°"
                          onclick={() => {
                            const current = model.rotationX
                            actions.updateKeycapModel(model.id, { rotationX: (current + 90) % 360 })
                          }}
                        >
                          <RotateCw class="size-4" />
                        </Button>
                      </ButtonGroup>
                      <div class="text-xs text-muted-foreground text-center">{model.rotationX}°</div>
                    </div>
                    <div class="grid gap-1">
                      <div class="text-xs text-muted-foreground text-center">Y-axis</div>
                      <ButtonGroup class="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          class="flex-1"
                          title="-90°"
                          onclick={() => {
                            const current = model.rotationY
                            actions.updateKeycapModel(model.id, { rotationY: (current - 90 + 360) % 360 })
                          }}
                        >
                          <RotateCcw class="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          class="flex-1"
                          title="+90°"
                          onclick={() => {
                            const current = model.rotationY
                            actions.updateKeycapModel(model.id, { rotationY: (current + 90) % 360 })
                          }}
                        >
                          <RotateCw class="size-4" />
                        </Button>
                      </ButtonGroup>
                      <div class="text-xs text-muted-foreground text-center">{model.rotationY}°</div>
                    </div>
                    <div class="grid gap-1">
                      <div class="text-xs text-muted-foreground text-center">Z-axis</div>
                      <ButtonGroup class="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          class="flex-1"
                          title="-90°"
                          onclick={() => {
                            const current = model.rotationZ
                            actions.updateKeycapModel(model.id, { rotationZ: (current - 90 + 360) % 360 })
                          }}
                        >
                          <RotateCcw class="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          class="flex-1"
                          title="+90°"
                          onclick={() => {
                            const current = model.rotationZ
                            actions.updateKeycapModel(model.id, { rotationZ: (current + 90) % 360 })
                          }}
                        >
                          <RotateCw class="size-4" />
                        </Button>
                      </ButtonGroup>
                      <div class="text-xs text-muted-foreground text-center">{model.rotationZ}°</div>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          </FieldGroup>
        {/if}
      </ScrollArea>
    </CardContent>
  </Card>

  <Card class="lg:col-span-4 flex flex-col">
    <CardHeader class="border-b">
      <div class="flex items-center justify-between gap-3 min-h-8">
        <div class="flex items-center gap-2 min-w-0">
          <CardTitle class="text-base">Preview</CardTitle>
          <HelpTooltip
            text="Preview the 3D model shape and orientation. This helps verify that uploaded models are correctly oriented before generating keycaps."
          />
        </div>
      </div>
    </CardHeader>
    <CardContent class="px-4 py-5">
      {#if (modelStlUrl || modelStlBuffer) && model}
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
        <div class="flex items-center justify-center h-54 text-sm text-muted-foreground">
          Select a model to preview.
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
