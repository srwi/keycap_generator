<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { cn, type WithElementRef, type WithoutChildren } from '@/lib/utils.js'

  let {
    ref = $bindable(null),
    class: className,
    placeholder,
    value,
    'data-slot': dataSlot = 'select-value',
    ...restProps
  }: WithoutChildren<WithElementRef<HTMLAttributes<HTMLSpanElement>>> & {
    placeholder?: string
    /**
     * Text to display when a value is selected.
     *
     * Note: bits-ui doesn't expose a built-in "Value" component; shadcn's SelectValue is
     * a presentational wrapper. Pass the label you want shown here.
     */
    value?: string | null
  } = $props()

  const isPlaceholder = $derived(!value)
</script>

<span
  bind:this={ref}
  data-slot={dataSlot}
  data-placeholder={isPlaceholder}
  class={cn(className)}
  {...restProps}
>
  {value ?? placeholder ?? ''}
</span>
