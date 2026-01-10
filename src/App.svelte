<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { app } from './lib/state/store'
  import { downloadStateFile, loadStateFromFile, loadPreset } from './lib/state/persistence'
  import { generateAll3mfsWithWorker } from './lib/generate/generate'
  import { stlBuffersByModelId } from './lib/state/sessionAssets'
  import KeycapModelsEditor from './lib/ui/KeycapModelsEditor.svelte'
  import TemplateEditor from './lib/ui/TemplateEditor.svelte'
  import KeyEditor from './lib/ui/KeyEditor.svelte'
  import ProcessingModal from './lib/ui/ProcessingModal.svelte'
  import ModalContainer from './lib/ui/ModalContainer.svelte'
  import { showMessage, showConfirm } from './lib/state/modalStore'
  import { Download, Upload, BookOpen, ChevronDown, Trash2, Github, Star, Heart, Coffee } from 'lucide-svelte'
  import { registerCustomFonts } from './lib/generate/fonts'
  import ModeToggle from './lib/ui/ModeToggle.svelte'
  import { initTheme } from './lib/state/theme'
  import { Button } from '@/lib/components/ui/button'
  import { ButtonGroup } from '@/lib/components/ui/button-group'
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/lib/components/ui/dropdown-menu'
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs'

  let tab: 'models' | 'templates' | 'keys' = 'models'
  let presetsMenuOpen = false
  let loadInput: HTMLInputElement

  const presets = [
    { value: 'numpad', label: 'Numpad' },
    { value: '40-percent-ortho', label: '40% Ortholinear' },
    { value: '60-percent', label: '60% ANSI' },
  ]

  function onLoadPreset(presetValue: string) {
    presetsMenuOpen = false
    showConfirm('Loading a preset will replace your current project. Continue?', async () => {
      const error = await loadPreset(presetValue)
      if (error) {
        showMessage(error)
      }
    })
  }

  function onClear() {
    showConfirm('This will delete all models, templates, and keys. Continue?', () => {
      stlBuffersByModelId.set({})
      app.set({
        version: 1,
        keycapModels: [],
        templates: [],
        keys: [],
        customFonts: [],
        ui: {
          selectedKeycapModelId: null,
          selectedTemplateId: null,
          selectedKeyId: null,
        },
      })
    })
  }

  $: registerCustomFonts($app.customFonts)

  let isGenerating = false
  let progressCurrent = 0
  let progressTotal = 0
  let currentGeneratingKeyId: string | null = null
  let generateAbortController: AbortController | null = null

  $: requiredModelIds = Array.from(
    new Set(
      $app.keys
        .map(k => $app.templates.find(t => t.id === k.templateId)?.keycapModelId)
        .filter((x): x is string => typeof x === 'string')
    )
  )
  $: missingUploadModels = requiredModelIds
    .map(id => $app.keycapModels.find(m => m.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .filter(m => m.source.kind === 'upload' && !$stlBuffersByModelId[m.id])

  async function onGenerate() {
    if (missingUploadModels.length > 0 || isGenerating) return

    isGenerating = true
    progressCurrent = 0
    progressTotal = $app.keys.length
    currentGeneratingKeyId = null
    generateAbortController = new AbortController()

    try {
      await generateAll3mfsWithWorker(
        $app,
        $stlBuffersByModelId,
        p => {
          progressCurrent = p.current
          progressTotal = p.total
          currentGeneratingKeyId = p.keyId
        },
        generateAbortController.signal
      )
      // Keep modal open briefly to show completion, then close
      await new Promise(r => setTimeout(r, 1500))
    } catch (e) {
      console.error(e)
      if (!(e instanceof Error && e.message === 'Generation cancelled')) {
        showMessage(e instanceof Error ? e.message : 'Generation failed.')
      }
    } finally {
      isGenerating = false
      generateAbortController = null
      progressCurrent = 0
      progressTotal = 0
      currentGeneratingKeyId = null
    }
  }

  $: currentKey = currentGeneratingKeyId ? $app.keys.find(k => k.id === currentGeneratingKeyId) : null
  $: currentTemplate = currentKey ? $app.templates.find(t => t.id === currentKey.templateId) : null
  $: currentModel = currentTemplate ? $app.keycapModels.find(m => m.id === currentTemplate.keycapModelId) : null

  function onCancelGenerate() {
    if (generateAbortController) {
      generateAbortController.abort()
      generateAbortController = null
      isGenerating = false
    }
  }

  $: hasUnsavedChanges = $app.keycapModels.length > 0 || $app.templates.length > 0 || $app.keys.length > 0

  function handleBeforeUnload(event: BeforeUnloadEvent) {
    if (hasUnsavedChanges) {
      event.preventDefault()
      return ''
    }
  }

  onMount(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
    return initTheme({ defaultTheme: 'dark', storageKey: 'vite-ui-theme' })
  })

  onDestroy(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })
</script>

<div class="flex min-h-dvh flex-col">
  <header class="border-b bg-background/80 backdrop-blur">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
      <div class="flex-1">
        <div class="text-lg font-semibold leading-tight">Keycap Generator</div>
        <div class="text-xs text-muted-foreground">Custom keycap model generator for multi-color 3D printing</div>
      </div>

      <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <ModeToggle />

        <input
          bind:this={loadInput}
          class="hidden"
          type="file"
          accept="application/json"
          on:change={async e => {
            const error = await loadStateFromFile(e)
            if (error) {
              showMessage(error)
            }
          }}
        />
        <ButtonGroup>
          <Button variant="outline" size="sm" onclick={() => downloadStateFile($app)} title="Save project">
            <Download class="size-4" />
            <span class="hidden sm:inline">Save</span>
          </Button>
          <Button variant="outline" size="sm" onclick={() => loadInput?.click()} title="Load project">
            <Upload class="size-4" />
            <span class="hidden sm:inline">Load</span>
          </Button>
        </ButtonGroup>

        <DropdownMenu bind:open={presetsMenuOpen}>
          <DropdownMenuTrigger>
            {#snippet child({ props })}
              <Button variant="outline" size="sm" title="Load preset" {...props}>
                <BookOpen class="size-4" />
                <span class="sm:hidden">Presets</span>
                <span class="hidden sm:inline">Load preset</span>
                <ChevronDown class="size-3" />
              </Button>
            {/snippet}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="min-w-[160px]">
            {#each presets as preset}
              <DropdownMenuItem onclick={() => onLoadPreset(preset.value)}>{preset.label}</DropdownMenuItem>
            {/each}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="destructive" size="sm" onclick={onClear} title="Clear all">
          <Trash2 class="size-4" />
          <span class="hidden sm:inline">Clear</span>
        </Button>
      </div>
    </div>
  </header>

  <div class="mx-auto flex-1 w-full max-w-6xl px-3 py-4 sm:px-4">
    <Tabs bind:value={tab} class="gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <TabsList>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="keys">Keys</TabsTrigger>
        </TabsList>

        <Button
          class="ml-auto"
          disabled={$app.keys.length === 0 || missingUploadModels.length > 0 || isGenerating}
          onclick={onGenerate}
        >
          Generate
        </Button>
      </div>

      <TabsContent value="models">
        <KeycapModelsEditor />
      </TabsContent>
      <TabsContent value="templates">
        <TemplateEditor />
      </TabsContent>
      <TabsContent value="keys">
        <KeyEditor />
      </TabsContent>
    </Tabs>
  </div>

  {#if isGenerating}
    <ProcessingModal
      title="Generating Keycaps"
      onCancel={onCancelGenerate}
      current={progressCurrent}
      total={progressTotal}
      previewTemplate={currentTemplate ?? null}
      previewTextsBySymbolId={currentKey?.textsBySymbolId ?? {}}
      previewWidthMm={currentModel?.widthMm ?? 0}
      previewHeightMm={currentModel?.heightMm ?? 0}
    />
  {/if}

  <ModalContainer />

  <footer class="mt-auto border-t bg-background/80 backdrop-blur">
    <div
      class="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-3 py-6 sm:flex-row sm:px-4"
    >
      <div class="flex items-center gap-4">
        <Button
          href="https://github.com/srwi/keycap_generator"
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
          size="sm"
        >
          <Github class="h-4 w-4" />
          <span>View on GitHub</span>
        </Button>

        <Button
          href="https://github.com/srwi/keycap_generator"
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
          size="sm"
        >
          <Star class="h-4 w-4 text-yellow-500" />
          <span>Star</span>
        </Button>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-sm text-muted-foreground">Donate:</span>
        <Button
          href="https://paypal.me/rumswinkel"
          target="_blank"
          rel="noopener noreferrer"
          title="Support this project via PayPal"
          variant="outline"
          size="sm"
        >
          <Heart class="h-4 w-4 text-rose-500" />
          <span>PayPal</span>
        </Button>

        <Button
          href="https://ko-fi.com/stephanrwi"
          target="_blank"
          rel="noopener noreferrer"
          title="Support this project via Ko-fi"
          variant="outline"
          size="sm"
        >
          <Coffee class="h-4 w-4 text-amber-500" />
          <span>Ko-fi</span>
        </Button>
      </div>
    </div>
  </footer>
</div>
