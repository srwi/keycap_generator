import { getStlDimensions } from '../generate/stl'

const stlDimensionsCache = new Map<string, { widthMm: number; heightMm: number }>()

export async function fetchStlDimensions(url: string): Promise<{ widthMm: number; heightMm: number }> {
  const cached = stlDimensionsCache.get(url)
  if (cached) return cached

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch STL (${res.status} ${res.statusText})`)
  }

  const buf = await res.arrayBuffer()
  const dims = await getStlDimensions(buf)
  stlDimensionsCache.set(url, dims)
  return dims
}

