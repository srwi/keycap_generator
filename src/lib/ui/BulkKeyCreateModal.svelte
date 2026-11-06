<script lang="ts">
  import { app, getSlotName, getSlotSymbol } from '../state/store'
  import { Button } from '@/lib/components/ui/button'
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/lib/components/ui/dialog'
  import { Field, FieldGroup, FieldLabel } from '@/lib/components/ui/field'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/lib/components/ui/select'

  export let open: boolean = true
  export let title: string = 'Create keys'
  export let characters: string[] = []
  export let onConfirm: (templateId: string) => void = () => {}
  export let onCancel: () => void = () => {}

  let isOpen = open
  $: isOpen = open
  let closeHandled = false
  $: if (isOpen) closeHandled = false
  $: if (!isOpen && !closeHandled) {
    closeHandled = true
    onCancel()
  }

  let templateId: string = $app.ui.selectedTemplateId ?? $app.templates[0]?.id ?? ''

  $: selectedTemplate = $app.templates.find(t => t.id === templateId) ?? null
  $: targetSymbol = selectedTemplate?.symbols[0] ?? null

  function handleConfirm() {
    if (!templateId) return
    closeHandled = true
    isOpen = false
    onConfirm(templateId)
  }
</script>

<Dialog bind:open={isOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>
        Pick the template to apply. Each key is named "Auto Generated {'{'}character{'}'}".
      </DialogDescription>
    </DialogHeader>

    <FieldGroup>
      <Field>
        <FieldLabel for="bulk-key-template">Template</FieldLabel>
        <Select type="single" bind:value={templateId}>
          <SelectTrigger id="bulk-key-template" class="w-full" data-placeholder={!templateId}>
            <SelectValue placeholder="Select a template" value={selectedTemplate?.name ?? null} />
          </SelectTrigger>
          <SelectContent class="w-full">
            {#each $app.templates as t (t.id)}
              <SelectItem value={t.id} label={t.name} />
            {/each}
          </SelectContent>
        </Select>
      </Field>

      <div class="text-sm text-muted-foreground">
        {#if !selectedTemplate}
          Select a template to continue.
        {:else if !targetSymbol}
          This template has no symbol slot, so the characters cannot be placed.
        {:else}
          {characters.length} keys, each with its character in {getSlotName(0)} ({getSlotSymbol(0)}).
        {/if}
      </div>
    </FieldGroup>

    <DialogFooter>
      <Button variant="outline" onclick={() => (isOpen = false)}>Cancel</Button>
      <Button disabled={!selectedTemplate || !targetSymbol} onclick={handleConfirm}>Create</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
