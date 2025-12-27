import { writable } from 'svelte/store'

// Session-only STL bytes (never exported in project file).
export const stlBuffersByModelId = writable<Record<string, ArrayBuffer | null>>({})


