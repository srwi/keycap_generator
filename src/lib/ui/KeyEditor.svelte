<script lang="ts">
  import { app, actions, selectedKey, getSlotName, getSlotSymbol } from '../state/store'
  import type { SymbolContent } from '../state/types'
  import LabelPreview from './LabelPreview.svelte'
  import SymbolInput from './SymbolInput.svelte'
  import KeycapPreview3D from './KeycapPreview3D.svelte'
  import KeycapPreviewSVGOverlay from './KeycapPreviewSVGOverlay.svelte'
  import { X, Plus, Loader2, Box } from 'lucide-svelte'
  import HelpTooltip from './HelpTooltip.svelte'
  import { slide, fade } from 'svelte/transition'
  import { generatePreview } from '../generate/generation-api'
  import { stlBuffersByModelId } from '../state/sessionAssets'
  import * as THREE from 'three'
  import { Button } from '@/lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card'
  import { Field, FieldGroup, FieldLabel } from '@/lib/components/ui/field'
  import { Input } from '@/lib/components/ui/input'
  import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/lib/components/ui/item'
  import { ScrollArea } from '@/lib/components/ui/scroll-area'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/lib/components/ui/select'

  function getSymbolContent(keyId: string, symbolId: string): SymbolContent | null {
    const k = $app.keys.find(k => k.id === keyId)
    if (!k) return null
    return k.contentBySymbolId[symbolId] ?? null
  }

  $: key = $selectedKey
  $: tpl = key == null ? null : ($app.templates.find(t => t.id === key.templateId) ?? null)
  $: model = tpl == null ? null : ($app.keycapModels.find(m => m.id === tpl.keycapModelId) ?? null)
  $: hasTemplates = $app.templates.length > 0

  let isGenerating = false
  let generatedMesh: THREE.Group | null = null
  let generationError: string | null = null

  $: if (key) {
    generatedMesh = null
    generationError = null
  }

  $: showFullPreview = generatedMesh !== null

  async function generateFullPreview() {
    if (!key) return

    isGenerating = true
    generationError = null

    const targetKeyId = key.id

    try {
      const json = await generatePreview($app, { kind: 'keyId', keyId: key.id }, $stlBuffersByModelId)

      const loader = new THREE.ObjectLoader()
      const group = loader.parse(json) as THREE.Group

      if (key && key.id === targetKeyId) {
        generatedMesh = group
      }
    } catch (err) {
      console.error('Preview generation failed', err)
      if (key && key.id === targetKeyId) {
        generationError = err instanceof Error ? err.message : 'Generation failed'
      }
    } finally {
      if (key && key.id === targetKeyId) {
        isGenerating = false
      }
    }
  }

  let selectedTemplateId: string = ''
  let prevTemplateId: string | null = null
  $: if (key && key.templateId !== prevTemplateId) {
    prevTemplateId = key.templateId
    selectedTemplateId = key.templateId
  }
  $: if (key && selectedTemplateId !== key.templateId) {
    actions.setKeyTemplate(key.id, selectedTemplateId)
  }

  function deleteKeyById(keyId: string) {
    actions.deleteKey(keyId)
  }

  function onRowKeydown(ev: KeyboardEvent, action: () => void) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault()
      action()
    }
  }

  function getKeyTemplate(keyId: string) {
    const k = $app.keys.find(k => k.id === keyId)
    if (!k) return null
    return $app.templates.find(t => t.id === k.templateId) ?? null
  }

  function getKeyModel(keyId: string) {
    const t = getKeyTemplate(keyId)
    if (!t) return null
    return $app.keycapModels.find(m => m.id === t.keycapModelId) ?? null
  }
</script>

<div class="grid gap-4 lg:grid-cols-12">
  <Card class="lg:col-span-4 lg:h-[calc(100vh-20rem)] lg:min-h-[24rem] flex flex-col">
    <CardHeader class="border-b">
      <div class="flex items-center justify-between gap-3 min-h-8">
        <div class="flex items-center gap-2 min-w-0">
          <CardTitle class="text-base">Keys</CardTitle>
          <HelpTooltip
            text="A key is a specific instance of a keycap that uses a template and contains actual text values. Each key represents one physical keycap you'll generate. Keys share the layout and styling from their template but have unique text for each symbol position (e.g., 'Q', 'Shift', 'Enter')."
          />
        </div>
        <Button size="sm" disabled={!hasTemplates} onclick={actions.createKey} title="New key">
          <Plus class="size-4" />
          <span class="hidden sm:inline">New</span>
        </Button>
      </div>
    </CardHeader>

    <CardContent class="flex-1 min-h-0 px-1">
      <ScrollArea class="lg:h-full w-full min-h-0 px-3">
        {#if $app.keys.length === 0}
          <div class="flex items-center justify-center h-64 text-sm text-muted-foreground">No keys created yet.</div>
        {:else}
          <div class="grid gap-2 px-1 py-6">
            {#each $app.keys as k (k.id)}
              {@const kTpl = getKeyTemplate(k.id)}
              {@const kModel = getKeyModel(k.id)}
              <Item
                size="sm"
                variant={$app.ui.selectedKeyId === k.id ? 'muted' : 'outline'}
                class="w-full justify-between"
              >
                {#snippet child({ props })}
                  <div
                    {...props}
                    class={(props.class as string) + ' w-full flex items-center gap-2'}
                    role="button"
                    tabindex="0"
                    onclick={() => actions.selectKey(k.id)}
                    onkeydown={(ev: KeyboardEvent) => onRowKeydown(ev, () => actions.selectKey(k.id))}
                  >
                    <div class="h-10 w-10 flex-shrink-0 flex items-center justify-start">
                      {#if kTpl && kModel}
                        <LabelPreview
                          template={kTpl}
                          contentBySymbolId={k.contentBySymbolId}
                          widthMm={kModel.widthMm}
                          heightMm={kModel.heightMm}
                          className="rounded"
                        />
                      {/if}
                    </div>
                    <ItemContent class="min-w-0 flex-1">
                      <ItemTitle class="truncate">{k.name}</ItemTitle>
                      <ItemDescription class="truncate">
                        {$app.templates.find(t => t.id === k.templateId)?.name ?? '—'}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions class="ms-auto">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="text-foreground/70 hover:text-foreground hover:bg-muted"
                        title="Delete key"
                        onclick={(ev: MouseEvent) => {
                          ev.preventDefault()
                          ev.stopPropagation()
                          deleteKeyById(k.id)
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
        <CardTitle class="text-base">Key configuration</CardTitle>
      </div>
    </CardHeader>

    <CardContent class="flex-1 min-h-0 px-1">
      <ScrollArea class="lg:h-full w-full min-h-0 px-3">
        {#if !key}
          <div class="flex items-center justify-center h-64 text-sm text-muted-foreground">
            Select a key to configure.
          </div>
        {:else}
          {@const nameId = `key-${key.id}-name`}
          {@const templateId = `key-${key.id}-template`}

          <FieldGroup class="py-5">
            <Field>
              <FieldLabel for={nameId}>Name</FieldLabel>
              <Input
                id={nameId}
                value={key.name}
                oninput={e => actions.renameKey(key.id, (e.currentTarget as HTMLInputElement).value)}
              />
            </Field>

            <Field>
              <FieldLabel for={templateId}>Template</FieldLabel>
              <Select type="single" bind:value={selectedTemplateId}>
                <SelectTrigger id={templateId} class="w-full" data-placeholder={!selectedTemplateId}>
                  <SelectValue
                    placeholder="Select a template"
                    value={$app.templates.find(t => t.id === selectedTemplateId)?.name ?? null}
                  />
                </SelectTrigger>
                <SelectContent class="w-full">
                  {#each $app.templates as t (t.id)}
                    <SelectItem value={t.id} label={t.name} />
                  {/each}
                </SelectContent>
              </Select>
            </Field>

            {#if !tpl}
              <div class="text-sm text-muted-foreground">This key references a missing template.</div>
            {:else}
              <div class="grid gap-2">
                <div class="text-sm font-medium">Symbols</div>
                <div class="grid gap-3">
                  {#each tpl.symbols as sym, index (sym.id)}
                    <div class="card-box w-full px-3 py-3">
                      <SymbolInput
                        label="{getSlotName(index)} ({getSlotSymbol(index)})"
                        content={getSymbolContent(key.id, sym.id)}
                        placeholder="Enter text..."
                        keyId={key.id}
                        symbolId={sym.id}
                        onContentChange={content => actions.setKeyContent(key.id, sym.id, content)}
                      />
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </FieldGroup>
        {/if}
      </ScrollArea>
    </CardContent>
  </Card>

  <Card class="lg:col-span-4 min-h-[16rem] lg:h-[calc(100vh-20rem)] lg:min-h-[24rem] flex flex-col">
    <CardHeader class="border-b">
      <div class="flex items-center justify-between gap-3 min-h-8">
        <CardTitle class="text-base">Preview</CardTitle>
        <Button
          size="sm"
          variant="outline"
          disabled={!key || !tpl || !model || showFullPreview}
          onclick={generateFullPreview}
          title="Render 3D keycap"
        >
          {#if isGenerating}
            <Loader2 class="size-4 animate-spin" />
          {:else}
            <Box class="size-4" />
          {/if}
          <span class="hidden sm:inline">Apply</span>
        </Button>
      </div>
    </CardHeader>
    <CardContent class="flex-1 min-h-0 relative p-0 overflow-hidden">
      {#if key && tpl && model}
        <div class="absolute inset-0">
          {#if isGenerating}
            <div
              class="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md rounded-xl transition-all"
              in:fade={{ duration: 500 }}
              out:fade={{ duration: 0 }}
            ></div>
          {/if}

          {#if generationError}
            <div
              class="absolute inset-0 z-40 flex items-center justify-center bg-background/80 p-4 text-center pointer-events-none"
            >
              <div class="text-destructive text-sm max-w-[80%]">
                <p class="font-bold">Generation Failed</p>
                <p>{generationError}</p>
              </div>
            </div>
          {/if}

          <KeycapPreview3D
            stlUrl={model.source.kind === 'server' ? model.source.url : null}
            stlBuffer={model.source.kind === 'upload' ? $stlBuffersByModelId[model.id] : null}
            {generatedMesh}
            widthMm={model.widthMm}
            heightMm={model.heightMm}
            rotationX={model.rotationX}
            rotationY={model.rotationY}
            rotationZ={model.rotationZ}
            enableControls={showFullPreview}
          />

          {#if !showFullPreview}
            <KeycapPreviewSVGOverlay
              template={tpl}
              contentBySymbolId={key.contentBySymbolId}
              widthMm={model.widthMm}
              heightMm={model.heightMm}
            />
          {/if}
        </div>
      {:else}
        <div class="flex items-center justify-center h-64 text-sm text-muted-foreground">
          Select a key with a valid template and model.
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
