<script lang="ts">
  import Modal from './Modal.svelte'

  export let message: string
  export let open: boolean = true
  export let onClose: () => void = () => {}

  function handleClose() {
    onClose()
  }
</script>

<Modal title="Message" {open}>
  <div class="w-full mb-6">
    <p class="text-slate-300 text-center">{message}</p>
  </div>
  <button
    class="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
    on:click={handleClose}
  >
    OK
  </button>
</Modal>
