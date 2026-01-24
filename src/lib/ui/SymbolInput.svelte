<script lang="ts">
  import type { SymbolContent } from '../state/types'
  import {
    getIcon,
    loadIcon,
    PHOSPHOR_ICON_VIEWBOX,
    parseIconName,
    buildIconName,
    type IconInfo,
    type IconVariant,
  } from '../services/icons'
  import { InputGroup, InputGroupInput, InputGroupAddon } from '@/lib/components/ui/input-group'
  import { Switch } from '@/lib/components/ui/switch'
  import { Popover, PopoverContent, PopoverTrigger } from '@/lib/components/ui/popover'
  import IconPicker from './IconPicker.svelte'

  export let content: SymbolContent | null = null
  export let placeholder = 'Enter text...'
  export let label = ''
  export let onContentChange: (content: SymbolContent | null) => void = () => {}
  export let keyId: string = ''
  export let symbolId: string = ''

  let iconMode = content?.kind === 'icon'
  let textValue = content?.kind === 'text' ? content.value : ''
  let iconName = content?.kind === 'icon' ? content.iconName : ''
  let popoverOpen = false
  let selectedIcon: IconInfo | null = null

  // Load icon info when icon name changes (parse variant from stored name)
  $: if (iconName) {
    const { baseName, variant } = parseIconName(iconName)
    selectedIcon = getIcon(baseName, variant)
    if (!selectedIcon) {
      loadIcon(baseName, variant).then(icon => {
        if (icon) selectedIcon = icon
      })
    }
  } else {
    selectedIcon = null
  }

  let prevKeySymbol = ''

  $: {
    const currentKeySymbol = keyId + '|' + symbolId
    const selectionChanged = currentKeySymbol !== prevKeySymbol

    if (selectionChanged) {
      prevKeySymbol = currentKeySymbol
    }

    if (content?.kind === 'icon') {
      iconMode = true
      iconName = content.iconName
      textValue = ''
    } else if (content?.kind === 'text') {
      iconMode = false
      textValue = content.value
      iconName = ''
    } else {
      textValue = ''
      iconName = ''

      // Only force default mode (text) if selection changed
      if (selectionChanged) {
        iconMode = false
      }
    }
  }

  function handleModeChange(checked: boolean) {
    iconMode = checked
    if (iconMode) {
      textValue = ''
      onContentChange(iconName ? { kind: 'icon', iconName } : null)
    } else {
      iconName = ''
      popoverOpen = false
      onContentChange(textValue.trim() ? { kind: 'text', value: textValue } : null)
    }
  }

  function handleTextInput(e: Event) {
    const value = (e.target as HTMLInputElement).value
    textValue = value
    onContentChange(value.trim() ? { kind: 'text', value } : null)
  }

  function handleIconSelect(name: string, variant: IconVariant) {
    const fullName = buildIconName(name, variant)
    iconName = fullName
    popoverOpen = false
    onContentChange({ kind: 'icon', iconName: fullName })
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center justify-between">
    {#if label}
      <span class="text-xs font-medium text-muted-foreground capitalize">{label}</span>
    {:else}
      <span></span>
    {/if}

    <div class="flex items-center gap-2">
      <span
        class="flex items-center gap-1 text-xs {!iconMode ? 'text-foreground font-medium' : 'text-muted-foreground'}"
      >
        Text
      </span>
      <Switch checked={iconMode} onCheckedChange={handleModeChange} aria-label="Toggle between text and icon input" />
      <span
        class="flex items-center gap-1 text-xs {iconMode ? 'text-foreground font-medium' : 'text-muted-foreground'}"
      >
        Icon
      </span>
    </div>
  </div>

  {#if iconMode}
    <Popover bind:open={popoverOpen}>
      <PopoverTrigger>
        <button type="button" class="w-full text-left">
          <InputGroup>
            {#if selectedIcon}
              <InputGroupAddon align="inline-start">
                <svg
                  viewBox="0 0 {PHOSPHOR_ICON_VIEWBOX} {PHOSPHOR_ICON_VIEWBOX}"
                  class="size-4"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d={selectedIcon.path} />
                </svg>
              </InputGroupAddon>
            {/if}
            <InputGroupInput
              readonly
              value={selectedIcon?.displayName ?? ''}
              placeholder="Pick icon..."
              class="cursor-pointer"
            />
          </InputGroup>
        </button>
      </PopoverTrigger>
      <PopoverContent class="w-80 p-0" align="start">
        <IconPicker onSelect={handleIconSelect} />
      </PopoverContent>
    </Popover>
  {:else}
    <InputGroup>
      <InputGroupInput type="text" {placeholder} value={textValue} oninput={handleTextInput} />
    </InputGroup>
  {/if}
</div>
