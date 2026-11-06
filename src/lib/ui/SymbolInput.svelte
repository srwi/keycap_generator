<script lang="ts">
  import type { IconRotationDeg, IconTransform, SymbolContent } from '../state/types'
  import {
    getIcon,
    loadIcon,
    PHOSPHOR_ICON_VIEWBOX,
    parseIconName,
    buildIconName,
    type IconInfo,
    type IconVariant,
  } from '../services/icons'
  import { getIconTransform, iconFlipScale, ICON_ROTATIONS, IDENTITY_ICON_TRANSFORM } from '../utils/iconTransform'
  import { InputGroup, InputGroupInput, InputGroupAddon } from '@/lib/components/ui/input-group'
  import { Switch } from '@/lib/components/ui/switch'
  import { Popover, PopoverContent, PopoverTrigger } from '@/lib/components/ui/popover'
  import { Button } from '@/lib/components/ui/button'
  import { ButtonGroup } from '@/lib/components/ui/button-group'
  import { FlipHorizontal, FlipVertical } from 'lucide-svelte'
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
  let iconTransform: IconTransform = getIconTransform(content)

  $: previewFlip = iconFlipScale(iconTransform)
  $: previewCenter = PHOSPHOR_ICON_VIEWBOX / 2

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
      iconTransform = getIconTransform(content)
      textValue = ''
    } else if (content?.kind === 'text') {
      iconMode = false
      textValue = content.value
      iconName = ''
      iconTransform = IDENTITY_ICON_TRANSFORM
    } else {
      textValue = ''
      iconName = ''

      // Only force default mode (text) if selection changed
      if (selectionChanged) {
        iconMode = false
        iconTransform = IDENTITY_ICON_TRANSFORM
      }
    }
  }

  function emitIconContent() {
    onContentChange(iconName ? { kind: 'icon', iconName, ...iconTransform } : null)
  }

  function handleModeChange(checked: boolean) {
    iconMode = checked
    if (iconMode) {
      textValue = ''
      emitIconContent()
    } else {
      iconName = ''
      popoverOpen = false
      onContentChange(textValue.trim() ? { kind: 'text', value: textValue } : null)
    }
  }

  function setIconRotation(rotationDeg: IconRotationDeg) {
    iconTransform = { ...iconTransform, rotationDeg }
    emitIconContent()
  }

  function toggleFlipAcrossX() {
    iconTransform = { ...iconTransform, flipAcrossX: !iconTransform.flipAcrossX }
    emitIconContent()
  }

  function toggleFlipAcrossY() {
    iconTransform = { ...iconTransform, flipAcrossY: !iconTransform.flipAcrossY }
    emitIconContent()
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
    emitIconContent()
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
                  <g
                    transform="translate({previewCenter} {previewCenter}) rotate({iconTransform.rotationDeg}) scale({previewFlip.x} {previewFlip.y}) translate({-previewCenter} {-previewCenter})"
                  >
                    <path d={selectedIcon.path} />
                  </g>
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

    {#if iconName}
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-muted-foreground">Rotation</span>
        <ButtonGroup>
          {#each ICON_ROTATIONS as deg (deg)}
            <Button
              variant={iconTransform.rotationDeg === deg ? 'default' : 'outline'}
              size="sm"
              class="px-2 text-xs"
              aria-pressed={iconTransform.rotationDeg === deg}
              onclick={() => setIconRotation(deg)}
            >
              {deg}°
            </Button>
          {/each}
        </ButtonGroup>
        <ButtonGroup>
          <Button
            variant={iconTransform.flipAcrossX ? 'default' : 'outline'}
            size="icon-sm"
            aria-label="Flip across X axis"
            title="Flip across X axis"
            aria-pressed={iconTransform.flipAcrossX}
            onclick={toggleFlipAcrossX}
          >
            <FlipVertical class="size-4" />
          </Button>
          <Button
            variant={iconTransform.flipAcrossY ? 'default' : 'outline'}
            size="icon-sm"
            aria-label="Flip across Y axis"
            title="Flip across Y axis"
            aria-pressed={iconTransform.flipAcrossY}
            onclick={toggleFlipAcrossY}
          >
            <FlipHorizontal class="size-4" />
          </Button>
        </ButtonGroup>
      </div>
    {/if}
  {:else}
    <InputGroup>
      <InputGroupInput type="text" {placeholder} value={textValue} oninput={handleTextInput} />
    </InputGroup>
  {/if}
</div>
