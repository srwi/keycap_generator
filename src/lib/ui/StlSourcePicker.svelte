<script lang="ts">
  import { getStlDimensions } from '../generate/stl'
  import { matchesKeycapSize, type KeycapEntry, type Registry } from '../services/stlRegistry'
  import { Button } from '@/lib/components/ui/button'
  import { Field, FieldLabel } from '@/lib/components/ui/field'
  import { Label } from '@/lib/components/ui/label'
  import { RadioGroup, RadioGroupItem } from '@/lib/components/ui/radio-group'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/lib/components/ui/select'
  import { AlertCircle } from 'lucide-svelte'

  export let registry: Registry | null = null
  export let sourceKind: 'server' | 'upload' = 'server'
  export let selectedCategory: string = ''
  export let selectedKeycapPath: string = ''
  export let uploadedFileName: string | null = null
  export let filterSize: { uWidth: number; uHeight: number } | null = null
  export let idPrefix = 'stl-source'

  export let onSourceKindChange: ((kind: 'server' | 'upload') => void) | undefined = undefined
  export let onSelectServerKeycap: ((data: { keycap: KeycapEntry; category: string }) => void) | undefined = undefined
  export let onUploadFile:
    | ((data: { file: File; buffer: ArrayBuffer; widthMm: number; heightMm: number }) => void)
    | undefined = undefined

  let fileInput: HTMLInputElement
  let isParsing = false
  let parseError: string | null = null

  $: categories = (() => {
    if (!registry) return []
    if (!filterSize) return registry.categories.map(c => c.name)
    return registry.categories
      .filter(c =>
        c.keycaps.some(
          kc => matchesKeycapSize(kc.uWidth, kc.uHeight, filterSize.uWidth, filterSize.uHeight)
        )
      )
      .map(c => c.name)
  })()

  $: if (filterSize) {
    if (categories.length > 0 && (!selectedCategory || !categories.includes(selectedCategory))) {
      selectedCategory = categories[0]
    } else if (categories.length === 0 && selectedCategory !== '') {
      selectedCategory = ''
    }
  }

  $: selectedCategoryData = registry ? registry.categories.find(c => c.name === selectedCategory) : null

  // All keycaps in current category, optionally filtered by unit dimensions
  $: availableKeycaps = (() => {
    if (!selectedCategoryData) return []
    const all = selectedCategoryData.keycaps
    if (!filterSize) return all
    return all.filter(kc => matchesKeycapSize(kc.uWidth, kc.uHeight, filterSize.uWidth, filterSize.uHeight))
  })()

  // Selected keycap metadata (author, license)
  $: selectedKeycap = selectedCategoryData?.keycaps.find(k => k.path === selectedKeycapPath) ?? null

  function handleKindChange(next: string) {
    const nextKind = next as 'server' | 'upload'
    sourceKind = nextKind
    onSourceKindChange?.(nextKind)
  }

  function handleCategoryChange(catName: string) {
    selectedCategory = catName
    const catData = registry?.categories.find(c => c.name === catName)
    if (!catData) return

    let nextKeycaps = catData.keycaps
    if (filterSize) {
      nextKeycaps = nextKeycaps.filter(
        kc => matchesKeycapSize(kc.uWidth, kc.uHeight, filterSize.uWidth, filterSize.uHeight)
      )
    }

    // If current keycap is in the new category and matches, keep it; otherwise pick first matching (or empty)
    const currentStillValid = nextKeycaps.some(k => k.path === selectedKeycapPath)
    if (!currentStillValid) {
      const nextFirst = nextKeycaps[0] ?? null
      selectedKeycapPath = nextFirst ? nextFirst.path : ''
      if (nextFirst) {
        onSelectServerKeycap?.({ keycap: nextFirst, category: catName })
      }
    }
  }

  function handleKeycapChange(path: string) {
    selectedKeycapPath = path
    const keycap = selectedCategoryData?.keycaps.find(k => k.path === path)
    if (keycap && selectedCategory) {
      onSelectServerKeycap?.({ keycap, category: selectedCategory })
    }
  }

  async function handleFileSelect(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    parseError = null
    isParsing = true
    try {
      const buffer = await file.arrayBuffer()
      const dims = await getStlDimensions(buffer)
      onUploadFile?.({ file, buffer, widthMm: dims.widthMm, heightMm: dims.heightMm })
    } catch (err) {
      parseError = err instanceof Error ? err.message : 'Failed to load STL file.'
    } finally {
      isParsing = false
    }
  }
</script>

<div class="card-box grid gap-2 p-3">
  <RadioGroup
    value={sourceKind}
    onValueChange={handleKindChange}
    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
  >
    <div class="flex items-center gap-3">
      <RadioGroupItem value="server" id="{idPrefix}-server" />
      <Label for="{idPrefix}-server">From server</Label>
    </div>
    <div class="flex items-center gap-3">
      <RadioGroupItem value="upload" id="{idPrefix}-upload" />
      <Label for="{idPrefix}-upload">Upload file</Label>
    </div>
  </RadioGroup>

  {#if sourceKind === 'server'}
    {#if registry}
      <div class="grid gap-2">
        <div class="grid grid-cols-2 gap-2">
          <Field>
            <FieldLabel for="{idPrefix}-category">Category</FieldLabel>
            <Select
              type="single"
              value={selectedCategory}
              onValueChange={handleCategoryChange}
              disabled={categories.length === 0}
            >
              <SelectTrigger
                id="{idPrefix}-category"
                class="w-full text-xs"
                data-placeholder={!selectedCategory}
                disabled={categories.length === 0}
              >
                <SelectValue
                  placeholder={categories.length === 0 ? 'No matching categories' : 'Select a category'}
                  value={selectedCategory || null}
                />
              </SelectTrigger>
              <SelectContent class="w-full">
                {#each categories as cat}
                  <SelectItem value={cat} label={cat} />
                {/each}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel for="{idPrefix}-keycap">Keycap</FieldLabel>
            <Select type="single" value={selectedKeycapPath} onValueChange={handleKeycapChange}>
              <SelectTrigger
                id="{idPrefix}-keycap"
                class="w-full text-xs"
                data-placeholder={!selectedKeycapPath}
                disabled={availableKeycaps.length === 0}
              >
                <SelectValue
                  placeholder={availableKeycaps.length === 0 ? 'No matching models' : 'Select a keycap'}
                  value={availableKeycaps.find(k => k.path === selectedKeycapPath)?.displayName ?? null}
                />
              </SelectTrigger>
              <SelectContent class="w-full">
                {#each availableKeycaps as keycap}
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
      <FieldLabel for="{idPrefix}-file-input">Choose STL file</FieldLabel>
      <div class="flex items-center gap-2">
        <input
          id="{idPrefix}-file-input"
          bind:this={fileInput}
          class="hidden"
          type="file"
          accept=".stl,model/stl"
          onchange={handleFileSelect}
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          class="h-8 text-xs"
          disabled={isParsing}
          onclick={() => fileInput?.click()}
        >
          {isParsing ? 'Reading...' : 'Browse...'}
        </Button>
        {#if uploadedFileName}
          <span class="text-xs text-foreground truncate flex-1" title={uploadedFileName}>
            {uploadedFileName}
          </span>
        {:else}
          <span class="text-xs text-muted-foreground">No file selected</span>
        {/if}
      </div>
    </Field>

    {#if parseError}
      <div class="flex items-center gap-1.5 text-xs text-destructive mt-1">
        <AlertCircle class="size-3.5 shrink-0" />
        <span>{parseError}</span>
      </div>
    {/if}
  {/if}
</div>
