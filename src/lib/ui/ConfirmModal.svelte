<script lang="ts">
  import Modal from './Modal.svelte'

  export let message: string
  export let open: boolean = true
  export let onConfirm: () => void = () => {}
  export let onCancel: () => void = () => {}

  function handleConfirm() {
    onConfirm()
  }

  function handleCancel() {
    onCancel()
  }
</script>

<Modal title="Confirm" {open}>
  <div class="w-full mb-6">
    <p class="text-slate-300 text-center whitespace-pre-line">{message}</p>
  </div>
  <div class="flex gap-3">
    <button
      class="flex-1 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
      on:click={handleCancel}
    >
      Cancel
    </button>
    <button
      class="flex-1 rounded-md border border-red-900/60 bg-red-950/30 px-4 py-2 text-sm text-red-200 hover:bg-red-950/60 transition-colors"
      on:click={handleConfirm}
    >
      Confirm
    </button>
  </div>
</Modal>
