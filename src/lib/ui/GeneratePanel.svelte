<script lang="ts">
  import { app, actions } from '../state/store'
  import { generateAll3mfs } from '../generate/generate'
  import { stlArrayBuffer } from '../state/sessionAssets'

  let isStlLoading = false
  let isGenerating = false
  let progressText = ''

  async function onStlFileSelected(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    isStlLoading = true
    try {
      const buf = await file.arrayBuffer()
      stlArrayBuffer.set(buf)
      const pathHint = (file as any).webkitRelativePath || file.name
      actions.setStlAsset({ fileName: file.name, pathHint })
    } finally {
      isStlLoading = false
    }
  }

  async function onGenerate() {
    if (!$app.stl || !$stlArrayBuffer) return
    isGenerating = true
    progressText = ''
    try {
      await generateAll3mfs($app, $stlArrayBuffer, (p) => {
        progressText = `Generating ${p.current}/${p.total}: ${p.keyName}`
      })
      progressText = `Done. Downloaded ${$app.keys.length} file(s).`
    } catch (e) {
      console.error(e)
      progressText = e instanceof Error ? e.message : 'Generation failed.'
      window.alert(progressText)
    } finally {
      isGenerating = false
    }
  }
</script>

<div class="grid gap-4 lg:grid-cols-[1fr_1fr]">
  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4">
    <div class="text-sm font-semibold">Base keycap STL</div>
    <div class="mt-3 grid gap-3">
      <label class="grid gap-1 text-xs text-slate-400">
        Upload STL (single keycap, face pointing down)
        <input
          class="block w-full cursor-pointer rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:text-slate-100 hover:file:bg-slate-700"
          type="file"
          accept=".stl,model/stl"
          on:change={onStlFileSelected}
          disabled={isStlLoading}
        />
      </label>

      <div class="text-sm">
        <div class="text-xs text-slate-400">Loaded</div>
        <div class="font-mono text-xs text-slate-200">
          {$app.stl?.fileName ?? '—'}
        </div>
      </div>

      <div class="text-sm">
        <div class="text-xs text-slate-400">Saved reference</div>
        <div class="font-mono text-xs text-slate-200">
          {$app.stl?.pathHint ?? '—'}
        </div>
      </div>

      <div class="text-xs text-slate-400">
        STL bytes are never stored in the project file. After loading a project, re-upload the STL to generate.
      </div>
    </div>
  </section>

  <section class="rounded-lg border border-slate-800 bg-slate-950 p-4">
    <div class="text-sm font-semibold">Generate 3MF</div>
    <div class="mt-3 grid gap-3">
      <label class="grid gap-1 text-xs text-slate-400">
        Extrusion depth (mm)
        <input
          class="w-48 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          type="number"
          min="0.1"
          step="0.1"
          value={$app.settings.extrusionDepthMm}
          on:input={(e) => actions.setExtrusionDepthMm(Number((e.currentTarget as HTMLInputElement).value))}
        />
      </label>

      <button
        class="w-fit rounded-md border border-emerald-900/60 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-950/60 disabled:opacity-50"
        disabled={$stlArrayBuffer == null || $app.keys.length === 0 || isGenerating}
        on:click={onGenerate}
      >
        {isGenerating ? 'Generating…' : `Generate & download 3MF files (${$app.keys.length})`}
      </button>

      {#if $stlArrayBuffer == null}
        <div class="text-xs text-amber-300/90">Upload a base STL first.</div>
      {/if}

      {#if progressText}
        <div class="text-xs text-slate-300">{progressText}</div>
      {/if}
    </div>
  </section>
</div>


