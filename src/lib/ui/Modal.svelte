<script lang="ts">
  export let title: string
  export let open: boolean = true
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <div class="rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl max-w-md w-full mx-4">
      <div class="flex flex-col items-center">
        <h3 id="modal-title" class="text-lg font-semibold text-slate-200 mb-6">{title}</h3>
        <slot />
      </div>
    </div>
  </div>
{/if}
