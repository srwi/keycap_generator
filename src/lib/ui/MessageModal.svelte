<script lang="ts">
  export let message: string
  export let open: boolean = true
  export let onClose: () => void = () => {}

  import { Button } from '@/lib/components/ui/button'
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/lib/components/ui/dialog'

  let isOpen = open
  $: isOpen = open
  $: if (!isOpen) onClose()
</script>

<Dialog bind:open={isOpen}>
  <DialogContent showCloseButton={false}>
    <DialogHeader>
      <DialogTitle>Message</DialogTitle>
      <DialogDescription class="whitespace-pre-line">{message}</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button onclick={() => (isOpen = false)}>OK</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
