<script lang="ts">
  import { modalStore } from '../state/modalStore'
  import MessageModal from './MessageModal.svelte'
  import ConfirmModal from './ConfirmModal.svelte'

  function handleMessageClose() {
    modalStore.set(null)
  }

  function handleConfirmConfirm(data: { onConfirm: () => void }) {
    data.onConfirm()
    modalStore.set(null)
  }

  function handleConfirmCancel(data: { onCancel?: () => void }) {
    if (data.onCancel) {
      data.onCancel()
    }
    modalStore.set(null)
  }
</script>

{#if $modalStore}
  {#if $modalStore.type === 'message'}
    <MessageModal message={$modalStore.message} open={true} onClose={handleMessageClose} />
  {:else if $modalStore.type === 'confirm'}
    <ConfirmModal
      message={$modalStore.message}
      open={true}
      onConfirm={() => handleConfirmConfirm($modalStore)}
      onCancel={() => handleConfirmCancel($modalStore)}
    />
  {/if}
{/if}
