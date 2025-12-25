import { writable } from 'svelte/store'

// Session-only (never exported in project file).
export const stlArrayBuffer = writable<ArrayBuffer | null>(null)


