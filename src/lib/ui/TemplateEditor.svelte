<script lang="ts">
  import { app, actions, selectedTemplate, getSlotName, getSlotSymbol, MAX_SLOTS } from '../state/store'
  import LabelPreview from './LabelPreview.svelte'
  import KeycapPreview from './KeycapPreview.svelte'
  import { showConfirm, showMessage } from '../state/modalStore'
  import { slide } from 'svelte/transition'
  import { X, Plus, ChevronRight } from 'lucide-svelte'
  import HelpTooltip from './HelpTooltip.svelte'
  import { newId } from '../utils/id'
  import { arrayBufferToBase64, baseNameFromFileName, isTtfFileName, makeUniqueFontName } from '../services/customFonts'
  import { Button } from '@/lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card'
  import { Field, FieldGroup, FieldLabel } from '@/lib/components/ui/field'
  import { Input } from '@/lib/components/ui/input'
  import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/lib/components/ui/item'
  import { ScrollArea } from '@/lib/components/ui/scroll-area'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/lib/components/ui/select'
  import { Switch } from '@/lib/components/ui/switch'
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/lib/components/ui/tooltip'

  $: tpl = $selectedTemplate
  $: hasModels = $app.keycapModels.length > 0
  let selectedKeycapModelId: string = ''
  let prevKeycapModelId: string | null = null
  $: if (tpl && tpl.keycapModelId !== prevKeycapModelId) {
    prevKeycapModelId = tpl.keycapModelId
    selectedKeycapModelId = tpl.keycapModelId
  }
  $: if (tpl && selectedKeycapModelId !== tpl.keycapModelId) {
    actions.setTemplateKeycapModel(tpl.id, selectedKeycapModelId)
  }

  function deleteTemplateById(templateId: string) {
    const t = $app.templates.find(t => t.id === templateId)
    if (!t) return

    const usedByKeyCount = $app.keys.filter(k => k.templateId === t.id).length
    if (usedByKeyCount > 0) {
      showConfirm(
        `Template "${t.name}" is used by ${usedByKeyCount} key(s).\n\nIf you delete it, those keys will be removed as well.\n\nDelete template?`,
        () => {
          actions.deleteTemplate(t.id)
        }
      )
      return
    }

    actions.deleteTemplate(t.id)
  }

  function onRowKeydown(ev: KeyboardEvent, action: () => void) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault()
      action()
    }
  }

  import { AVAILABLE_FONTS } from '../generate/fonts'

  $: customFontNames = $app.customFonts.map(f => f.name)
  $: fontOptions = [...AVAILABLE_FONTS, ...customFontNames.filter(n => !AVAILABLE_FONTS.includes(n))]

  $: model = tpl == null ? null : ($app.keycapModels.find(m => m.id === tpl.keycapModelId) ?? null)
  $: modelWidthMm = model?.widthMm ?? 0
  $: modelHeightMm = model?.heightMm ?? 0

  // Create preview content with text symbols for template preview
  $: previewContentBySymbolId = tpl
    ? Object.fromEntries(tpl.symbols.map((s, index) => [s.id, { kind: 'text', value: getSlotSymbol(index) } as const]))
    : {}

  let previewIs3d = false

  function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n))
  }

  function getTemplateModel(templateId: string) {
    const t = $app.templates.find(t => t.id === templateId)
    if (!t) return null
    return $app.keycapModels.find(m => m.id === t.keycapModelId) ?? null
  }

  let fontUploadInput: HTMLInputElement | null = null
  let fontUploadTarget: { templateId: string; symbolId: string } | null = null

  function onClickAddFont(templateId: string, symbolId: string) {
    fontUploadTarget = { templateId, symbolId }
    fontUploadInput?.click()
  }

  async function onFontUploadChange(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement
    const file = input.files?.[0] ?? null
    input.value = ''

    const target = fontUploadTarget
    fontUploadTarget = null

    if (!file || !target) return
    if (!isTtfFileName(file.name)) {
      showMessage('Please upload a .ttf font file.')
      return
    }

    try {
      const buf = await file.arrayBuffer()
      const baseName = baseNameFromFileName(file.name) || 'Custom Font'
      const existing = new Set(fontOptions)
      const uniqueName = makeUniqueFontName(baseName, existing)

      actions.addCustomFont({
        id: newId('font'),
        name: uniqueName,
        fileName: file.name,
        ttfBase64: arrayBufferToBase64(buf),
      })

      actions.updateSymbol(target.templateId, target.symbolId, { fontName: uniqueName })
    } catch (e) {
      console.error(e)
      showMessage(e instanceof Error ? e.message : 'Failed to upload font.')
    }
  }

  let collapsedSymbols = new Set<string>()
  let previousTemplateId: string | null = null
  let previousSymbolIds: Set<string> | null = null

  function toggleSymbol(symbolId: string) {
    if (collapsedSymbols.has(symbolId)) {
      collapsedSymbols.delete(symbolId)
    } else {
      collapsedSymbols.add(symbolId)
    }
    collapsedSymbols = collapsedSymbols
  }

  $: if (tpl) {
    const currentSymbolIds = new Set(tpl.symbols.map(s => s.id))

    if (!previousSymbolIds || previousTemplateId !== tpl.id) {
      collapsedSymbols = new Set(currentSymbolIds)
    } else {
      const kept = new Set([...collapsedSymbols].filter(id => currentSymbolIds.has(id)))
      const newIds = new Set([...currentSymbolIds].filter(id => !previousSymbolIds!.has(id)))
      collapsedSymbols = new Set([...kept, ...newIds])
    }

    previousTemplateId = tpl.id
    previousSymbolIds = currentSymbolIds
  }
</script>

<div class="grid gap-4 lg:grid-cols-12">
  <Card class="lg:col-span-4 h-[calc(100vh-20rem)] min-h-[24rem] flex flex-col">
    <CardHeader class="border-b">
      <div class="flex items-center justify-between gap-3 min-h-8">
        <div class="flex items-center gap-2 min-w-0">
          <CardTitle class="text-base">Templates</CardTitle>
          <HelpTooltip
            text="A template defines the layout and styling of symbols (labels) on a keycap. It specifies where text appears, what font, size, color, and rotation to use. Multiple keys can share the same template but display different text values. Templates are linked to a specific keycap model size."
          />
        </div>
        <Button size="sm" disabled={!hasModels} title="New template" onclick={actions.createTemplate}>
          <Plus class="size-4" />
          <span class="hidden sm:inline">New</span>
        </Button>
      </div>
    </CardHeader>

    <CardContent class="flex-1 min-h-0 px-1">
      <ScrollArea class="h-full w-full min-h-0 px-3">
        <div class="grid gap-2 px-1 py-6">
          {#each $app.templates as t (t.id)}
            {@const tModel = getTemplateModel(t.id)}
            {@const previewTexts = Object.fromEntries(t.symbols.map((s, index) => [s.id, getSlotSymbol(index)]))}
            <Item
              size="sm"
              variant={$app.ui.selectedTemplateId === t.id ? 'muted' : 'outline'}
              class="w-full justify-between"
            >
              {#snippet child({ props })}
                <div
                  {...props}
                  class={(props.class as string) + ' w-full flex items-center gap-2'}
                  role="button"
                  tabindex="0"
                  onclick={() => actions.selectTemplate(t.id)}
                  onkeydown={(ev: KeyboardEvent) => onRowKeydown(ev, () => actions.selectTemplate(t.id))}
                >
                  <div class="h-10 w-10 flex-shrink-0 flex items-center justify-start">
                    {#if tModel}
                      {@const previewContent = Object.fromEntries(
                        t.symbols.map((s, index) => [s.id, { kind: 'text', value: getSlotSymbol(index) } as const])
                      )}
                      <LabelPreview
                        template={t}
                        contentBySymbolId={previewContent}
                        widthMm={tModel.widthMm}
                        heightMm={tModel.heightMm}
                        className="rounded"
                      />
                    {/if}
                  </div>
                  <ItemContent class="min-w-0 flex-1">
                    <ItemTitle class="truncate">{t.name}</ItemTitle>
                    <ItemDescription class="truncate">
                      {$app.keycapModels.find(m => m.id === t.keycapModelId)?.name ?? '—'}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions class="ms-auto">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="text-foreground/70 hover:text-foreground hover:bg-muted"
                      title="Delete template"
                      onclick={(ev: MouseEvent) => {
                        ev.preventDefault()
                        ev.stopPropagation()
                        deleteTemplateById(t.id)
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
      </ScrollArea>
    </CardContent>
  </Card>

  <Card class="lg:col-span-4 h-[calc(100vh-20rem)] min-h-[24rem] flex flex-col">
    <CardHeader class="border-b">
      <div class="flex items-center justify-between gap-3 min-h-8">
        <CardTitle class="text-base">Template configuration</CardTitle>
      </div>
    </CardHeader>

    <CardContent class="flex-1 min-h-0 px-1">
      <ScrollArea class="h-full w-full min-h-0 px-3">
        {#if !tpl}
          <div class="flex items-center justify-center h-64 text-sm text-muted-foreground">
            Create/select a template to edit.
          </div>
        {:else}
          {@const nameId = `template-${tpl.id}-name`}
          {@const modelId = `template-${tpl.id}-keycap-model`}

          <FieldGroup class="py-5">
            <Field>
              <FieldLabel for={nameId}>Name</FieldLabel>
              <Input
                id={nameId}
                value={tpl.name}
                oninput={e => actions.renameTemplate(tpl.id, (e.currentTarget as HTMLInputElement).value)}
              />
            </Field>

            <Field>
              <FieldLabel for={modelId}>Keycap model</FieldLabel>
              <Select type="single" bind:value={selectedKeycapModelId}>
                <SelectTrigger id={modelId} class="w-full" data-placeholder={!selectedKeycapModelId}>
                  <SelectValue
                    placeholder="Select a model"
                    value={$app.keycapModels.find(m => m.id === selectedKeycapModelId)?.name ?? null}
                  />
                </SelectTrigger>
                <SelectContent class="w-full">
                  {#each $app.keycapModels as km (km.id)}
                    <SelectItem value={km.id} label={km.name} />
                  {/each}
                </SelectContent>
              </Select>
            </Field>

            <div class="grid gap-3">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <div class="text-sm font-medium">Symbols</div>
                  <HelpTooltip
                    text="Symbols represent different label positions on a keycap (e.g., primary, secondary, tertiary). You can add multiple symbols to create keys with multiple labels, each with its own position, font, size, rotation, and color. This allows you to create keys with legends, modifiers, or multi-character labels."
                  />
                </div>
                <Button size="sm" disabled={tpl.symbols.length >= MAX_SLOTS} onclick={() => actions.addSymbol(tpl.id)}>
                  <Plus class="size-4" />
                  Add
                </Button>
              </div>

              <div class="grid gap-3">
                {#each tpl.symbols as sym (sym.id)}
                  {@const isCollapsed = collapsedSymbols.has(sym.id)}
                  <div class="card-box overflow-hidden">
                    <div class="flex items-center justify-between gap-2 px-2 py-2">
                    <Button
                      variant="ghost"
                      class="h-auto flex-1 justify-start hover:bg-accent/40 dark:hover:bg-accent/20"
                      onclick={() => toggleSymbol(sym.id)}
                    >
                      <ChevronRight
                        class="size-4 text-muted-foreground transition-transform {isCollapsed ? '' : 'rotate-90'}"
                      />
                      <span class="truncate capitalize"
                        >{getSlotName(tpl.symbols.indexOf(sym))} ({getSlotSymbol(tpl.symbols.indexOf(sym))})</span
                      >
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="text-foreground/70 hover:text-foreground hover:bg-muted"
                      title="Remove symbol"
                      onclick={() => actions.deleteSymbol(tpl.id, sym.id)}
                    >
                      <X class="size-4" />
                    </Button>
                    </div>

                    {#if !isCollapsed}
                    <div class="p-3 pt-0" transition:slide={{ duration: 200 }}>
                      <FieldGroup>
                        <div class="grid grid-cols-2 gap-3">
                          <Field>
                            <FieldLabel for={`template-${tpl.id}-symbol-${sym.id}-x`}>X (mm)</FieldLabel>
                            <Input
                              id={`template-${tpl.id}-symbol-${sym.id}-x`}
                              type="number"
                              step="0.1"
                              value={sym.x}
                              oninput={e =>
                                actions.updateSymbol(tpl.id, sym.id, {
                                  x: Number((e.currentTarget as HTMLInputElement).value),
                                })}
                            />
                          </Field>

                          <Field>
                            <FieldLabel for={`template-${tpl.id}-symbol-${sym.id}-y`}>Y (mm)</FieldLabel>
                            <Input
                              id={`template-${tpl.id}-symbol-${sym.id}-y`}
                              type="number"
                              step="0.1"
                              value={sym.y}
                              oninput={e =>
                                actions.updateSymbol(tpl.id, sym.id, {
                                  y: Number((e.currentTarget as HTMLInputElement).value),
                                })}
                            />
                          </Field>
                        </div>

                        <Field>
                          <FieldLabel for={`template-${tpl.id}-symbol-${sym.id}-font`}>Font</FieldLabel>
                          <div class="flex items-center gap-2">
                            <Select
                              type="single"
                              value={sym.fontName}
                              onValueChange={(fontName: string) => actions.updateSymbol(tpl.id, sym.id, { fontName })}
                            >
                              <SelectTrigger
                                id={`template-${tpl.id}-symbol-${sym.id}-font`}
                                class="w-full flex-1"
                                data-placeholder={!sym.fontName}
                              >
                                <SelectValue placeholder="Select a font" value={sym.fontName} />
                              </SelectTrigger>
                              <SelectContent class="w-full">
                                {#each fontOptions as fontName}
                                  <SelectItem value={fontName} label={fontName} />
                                {/each}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="icon"
                              type="button"
                              title="Add font"
                              onclick={() => onClickAddFont(tpl.id, sym.id)}
                            >
                              <Plus class="size-4" />
                            </Button>
                          </div>
                        </Field>

                        <div class="grid grid-cols-2 gap-3">
                          <Field>
                            <FieldLabel for={`template-${tpl.id}-symbol-${sym.id}-size`}>Size (mm)</FieldLabel>
                            <Input
                              id={`template-${tpl.id}-symbol-${sym.id}-size`}
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={sym.fontSizeMm}
                              oninput={e =>
                                actions.updateSymbol(tpl.id, sym.id, {
                                  fontSizeMm: Number((e.currentTarget as HTMLInputElement).value),
                                })}
                            />
                          </Field>

                          <Field>
                            <FieldLabel for={`template-${tpl.id}-symbol-${sym.id}-rotation`}>Rotation (deg)</FieldLabel>
                            <Input
                              id={`template-${tpl.id}-symbol-${sym.id}-rotation`}
                              type="number"
                              step="1"
                              value={sym.rotationDeg}
                              oninput={e =>
                                actions.updateSymbol(tpl.id, sym.id, {
                                  rotationDeg: Number((e.currentTarget as HTMLInputElement).value),
                                })}
                            />
                          </Field>
                        </div>

                        <Field>
                          <FieldLabel for={`template-${tpl.id}-symbol-${sym.id}-color`}>Color</FieldLabel>
                          <div class="flex items-center gap-2">
                            <input
                              id={`template-${tpl.id}-symbol-${sym.id}-color`}
                              class="h-9 w-20 rounded-md border border-input bg-background"
                              type="color"
                              value={sym.color}
                              oninput={e =>
                                actions.updateSymbol(tpl.id, sym.id, {
                                  color: (e.currentTarget as HTMLInputElement).value,
                                })}
                            />
                            <span class="text-xs text-muted-foreground font-mono">{sym.color}</span>
                          </div>
                        </Field>
                      </FieldGroup>
                    </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          </FieldGroup>
        {/if}
      </ScrollArea>
    </CardContent>
  </Card>

  <input
    class="hidden"
    bind:this={fontUploadInput}
    type="file"
    accept=".ttf,font/ttf,application/x-font-ttf"
    onchange={onFontUploadChange}
  />

  <Card class="lg:col-span-4 h-[calc(100vh-20rem)] min-h-[24rem] flex flex-col">
    <CardHeader class="border-b">
      <div class="flex items-center justify-between gap-3 min-h-8">
        <CardTitle class="text-base">Preview</CardTitle>
        <div class="flex items-center gap-2">
          <span class={previewIs3d ? 'text-xs text-muted-foreground' : 'text-xs font-medium'}>2D</span>
          <Switch bind:checked={previewIs3d} disabled={!tpl} aria-label="Toggle 3D preview" />
          <span class={previewIs3d ? 'text-xs font-medium' : 'text-xs text-muted-foreground'}>3D</span>
        </div>
      </div>
    </CardHeader>
    <CardContent class="flex-1 min-h-0 px-1">
      <ScrollArea class="h-full w-full min-h-0 flex items-start justify-start px-3 py-5">
        <KeycapPreview
          template={tpl}
          contentBySymbolId={previewContentBySymbolId}
          widthMm={modelWidthMm}
          heightMm={modelHeightMm}
          keyId={null}
          bind:is3d={previewIs3d}
        />
      </ScrollArea>
    </CardContent>
  </Card>
</div>
