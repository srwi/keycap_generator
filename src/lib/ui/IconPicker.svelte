<script lang="ts">
  import {
    getAllIconsMeta,
    searchIconsMeta,
    loadIcon,
    PHOSPHOR_ICON_VIEWBOX,
    ICON_VARIANTS,
    type IconInfo,
    type IconVariant,
  } from '../services/icons'
  import { Search } from 'lucide-svelte'
  import { ScrollArea } from '@/lib/components/ui/scroll-area'
  import * as Tabs from '@/lib/components/ui/tabs'

  export let onSelect: (iconName: string, variant: IconVariant) => void = () => {}

  let searchQuery = ''
  let allIconsMeta: Array<{ name: string; displayName: string }> = []
  let loadedIcons = new Map<string, IconInfo>()
  let scrollContainer: HTMLElement | null = null
  let selectedVariant: IconVariant = 'regular'

  const BATCH_SIZE = 200
  let displayLimit = BATCH_SIZE

  function normalize(s: string): string {
    return s.toLowerCase().replace(/\s+/g, ' ').trim()
  }

  $: query = normalize(searchQuery)

  // Get all matching icons (unsliced)
  $: allMatchingIcons = query.length === 0 ? allIconsMeta : searchIconsMeta(query)

  // Apply display limit
  $: filteredIconsMeta = allMatchingIcons.slice(0, displayLimit)

  // Check if there are more to load
  $: hasMore = displayLimit < allMatchingIcons.length

  // Reset display limit when search changes
  $: if (query !== undefined) {
    displayLimit = BATCH_SIZE
  }

  // Load icons metadata on mount
  $: if (allIconsMeta.length === 0) {
    allIconsMeta = getAllIconsMeta()
  }

  // Cache key includes variant
  function getCacheKey(iconName: string, variant: IconVariant): string {
    return `${variant}:${iconName}`
  }

  // Load visible icon paths
  async function ensureLoaded(iconName: string, variant: IconVariant) {
    const cacheKey = getCacheKey(iconName, variant)
    if (loadedIcons.has(cacheKey)) return
    try {
      const icon = await loadIcon(iconName, variant)
      if (icon) {
        loadedIcons = new Map(loadedIcons.set(cacheKey, icon))
      }
    } catch {
      // ignore
    }
  }

  // Preload current result page when icons or variant changes
  $: void Promise.all(filteredIconsMeta.map(i => ensureLoaded(i.name, selectedVariant)))

  function handleSelect(iconName: string) {
    onSelect(iconName, selectedVariant)
  }

  function handleScroll(e: Event) {
    const target = e.target as HTMLElement
    const scrollTop = target.scrollTop
    const scrollHeight = target.scrollHeight
    const clientHeight = target.clientHeight

    // Load more when near the bottom (within 100px)
    if (scrollHeight - scrollTop - clientHeight < 100 && hasMore) {
      displayLimit += BATCH_SIZE
    }
  }

  function handleVariantChange(variant: string) {
    selectedVariant = variant as IconVariant
    // Clear the loaded icons for the new variant to trigger reload
    displayLimit = BATCH_SIZE
  }
</script>

<div class="w-80">
  <!-- Header with search -->
  <div class="p-3 border-b">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold">Phosphor Icons</h3>
    </div>
    <div class="relative">
      <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <input
        type="text"
        class="w-full rounded-md border bg-background px-2 py-1.5 pl-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="Search icons…"
        bind:value={searchQuery}
      />
    </div>
    <!-- Variant tabs -->
    <Tabs.Root value={selectedVariant} onValueChange={handleVariantChange} class="mt-2">
      <Tabs.List class="w-full grid grid-cols-3">
        {#each ICON_VARIANTS as variant}
          <Tabs.Trigger value={variant.value} class="text-xs">{variant.label}</Tabs.Trigger>
        {/each}
      </Tabs.List>
    </Tabs.Root>
  </div>

  <!-- Icon grid with scroll detection -->
  <div class="h-64 overflow-y-auto p-2" bind:this={scrollContainer} onscroll={handleScroll}>
    {#if filteredIconsMeta.length === 0}
      <div class="flex items-center justify-center h-32 text-sm text-muted-foreground">No icons found</div>
    {:else}
      <div class="grid grid-cols-4 gap-2">
        {#each filteredIconsMeta as meta (meta.name)}
          {@const icon = loadedIcons.get(getCacheKey(meta.name, selectedVariant))}
          <button
            type="button"
            class="flex flex-col items-center justify-center gap-1 p-2 rounded-md border border-transparent hover:bg-accent hover:border-border transition-colors group"
            onclick={() => handleSelect(meta.name)}
            title={meta.displayName}
          >
            {#if icon?.path}
              <svg
                viewBox="0 0 {PHOSPHOR_ICON_VIEWBOX} {PHOSPHOR_ICON_VIEWBOX}"
                class="size-6 text-muted-foreground group-hover:text-foreground transition-colors"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d={icon.path} />
              </svg>
            {:else}
              <div class="size-6 rounded bg-muted/60 animate-pulse"></div>
            {/if}
            <span
              class="text-xs text-muted-foreground group-hover:text-foreground truncate w-full text-center transition-colors"
            >
              {meta.displayName}
            </span>
          </button>
        {/each}
      </div>

      {#if hasMore}
        <div class="text-center py-2 text-xs text-muted-foreground">Scroll for more...</div>
      {/if}
    {/if}
  </div>

  <!-- Footer -->
  <div class="px-3 py-2 border-t text-xs text-muted-foreground text-center">
    Showing {filteredIconsMeta.length} of {allMatchingIcons.length} icon{allMatchingIcons.length !== 1 ? 's' : ''}
    {#if query}
      matching "{searchQuery}"
    {/if}
  </div>
</div>
