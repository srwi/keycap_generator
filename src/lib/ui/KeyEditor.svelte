<script lang="ts">
  import { app, actions, selectedKey, getSlotName, getSlotSymbol } from '../state/store'
  import type { SymbolContent } from '../state/types'
  import LabelPreview from './LabelPreview.svelte'
  import KeycapPreview from './KeycapPreview.svelte'
  import SymbolInput from './SymbolInput.svelte'
  import { X, Plus } from 'lucide-svelte'
  import HelpTooltip from './HelpTooltip.svelte'
  import { Button } from '@/lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card'
  import { Field, FieldGroup, FieldLabel } from '@/lib/components/ui/field'
  import { Input } from '@/lib/components/ui/input'
  import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/lib/components/ui/item'
  import { ScrollArea } from '@/lib/components/ui/scroll-area'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/lib/components/ui/select'
  import { Switch } from '@/lib/components/ui/switch'
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/lib/components/ui/tooltip'

  function getSymbolContent(keyId: string, symbolId: string): SymbolContent | null {
    const k = $app.keys.find(k => k.id === keyId)
    if (!k) return null
    return k.contentBySymbolId[symbolId] ?? null
  }

  $: key = $selectedKey
  $: tpl = key == null ? null : ($app.templates.find(t => t.id === key.templateId) ?? null)
  $: model = tpl == null ? null : ($app.keycapModels.find(m => m.id === tpl.keycapModelId) ?? null)
  $: modelWidthMm = model?.widthMm ?? 0
  $: modelHeightMm = model?.heightMm ?? 0
  $: hasTemplates = $app.templates.length > 0
  let previewIs3d = false
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
  <Card class="lg:col-span-4">
    <CardHeader class="border-b">
      <div class="flex items-center justify-between gap-3 min-h-8">
        <div class="flex items-center gap-2 min-w-0">
          <CardTitle class="text-base">Keys</CardTitle>
          <HelpTooltip
            text="A key is a specific instance of a keycap that uses a template and contains actual text values. Each key represents one physical keycap you'll generate. Keys share the layout and styling from their template but have unique text for each symbol position (e.g., 'Q', 'Shift', 'Enter')."
          />
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              {#snippet child({ props })}
                <Button size="sm" disabled={!hasTemplates} onclick={actions.createKey} title="New key" {...props}>
                  <Plus class="size-4" />
                  <span class="hidden sm:inline">New</span>
                </Button>
              {/snippet}
            </TooltipTrigger>
            {#if !hasTemplates}
              <TooltipContent class="max-w-xs whitespace-normal">
                Create at least one template before creating a key. Keys require a template to define their layout and
                styling.
              </TooltipContent>
            {/if}
          </Tooltip>
        </TooltipProvider>
      </div>
    </CardHeader>

    <CardContent>
      <ScrollArea class="h-[32rem] w-full">
        <div class="grid gap-2 p-1">
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
      </ScrollArea>
    </CardContent>
  </Card>

  <Card class="lg:col-span-4">
    <CardHeader class="border-b">
      <div class="flex items-center justify-between gap-3 min-h-8">
        <CardTitle class="text-base">Key configuration</CardTitle>
      </div>
    </CardHeader>

    <CardContent>
      {#if !key}
        <div class="flex items-center justify-center h-64 text-sm text-muted-foreground">
          Create/select a key to edit.
        </div>
      {:else}
        {@const nameId = `key-${key.id}-name`}
        {@const templateId = `key-${key.id}-template`}

        <FieldGroup>
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
                      onContentChange={content => actions.setKeyContent(key.id, sym.id, content)}
                    />
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </FieldGroup>
      {/if}
    </CardContent>
  </Card>

  <Card class="lg:col-span-4">
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
    <CardContent>
      <KeycapPreview
        template={tpl}
        contentBySymbolId={key?.contentBySymbolId ?? {}}
        widthMm={modelWidthMm}
        heightMm={modelHeightMm}
        keyId={key?.id ?? null}
        bind:is3d={previewIs3d}
      />
    </CardContent>
  </Card>
</div>
