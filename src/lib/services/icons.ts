/**
 * Phosphor Icons Service
 *
 * Provides access to Phosphor icons for both 2D rendering (SVG paths)
 * and 3D generation (path data for extrusion).
 *
 * Uses a bundled icon data approach for performance.
 */

// Import icon metadata from @phosphor-icons/core
import { icons as iconsMeta } from '@phosphor-icons/core'

/** Phosphor icons use a 256x256 viewBox */
export const PHOSPHOR_ICON_VIEWBOX = 256

export interface IconInfo {
  name: string
  displayName: string
  path: string
}

// Cache for icon paths (loaded on demand)
const iconPathCache = new Map<string, string>()
let allIconsMetaCache: Array<{ name: string; displayName: string }> | null = null

/**
 * Convert kebab-case icon name to display name
 */
function toDisplayName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Extract SVG path data from SVG string
 */
function extractPathFromSvg(svg: string): string {
  const pathMatches = svg.matchAll(/<path[^>]*d="([^"]+)"/g)
  const paths: string[] = []
  for (const match of pathMatches) {
    if (match[1]) paths.push(match[1])
  }
  return paths.join(' ')
}

/**
 * Get all icon metadata (name and display name only, no paths yet)
 */
export function getAllIconsMeta(): Array<{ name: string; displayName: string }> {
  if (allIconsMetaCache) return allIconsMetaCache

  allIconsMetaCache = iconsMeta.map(meta => ({
    name: meta.name,
    displayName: toDisplayName(meta.name),
  }))

  allIconsMetaCache.sort((a, b) => a.displayName.localeCompare(b.displayName))
  return allIconsMetaCache
}

/**
 * Fetch and cache the path for a specific icon
 */
async function loadIconPath(iconName: string): Promise<string | null> {
  const cached = iconPathCache.get(iconName)
  if (cached) return cached

  try {
    const baseUrl = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular'
    const response = await fetch(`${baseUrl}/${iconName}.svg`)
    if (!response.ok) return null

    const svg = await response.text()
    const path = extractPathFromSvg(svg)
    if (path) {
      iconPathCache.set(iconName, path)
    }
    return path || null
  } catch {
    return null
  }
}

/**
 * Get all available icons (with paths loaded)
 */
export function getAllIcons(): IconInfo[] {
  const meta = getAllIconsMeta()
  return meta
    .map(m => {
      const path = iconPathCache.get(m.name)
      if (!path) return null
      return { name: m.name, displayName: m.displayName, path }
    })
    .filter((i): i is IconInfo => i !== null)
}

/**
 * Get all icons with their paths loaded asynchronously
 */
export async function loadAllIcons(): Promise<IconInfo[]> {
  const meta = getAllIconsMeta()

  // Load icons in batches to avoid overwhelming the browser
  const batchSize = 50
  const results: IconInfo[] = []

  for (let i = 0; i < meta.length; i += batchSize) {
    const batch = meta.slice(i, i + batchSize)
    const loadPromises = batch.map(async m => {
      const path = await loadIconPath(m.name)
      if (!path) return null
      return { name: m.name, displayName: m.displayName, path }
    })

    const batchResults = await Promise.all(loadPromises)
    results.push(...batchResults.filter((i): i is IconInfo => i !== null))
  }

  return results
}

/**
 * Get a specific icon by name (async)
 */
export async function loadIcon(name: string): Promise<IconInfo | null> {
  const meta = getAllIconsMeta().find(m => m.name === name)
  if (!meta) return null

  const path = await loadIconPath(name)
  if (!path) return null

  return { name: meta.name, displayName: meta.displayName, path }
}

/**
 * Get a specific icon by name (sync, from cache only)
 */
export function getIcon(name: string): IconInfo | null {
  const path = iconPathCache.get(name)
  if (!path) return null

  const meta = getAllIconsMeta().find(m => m.name === name)
  if (!meta) return null

  return { name: meta.name, displayName: meta.displayName, path }
}

/**
 * Search icons by name (returns metadata only, paths may not be loaded)
 */
export function searchIconsMeta(query: string): Array<{ name: string; displayName: string }> {
  const allIcons = getAllIconsMeta()

  if (!query.trim()) return allIcons

  const lowerQuery = query.toLowerCase().trim()
  return allIcons.filter(
    icon => icon.name.toLowerCase().includes(lowerQuery) || icon.displayName.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Search and load icons
 */
export function searchIcons(query: string): IconInfo[] {
  const meta = searchIconsMeta(query)
  return meta
    .map(m => {
      const path = iconPathCache.get(m.name)
      if (!path) return null
      return { name: m.name, displayName: m.displayName, path }
    })
    .filter((i): i is IconInfo => i !== null)
}

/**
 * Get SVG path data for an icon, scaled for rendering
 */
export function getIconPath(
  iconName: string,
  sizeMm: number
): { path: string; width: number; height: number; x: number; y: number } | null {
  const icon = getIcon(iconName)
  if (!icon) return null

  const scale = sizeMm / PHOSPHOR_ICON_VIEWBOX
  const transformedPath = transformSvgPath(icon.path, scale, 0, 0)

  return {
    path: transformedPath,
    width: sizeMm,
    height: sizeMm,
    x: 0,
    y: 0,
  }
}

/**
 * Get SVG path data for an icon (async version)
 */
export async function loadIconPath2(
  iconName: string,
  sizeMm: number
): Promise<{ path: string; width: number; height: number; x: number; y: number } | null> {
  let icon = getIcon(iconName)
  if (!icon) {
    icon = await loadIcon(iconName)
  }
  if (!icon) return null

  const scale = sizeMm / PHOSPHOR_ICON_VIEWBOX
  const transformedPath = transformSvgPath(icon.path, scale, 0, 0)

  return {
    path: transformedPath,
    width: sizeMm,
    height: sizeMm,
    x: 0,
    y: 0,
  }
}

/**
 * Transform SVG path by scaling
 */
function transformSvgPath(path: string, scale: number, translateX: number, translateY: number): string {
  return path.replace(/([MLHVCSQTAZ])([^MLHVCSQTAZ]*)/gi, (match, cmd: string, args: string) => {
    const upperCmd = cmd.toUpperCase()
    const isRelative = cmd === cmd.toLowerCase()

    if (upperCmd === 'Z') return cmd

    const numbers = args.match(/-?[\d.]+/g)?.map(Number) ?? []
    if (numbers.length === 0) return match

    let transformed: number[]

    switch (upperCmd) {
      case 'M':
      case 'L':
      case 'T':
        transformed = numbers.map((n, i) => {
          const scaled = n * scale
          return isRelative ? scaled : scaled + (i % 2 === 0 ? translateX : translateY)
        })
        break

      case 'H':
        transformed = numbers.map(n => {
          const scaled = n * scale
          return isRelative ? scaled : scaled + translateX
        })
        break

      case 'V':
        transformed = numbers.map(n => {
          const scaled = n * scale
          return isRelative ? scaled : scaled + translateY
        })
        break

      case 'C':
      case 'S':
      case 'Q':
        transformed = numbers.map((n, i) => {
          const scaled = n * scale
          return isRelative ? scaled : scaled + (i % 2 === 0 ? translateX : translateY)
        })
        break

      case 'A':
        transformed = numbers.map((n, i) => {
          if (i === 0 || i === 1) return n * scale
          if (i === 2 || i === 3 || i === 4) return n
          const scaled = n * scale
          return isRelative ? scaled : scaled + (i === 5 ? translateX : translateY)
        })
        break

      default:
        transformed = numbers.map(n => n * scale)
    }

    return cmd + transformed.map(n => n.toFixed(2)).join(' ')
  })
}

/**
 * Get the raw SVG path for an icon (unscaled)
 */
export function getRawIconPath(iconName: string): string | null {
  return iconPathCache.get(iconName) ?? null
}

/**
 * Get the raw SVG path for an icon (async)
 */
export async function loadRawIconPath(iconName: string): Promise<string | null> {
  const cached = iconPathCache.get(iconName)
  if (cached) return cached
  return loadIconPath(iconName)
}
