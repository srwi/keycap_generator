<script lang="ts">
  import { onMount } from 'svelte'
  import { app, actions, isProjectEmpty } from '../state/store'
  import { applyLoadedProject } from '../state/persistence'
  import { stlBuffersByModelId } from '../state/sessionAssets'
  import { showConfirm, showMessage } from '../state/modalStore'
  import {
    loadStlRegistry,
    matchesKeycapSize,
    extractPathFromUrl,
    findKeycapByPath,
    type Registry,
    type KeycapEntry,
  } from '../services/stlRegistry'
  import { fetchStlDimensions } from '../services/stlDimensions'
  import { parseLenientJson, deserializeKle } from '../services/kle/kleParser'
  import { convertKleToProject, uToMm } from '../services/kle/kleToAppProject'
  import type { KleKey, KleKeyboard } from '../services/kle/kleTypes'
  import type { KeycapModel } from '../state/types'
  import { newId } from '../utils/id'
  import { getPublicPath } from '../utils/paths'

  import HelpTooltip from './HelpTooltip.svelte'
  import KleCanvas from './kle/KleCanvas.svelte'
  import StlSourcePicker from './StlSourcePicker.svelte'

  import { Button } from '@/lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card'
  import { ScrollArea } from '@/lib/components/ui/scroll-area'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/lib/components/ui/select'
  import { Upload, FileCode, AlertTriangle, ArrowLeft, Wand2 } from 'lucide-svelte'

  export let onClose: () => void

  let registry: Registry | null = null
  let rawJsonText = ''
  let parseError: string | null = null
  let parsedKeyboard: KleKeyboard | null = null
  let assignedModelByKeyId: Record<string, KeycapModel | null> = {}
  let selectedKeyIds: Set<string> = new Set()

  // Flow mode: 'setup' (choice between auto-assign and from-scratch) vs 'inspector' (detailed editing)
  let flowMode: 'setup' | 'inspector' = 'setup'
  let selectedProfileCategory = ''

  // Custom models created via upload during this session
  let customModels: KeycapModel[] = []
  let customBuffersByModelId: Record<string, ArrayBuffer> = {}

  onMount(async () => {
    try {
      registry = await loadStlRegistry()
      if (registry && registry.categories.length > 0 && !selectedProfileCategory) {
        selectedProfileCategory = registry.categories[0].name
      }
    } catch (e) {
      console.error('Failed to load STL registry:', e)
    }
  })

  function handleParse() {
    parseError = null
    try {
      const parsedObj = parseLenientJson(rawJsonText)
      if (!Array.isArray(parsedObj)) {
        throw new Error('The KLE layout must be an array of rows.')
      }

      const kbd = deserializeKle(parsedObj)
      if (kbd.keys.length === 0) {
        throw new Error('No keys were found in the layout.')
      }

      parsedKeyboard = kbd
      serverModelsByPath.clear()
      assignedModelByKeyId = {}
      customModels = []
      customBuffersByModelId = {}
      selectedKeyIds = new Set()
      flowMode = 'setup'
      selectedProfileCategory = registry?.categories?.[0]?.name ?? ''
    } catch (err) {
      parseError = err instanceof Error ? err.message : 'Invalid KLE format.'
    }
  }

  async function handleFileUpload(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    try {
      rawJsonText = await file.text()
      handleParse()
    } catch {
      parseError = 'Failed to read file.'
    }
  }

  // Active selection properties
  $: activeKey = parsedKeyboard?.keys.find(k => selectedKeyIds.has(k.id)) ?? null
  $: activeSize = activeKey ? { width: activeKey.width, height: activeKey.height } : null

  // All keys with the same size as current selection
  $: sameSizeKeys =
    parsedKeyboard && activeSize
      ? parsedKeyboard.keys.filter(k => k.width === activeSize.width && k.height === activeSize.height)
      : []
  $: isAllOfSizeSelected = sameSizeKeys.length > 0 && sameSizeKeys.every(k => selectedKeyIds.has(k.id))

  function createServerModel(entry: KeycapEntry, categoryName: string): KeycapModel {
    const serverId = entry.path.replace(/[^a-zA-Z0-9]/g, '_')
    const url = getPublicPath(`stls/${entry.path}`)
    return {
      id: newId('model'),
      name: `${entry.displayName} (${categoryName})`,
      widthMm: uToMm(entry.uWidth),
      heightMm: uToMm(entry.uHeight),
      source: {
        kind: 'server',
        serverId,
        url,
        stl: {
          fileName: entry.path.split('/').pop() || `${entry.displayName}.stl`,
          pathHint: `server:${serverId}`,
        },
      },
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      extrusionDepthMm: 1.4,
    }
  }

  // Reusable registry models by path to keep IDs stable within import session
  const serverModelsByPath = new Map<string, KeycapModel>()

  function getOrCreateServerModel(entry: KeycapEntry, categoryName: string): KeycapModel {
    let sm = serverModelsByPath.get(entry.path)
    if (!sm) {
      sm = createServerModel(entry, categoryName)
      serverModelsByPath.set(entry.path, sm)
    }
    return sm
  }

  $: selectionModelsInfo = ((): {
    allSame: boolean
    firstModel: KeycapModel | null
  } => {
    if (selectedKeyIds.size === 0) {
      return { allSame: true, firstModel: null }
    }
    const selectedArr = Array.from(selectedKeyIds)
    const firstModel = assignedModelByKeyId[selectedArr[0]] ?? null
    const allSame = selectedArr.every(id => (assignedModelByKeyId[id]?.id ?? null) === (firstModel?.id ?? null))

    return {
      allSame,
      firstModel: allSame ? firstModel : null,
    }
  })()

  $: currentAssignedModel = selectionModelsInfo.allSame ? selectionModelsInfo.firstModel : null
  $: currentSelectionSourceKind = (currentAssignedModel?.source.kind === 'upload' ? 'upload' : 'server') as
    | 'server'
    | 'upload'
  $: currentSelectionKeycapInfo = (() => {
    if (!currentAssignedModel || !registry || currentAssignedModel.source.kind !== 'server') return null
    const path = extractPathFromUrl(currentAssignedModel.source.url)
    return path ? findKeycapByPath(registry, path) : null
  })()
  $: currentSelectionCategory = (() => {
    if (currentSelectionKeycapInfo?.category) return currentSelectionKeycapInfo.category
    if (!registry) return ''
    if (!activeSize) return selectedProfileCategory || registry.categories[0]?.name || ''
    if (selectedProfileCategory) {
      const prefCat = registry.categories.find(c => c.name === selectedProfileCategory)
      if (
        prefCat?.keycaps.some(
          kc => matchesKeycapSize(kc.uWidth, kc.uHeight, activeSize.width, activeSize.height)
        )
      ) {
        return selectedProfileCategory
      }
    }
    const matchingCat = registry.categories.find(c =>
      c.keycaps.some(
        kc => matchesKeycapSize(kc.uWidth, kc.uHeight, activeSize.width, activeSize.height)
      )
    )
    return matchingCat?.name || ''
  })()
  $: currentSelectionKeycapPath = currentSelectionKeycapInfo?.keycap.path || ''
  $: currentSelectionUploadedFileName =
    currentAssignedModel?.source.kind === 'upload'
      ? currentAssignedModel.source.stl?.fileName || currentAssignedModel.name
      : null

  function handleKeyClick(key: KleKey) {
    if (flowMode === 'setup') {
      flowMode = 'inspector'
    }
    if (!activeSize || key.width !== activeSize.width || key.height !== activeSize.height) {
      selectedKeyIds = new Set([key.id])
    } else {
      const next = new Set(selectedKeyIds)
      if (next.has(key.id)) {
        next.delete(key.id)
      } else {
        next.add(key.id)
      }
      selectedKeyIds = next
    }
  }

  function handleSelectSizeGroup(width: number, height: number) {
    if (!parsedKeyboard) return
    if (flowMode === 'setup') {
      flowMode = 'inspector'
    }
    const matchingKeys = parsedKeyboard.keys.filter(k => k.width === width && k.height === height)
    selectedKeyIds = new Set(matchingKeys.map(k => k.id))
  }

  function handleClearSelection() {
    selectedKeyIds = new Set()
  }

  function handleSelectServerKeycap({ keycap, category }: { keycap: KeycapEntry; category: string }) {
    if (selectedKeyIds.size === 0) return
    selectedProfileCategory = category
    const model = getOrCreateServerModel(keycap, category)
    const next = { ...assignedModelByKeyId }
    for (const id of selectedKeyIds) {
      next[id] = model
    }
    assignedModelByKeyId = next
  }

  function handleUploadCustomStl({
    file,
    buffer,
    widthMm,
    heightMm,
  }: {
    file: File
    buffer: ArrayBuffer
    widthMm: number
    heightMm: number
  }) {
    if (selectedKeyIds.size === 0 || !activeSize) return
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    const modelId = newId('model')
    const model: KeycapModel = {
      id: modelId,
      name: fileNameWithoutExt,
      widthMm: widthMm > 0 ? widthMm : uToMm(activeSize.width),
      heightMm: heightMm > 0 ? heightMm : uToMm(activeSize.height),
      source: {
        kind: 'upload',
        stl: { fileName: file.name, pathHint: `upload:${file.name}` },
      },
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      extrusionDepthMm: 1.4,
    }
    customModels = [...customModels, model]
    customBuffersByModelId[model.id] = buffer

    const next = { ...assignedModelByKeyId }
    for (const id of selectedKeyIds) {
      next[id] = model
    }
    assignedModelByKeyId = next
  }


  // Auto-assign all keys in layout from a registry category
  function handleAutoAssignCategory(categoryName: string) {
    if (!categoryName || !registry || !parsedKeyboard) return
    const cat = registry.categories.find(c => c.name === categoryName)
    if (!cat) return

    // Distinct Y rows sorted top-to-bottom for Sculpted R1..R4 heuristic
    const distinctRows = Array.from(new Set(parsedKeyboard.keys.map(k => Math.round(k.y * 4) / 4))).sort(
      (a, b) => a - b
    )

    const next = { ...assignedModelByKeyId }
    for (const k of parsedKeyboard.keys) {
      const candidates = cat.keycaps.filter(kc => matchesKeycapSize(kc.uWidth, kc.uHeight, k.width, k.height))
      if (candidates.length === 0) continue

      let chosen = candidates[0]
      if (candidates.length > 1) {
        const hasR5InCat = cat.keycaps.some(c => c.displayName.startsWith('R5'))
        const profileMatch = k.profile?.match(/R([1-5])/i)
        let rowNum: number
        if (profileMatch) {
          rowNum = Number(profileMatch[1])
        } else {
          const rowIndex = distinctRows.indexOf(Math.round(k.y * 4) / 4)
          if (hasR5InCat) {
            // For 6-row layouts (F-row + Num + QWERTY + Home + Shift + Bottom), F-row & Num map to R1, then R2..R5
            if (distinctRows.length >= 6) {
              rowNum = rowIndex === 0 ? 1 : Math.min(5, rowIndex)
            } else {
              rowNum = Math.min(5, Math.max(1, rowIndex + 1))
            }
          } else {
            rowNum = Math.min(4, Math.max(1, rowIndex + 1))
          }
        }
        const rowPrefix = `R${rowNum}`
        const byRow = candidates.find(c => c.displayName.startsWith(rowPrefix))
        if (byRow) chosen = byRow
      }

      next[k.id] = getOrCreateServerModel(chosen, cat.name)
    }

    assignedModelByKeyId = next
    flowMode = 'inspector'
  }

  // Count assigned keys
  $: totalKeys = parsedKeyboard?.keys.length ?? 0
  $: assignedCount = parsedKeyboard ? parsedKeyboard.keys.filter(k => Boolean(assignedModelByKeyId[k.id])).length : 0

  function handleFinalizeImport() {
    if (!parsedKeyboard) return

    const unassigned = totalKeys - assignedCount
    const willReplaceExisting = !isProjectEmpty($app)

    const execute = () => {
      if (!parsedKeyboard) return
      const { project } = convertKleToProject(parsedKeyboard.keys, assignedModelByKeyId, customModels)

      // Apply project FIRST (since applyLoadedProject clears stlBuffersByModelId)
      applyLoadedProject(project)

      // Then store any uploaded STL buffers from this import session
      if (Object.keys(customBuffersByModelId).length > 0) {
        stlBuffersByModelId.set({ ...customBuffersByModelId })
      }

      // Asynchronously load exact STL dimensions for all server models
      for (const m of project.keycapModels) {
        if (m.source.kind === 'server') {
          fetchStlDimensions(m.source.url)
            .then(({ widthMm, heightMm }) => actions.updateKeycapModel(m.id, { widthMm, heightMm }))
            .catch(err => console.error('Failed to load server STL dimensions:', err))
        }
      }

      onClose()
      showMessage(
        `Imported ${project.keys.length} key(s), ${project.templates.length} template(s), and ${project.keycapModels.length} model(s).`
      )
    }

    const warnings: string[] = []
    if (unassigned > 0) {
      warnings.push(
        `${unassigned} of ${totalKeys} key(s) do not have a model assigned yet and will be created as upload placeholders without an STL file.`
      )
    }
    if (willReplaceExisting) {
      warnings.push('Importing this layout will replace your current project.')
    }

    if (warnings.length > 0) {
      showConfirm(`${warnings.join('\n\n')}\n\nContinue?`, execute)
    } else {
      execute()
    }
  }
</script>

<div class="flex flex-col gap-4 flex-1 min-h-0">
  <!-- Top Action Bar (matches Tabs + Generate bar in App.svelte) -->
  <div class="flex flex-wrap items-center gap-2">
    <Button variant="outline" onclick={onClose}>
      <ArrowLeft class="size-4" />
      Cancel
    </Button>

    {#if parsedKeyboard}
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <Button onclick={handleFinalizeImport}>
          Import ({assignedCount}/{totalKeys})
        </Button>
      </div>
    {/if}
  </div>

  <!-- Full-Width Workspace Card (spans all 12 columns of max-w-6xl) -->
  {#if !parsedKeyboard}
    <!-- STEP 1: Raw Data Input -->
    <Card class="lg:h-[calc(100vh-20rem)] lg:min-h-[26rem] flex flex-col">
      <CardHeader class="border-b">
        <div class="flex flex-wrap items-center justify-between gap-3 min-h-8">
          <div class="flex items-center gap-2 min-w-0">
            <CardTitle class="text-base">Import KLE Layout</CardTitle>
            <HelpTooltip
              text="Paste the Raw Data from keyboard-layout-editor.com or upload an exported KLE JSON file. In the next step, you can assign 3D keycap models to each key size."
            />
          </div>

          <input
            id="kle-json-upload-input"
            type="file"
            accept=".json,application/json"
            class="hidden"
            onchange={handleFileUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onclick={() => {
              const input = document.getElementById('kle-json-upload-input') as HTMLInputElement
              input?.click()
            }}
          >
            <Upload class="size-3.5" />
            Upload JSON...
          </Button>
        </div>
      </CardHeader>

      <CardContent class="flex-1 min-h-0 p-4 flex flex-col gap-3">
        <div class="text-xs text-muted-foreground">
          Paste the "Raw data" from
          <a
            href="https://www.keyboard-layout-editor.com"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:text-primary"
          >
            Keyboard Layout Editor
          </a>
          below, or upload a JSON file.
        </div>

        <textarea
          bind:value={rawJsonText}
          placeholder={'[\n  ["Esc", "1", "2", "3", ...],\n  ["Tab", "Q", "W", "E", ...]\n]'}
          class="flex-1 w-full min-h-[240px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        ></textarea>

        {#if parseError}
          <div class="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertTriangle class="size-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        {/if}

        <div class="flex justify-end pt-1">
          <Button onclick={handleParse} disabled={!rawJsonText.trim()}>Load Layout</Button>
        </div>
      </CardContent>
    </Card>
  {:else}
    <!-- STEP 2: 2-Column Split (Layout Left / Unified Inspector Sidebar Right) -->
    <div class="grid gap-4 lg:grid-cols-12 flex-1 min-h-0">
      <!-- LEFT: Keyboard Canvas Card (lg:col-span-8) -->
      <Card class="lg:col-span-8 lg:h-[calc(100vh-20rem)] lg:min-h-[28rem] flex flex-col">
        <CardHeader class="border-b">
          <div class="flex items-center justify-between gap-3 min-h-8">
            <div class="flex items-center gap-2 min-w-0">
              <CardTitle class="text-base">Keyboard Layout</CardTitle>
              {#if parsedKeyboard.meta.name}
                <span class="text-xs text-muted-foreground truncate max-w-[160px] sm:max-w-[240px]" title={parsedKeyboard.meta.name}>
                  ({parsedKeyboard.meta.name})
                </span>
              {/if}
              <HelpTooltip
                text="Select keys on the layout to assign them to 3D models. Click an individual key to select it, or use 'Select all of size' to select all keys with identical unit dimensions. Non-matching key sizes are dimmed to highlight your active selection."
              />
            </div>
            {#if selectedKeyIds.size > 0}
              <span class="text-xs text-muted-foreground">
                {selectedKeyIds.size} selected
              </span>
            {/if}
          </div>
        </CardHeader>

        <CardContent class="flex-1 min-h-0 p-0 flex flex-col overflow-hidden relative">
          <KleCanvas
            keys={parsedKeyboard.keys}
            {assignedModelByKeyId}
            {selectedKeyIds}
            onKeyClick={handleKeyClick}
            onClearSelection={handleClearSelection}
          />
        </CardContent>

        <div class="px-3.5 py-2.5 min-h-[44px] flex items-center justify-between gap-2 shrink-0">
          <div class="flex items-center gap-3 text-xs text-muted-foreground">
            {#if activeSize}
              <span class="font-medium text-foreground">{activeSize.width.toFixed(2)}u × {activeSize.height.toFixed(2)}u</span>
            {:else}
              <span class="opacity-75">Click any key to select</span>
            {/if}
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              class="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              disabled={selectedKeyIds.size === 0}
              onclick={handleClearSelection}
              title="Clear selection"
            >
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-7 text-xs"
              disabled={!activeSize || sameSizeKeys.length === 0 || isAllOfSizeSelected}
              onclick={() => {
                if (activeSize) {
                  handleSelectSizeGroup(activeSize.width, activeSize.height)
                }
              }}
            >
              {#if activeSize && sameSizeKeys.length > 0}
                Select all {sameSizeKeys.length} of this size
              {:else}
                Select all of size
              {/if}
            </Button>
          </div>
        </div>
      </Card>

      <!-- RIGHT: Unified Inspector Card (lg:col-span-4) -->
      <Card class="lg:col-span-4 lg:h-[calc(100vh-20rem)] lg:min-h-[28rem] flex flex-col">
        <CardHeader class="border-b">
          <div class="flex items-center justify-between gap-3 min-h-8">
            <div class="flex items-center gap-2 min-w-0">
              <CardTitle class="text-base">Assignment</CardTitle>
              <HelpTooltip
                text="To assign keys to a 3D model: select one or more keys on the layout, then pick a matching keycap model from the built-in profile options or upload a custom STL. You can also use 'Auto-Assign Profile' during setup to match all standard key sizes in one click."
              />
            </div>
            {#if flowMode === 'inspector'}
              <span class="text-xs text-muted-foreground">
                {assignedCount} / {totalKeys} assigned
              </span>
            {/if}
          </div>
        </CardHeader>

        <CardContent class="flex-1 min-h-0 px-1 py-3">
          <ScrollArea class="h-full w-full px-3">
            {#if flowMode === 'setup'}
              <!-- STEP A: Initial Setup Choice -->
              <div class="flex flex-col gap-4 py-2">
                <div class="flex flex-col gap-1">
                  <span class="text-sm font-semibold">How would you like to start?</span>
                  <p class="text-xs text-muted-foreground leading-relaxed">
                    Choose whether to auto-assign a pre-made keycap profile in 1 click or assign models individually.
                  </p>
                </div>

                <!-- Option 1: Auto-assign Profile -->
                {#if registry && registry.categories.length > 0}
                  <div class="flex flex-col gap-3 p-3.5 rounded-lg border bg-card/60">
                    <div class="flex items-center gap-2">
                      <div class="p-1.5 rounded-md bg-primary/10 text-primary">
                        <Wand2 class="size-4" />
                      </div>
                      <div class="flex flex-col">
                        <span class="text-xs font-semibold">Auto-Assign Profile</span>
                        <span class="text-[11px] text-muted-foreground">Match standard keys in 1 click</span>
                      </div>
                    </div>

                    <div class="flex flex-col gap-2 pt-0.5">
                      <span class="text-[11px] text-muted-foreground">Keycap Profile:</span>
                      <Select type="single" bind:value={selectedProfileCategory}>
                        <SelectTrigger
                          class="h-8 text-xs w-full bg-background"
                          data-placeholder={!selectedProfileCategory}
                        >
                          <SelectValue
                            placeholder="Select profile (e.g. Cherry)..."
                            value={selectedProfileCategory || null}
                          />
                        </SelectTrigger>
                        <SelectContent class="w-full">
                          {#each registry.categories as cat (cat.name)}
                            <SelectItem value={cat.name} label={cat.name} />
                          {/each}
                        </SelectContent>
                      </Select>

                      <Button
                        class="h-8 text-xs w-full mt-1"
                        disabled={!selectedProfileCategory}
                        onclick={() => {
                          if (selectedProfileCategory) {
                            handleAutoAssignCategory(selectedProfileCategory)
                          }
                        }}
                      >
                        Apply Profile to All Keys
                      </Button>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 px-2">
                    <div class="flex-1 border-t border-border"></div>
                    <span class="text-[11px] text-muted-foreground uppercase font-medium tracking-wider">or</span>
                    <div class="flex-1 border-t border-border"></div>
                  </div>
                {/if}

                <!-- Option 2: Start from Scratch -->
                <div class="flex flex-col gap-3 p-3.5 rounded-lg border bg-card/60">
                  <div class="flex items-center gap-2">
                    <div class="p-1.5 rounded-md bg-muted text-foreground">
                      <FileCode class="size-4" />
                    </div>
                    <div class="flex flex-col">
                      <span class="text-xs font-semibold">Start from Scratch</span>
                      <span class="text-[11px] text-muted-foreground">Assign models individually</span>
                    </div>
                  </div>

                  <p class="text-[11px] text-muted-foreground leading-relaxed">
                    Leave all keys unassigned. You can select keys on the canvas or filter by format to assign 3D
                    models.
                  </p>

                  <Button
                    variant="outline"
                    class="h-8 text-xs w-full"
                    onclick={() => {
                      flowMode = 'inspector'
                    }}
                  >
                    Start Blank
                  </Button>
                </div>
              </div>
            {:else}
              <!-- STEP B: Full Inspector (Model Assignment) -->
              <div class="flex flex-col gap-4 py-2">
                {#if selectedKeyIds.size > 0 && activeSize}
                  <div class="flex flex-col gap-3">
                    <div class="flex flex-col gap-1">
                      <span class="text-xs font-semibold">
                        {selectedKeyIds.size} key{selectedKeyIds.size === 1 ? '' : 's'} ({activeSize.width.toFixed(
                          2
                        )}u × {activeSize.height.toFixed(2)}u)
                      </span>
                      <span class="text-[11px] text-muted-foreground">
                        Choose a 3D keycap model to assign to this selection.
                      </span>
                    </div>

                    <StlSourcePicker
                      {registry}
                      sourceKind={currentSelectionSourceKind}
                      selectedCategory={currentSelectionCategory}
                      selectedKeycapPath={currentSelectionKeycapPath}
                      uploadedFileName={currentSelectionUploadedFileName}
                      filterSize={{ uWidth: activeSize.width, uHeight: activeSize.height }}
                      idPrefix="kle-selection"
                      onSelectServerKeycap={handleSelectServerKeycap}
                      onUploadFile={handleUploadCustomStl}
                    />

                    {#if !selectionModelsInfo.allSame && selectedKeyIds.size > 1}
                      <span class="text-[11px] text-muted-foreground leading-tight">
                        Selection contains multiple models. Selecting a model will update all {selectedKeyIds.size} keys.
                      </span>
                    {/if}
                  </div>
                {:else}
                  <div class="flex items-center justify-center h-64 text-sm text-muted-foreground">
                    No keys selected.
                  </div>
                {/if}
              </div>
            {/if}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  {/if}
</div>
