<script lang="ts">
  import { CircleQuestionMark } from 'lucide-svelte'
  import { Button } from '@/lib/components/ui/button'
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/lib/components/ui/tooltip'

  export let text: string
</script>

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}
        <Button
          variant="ghost"
          size="icon-sm"
          class="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
          aria-label="Help"
          {...props}
        >
          <CircleQuestionMark class="size-4" />
        </Button>
      {/snippet}
    </TooltipTrigger>
    <TooltipContent class="max-w-xs whitespace-normal">{text}</TooltipContent>
  </Tooltip>
</TooltipProvider>
