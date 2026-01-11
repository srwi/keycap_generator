import { getPublicPath } from '../utils/paths'

export type KeycapEntry = {
  path: string
  displayName: string
  author: string
  authorLink: string
  license: string
}

export type Category = {
  name: string
  keycaps: KeycapEntry[]
}

export type Registry = {
  categories: Category[]
}

function isRegistry(value: unknown): value is Registry {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Registry
  return Array.isArray(v.categories)
}

export async function loadStlRegistry(): Promise<Registry> {
  const response = await fetch(getPublicPath('stls/registry.json'))
  if (!response.ok) {
    throw new Error(`Failed to load STL registry: ${response.status} ${response.statusText}`)
  }

  const json = (await response.json()) as unknown
  if (!isRegistry(json)) {
    throw new Error('Invalid STL registry format')
  }
  return json
}

export function extractPathFromUrl(url: string): string | null {
  const baseUrl = getPublicPath('stls/')
  if (url.startsWith(baseUrl)) {
    return url.slice(baseUrl.length)
  }
  const stlsIndex = url.indexOf('stls/')
  if (stlsIndex !== -1) {
    return url.slice(stlsIndex + 5)
  }
  return null
}

export function findKeycapByPath(registry: Registry, path: string): { category: string; keycap: KeycapEntry } | null {
  for (const category of registry.categories) {
    const keycap = category.keycaps.find(k => k.path === path)
    if (keycap) {
      return { category: category.name, keycap }
    }
  }
  return null
}
