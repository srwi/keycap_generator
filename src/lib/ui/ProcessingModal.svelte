<script lang="ts">
  import LabelPreview from './LabelPreview.svelte'
  import type { Template } from '../state/types'
  import { Button } from '@/lib/components/ui/button'
  import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/lib/components/ui/dialog'
  import { Progress } from '@/lib/components/ui/progress'

  export let title: string
  export let onCancel: () => void
  export let current: number = 0
  export let total: number = 0
  export let previewTemplate: Template | null = null
  export let previewTextsBySymbolId: Record<string, string> = {}
  export let previewWidthMm: number = 0
  export let previewHeightMm: number = 0

  $: progressPercent = total > 0 ? (current / total) * 100 : 0
</script>

<Dialog open={true}>
  <DialogContent showCloseButton={false} class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
    </DialogHeader>

    {#if previewTemplate}
      <div class="flex justify-center">
        <LabelPreview
          template={previewTemplate}
          textsBySymbolId={previewTextsBySymbolId}
          widthMm={previewWidthMm}
          heightMm={previewHeightMm}
          className="max-w-[120px]"
        />
      </div>
    {/if}

    {#if total > 0}
      <div class="space-y-2">
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>{current} / {total}</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <Progress value={progressPercent} />
      </div>
    {/if}

    <DialogFooter>
      <Button variant="destructive" onclick={onCancel}>Cancel</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
