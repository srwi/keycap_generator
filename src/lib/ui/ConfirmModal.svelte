<script lang="ts">
  export let message: string
  export let open: boolean = true
  export let onConfirm: () => void = () => {}
  export let onCancel: () => void = () => {}

  import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from '@/lib/components/ui/alert-dialog'

  let isOpen = open
  $: isOpen = open
  let closeHandled = false
  $: if (isOpen) closeHandled = false
  $: if (!isOpen && !closeHandled) {
    closeHandled = true
    onCancel()
  }

  function handleCancel() {
    closeHandled = true
    isOpen = false
    onCancel()
  }

  function handleConfirm() {
    closeHandled = true
    isOpen = false
    onConfirm()
  }
</script>

<AlertDialog bind:open={isOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Confirm</AlertDialogTitle>
      <AlertDialogDescription class="whitespace-pre-line">{message}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onclick={handleCancel}>Cancel</AlertDialogCancel>
      <AlertDialogAction
        class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onclick={handleConfirm}>Confirm</AlertDialogAction
      >
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
