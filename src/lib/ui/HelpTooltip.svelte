<script lang="ts">
  import { CircleQuestionMark } from 'lucide-svelte'
  import { onMount, onDestroy } from 'svelte'

  export let text: string

  let showTooltip = false
  let tooltipElement: HTMLDivElement
  let containerElement: HTMLDivElement

  function handleMouseEnter() {
    showTooltip = true
  }

  function handleMouseLeave() {
    showTooltip = false
  }

  function handleClick(event: MouseEvent) {
    event.stopPropagation()
    showTooltip = !showTooltip
  }

  function handleClickOutside(event: MouseEvent) {
    if (containerElement && !containerElement.contains(event.target as Node)) {
      showTooltip = false
    }
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('click', handleClickOutside)
    }
  })

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('click', handleClickOutside)
    }
  })
</script>

<div class="relative inline-flex items-center" bind:this={containerElement} role="group">
  <button
    type="button"
    class="text-slate-400 hover:text-slate-300 transition-colors focus:outline-none"
    on:click={handleClick}
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
    aria-label="Help"
    aria-expanded={showTooltip}
    aria-haspopup="true"
  >
    <CircleQuestionMark class="h-4 w-4" />
  </button>

  {#if showTooltip}
    <div
      bind:this={tooltipElement}
      class="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-50 w-64 p-3 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-200 shadow-lg"
      role="tooltip"
    >
      <div class="whitespace-normal">{text}</div>
      <!-- Arrow -->
      <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
        <div class="w-2 h-2 border-l border-b border-slate-700 bg-slate-900 rotate-[-45deg]"></div>
      </div>
    </div>
  {/if}
</div>
