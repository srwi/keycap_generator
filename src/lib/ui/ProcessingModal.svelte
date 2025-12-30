<script lang="ts">
  export let title: string
  export let statusText: string
  export let spinnerColor: string = 'text-blue-400'
  export let onCancel: () => void
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <div class="rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl max-w-md w-full mx-4">
    <div class="flex flex-col items-center gap-4">
      <svg
        class="animate-spin h-8 w-8 {spinnerColor}"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <div class="text-center">
        <h3 id="modal-title" class="text-sm font-semibold text-slate-200 mb-2">{title}</h3>
        <p class="text-sm text-slate-400">{statusText || 'Processing...'}</p>
      </div>
      <button
        class="mt-2 rounded-md border border-red-900/60 bg-red-950/30 px-4 py-2 text-sm text-red-200 hover:bg-red-950/60 transition-colors"
        on:click={onCancel}
      >
        Cancel
      </button>
    </div>
  </div>
</div>

