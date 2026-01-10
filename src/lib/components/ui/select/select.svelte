<script lang="ts">
  import { Select as SelectPrimitive } from 'bits-ui'

  let { open = $bindable(false), value = $bindable(''), ...restProps }: SelectPrimitive.RootProps = $props()

  // bits-ui's `SelectRootPropsWithoutHTML` is a discriminated union between single/multiple.
  // In Svelte component type inference, the discrimination can fail when wrapping the component.
  // We default to single-select and cast to keep consuming code strongly typed.
  const restPropsAny = restProps as any
</script>

<SelectPrimitive.Root type={'single' as any} bind:open bind:value={value as any} {...restPropsAny} />
