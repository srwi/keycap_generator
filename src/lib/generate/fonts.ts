import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import type { FontFamily, FontWeight } from '../state/types'
import * as opentype from 'opentype.js'

// Font file registry - maps font family/weight to TTF file paths
const FONT_REGISTRY: Record<string, string> = {
  'roboto:regular': '/fonts/Roboto/Roboto-Regular.ttf',
  'roboto:bold': '/fonts/Roboto/Roboto-Bold.ttf',
  'notoserif:regular': '/fonts/NotoSerif/NotoSerif-Regular.ttf',
  'notoserif:bold': '/fonts/NotoSerif/NotoSerif-Bold.ttf',
}

// Cache for Three.js Font objects (for 3D rendering)
const fontCache = new Map<string, Font>()

// Cache for opentype.js Font objects (for 2D SVG rendering)
const opentypeFontCache = new Map<string, opentype.Font>()

// Cache for loading promises to avoid duplicate loads
const loadingPromises = new Map<string, Promise<void>>()

/**
 * Get the font key for caching
 */
function getFontKey(family: FontFamily, weight: FontWeight): string {
  return `${family}:${weight}`
}

/**
 * Get the TTF file path for a font family and weight
 */
function getFontPath(family: FontFamily, weight: FontWeight): string {
  const key = getFontKey(family, weight)
  const path = FONT_REGISTRY[key]
  if (!path) {
    // Fallback to regular if not found
    const fallbackKey = getFontKey(family, 'regular')
    return FONT_REGISTRY[fallbackKey] || FONT_REGISTRY['roboto:regular']
  }
  return path
}

/**
 * Load a TTF file and convert it to a Three.js Font object (for 3D rendering)
 */
async function loadThreeFont(family: FontFamily, weight: FontWeight): Promise<Font> {
  const key = getFontKey(family, weight)
  
  // Check cache
  const cached = fontCache.get(key)
  if (cached) return cached

  // Check if already loading
  let loadPromise = loadingPromises.get(key)
  if (!loadPromise) {
    const fontPath = getFontPath(family, weight)
    loadPromise = (async () => {
      const ttfLoader = new TTFLoader()
      const fontJson = await ttfLoader.loadAsync(fontPath)
      const fontLoader = new FontLoader()
      const font = fontLoader.parse(fontJson)
      fontCache.set(key, font)
    })()
    loadingPromises.set(key, loadPromise)
  }

  await loadPromise
  const font = fontCache.get(key)
  if (!font) {
    throw new Error(`Font ${key} failed to load from ${getFontPath(family, weight)}`)
  }
  return font
}

/**
 * Load a TTF file using opentype.js (for 2D SVG rendering)
 */
async function loadOpenTypeFont(family: FontFamily, weight: FontWeight): Promise<opentype.Font> {
  const key = getFontKey(family, weight)
  
  // Check cache
  const cached = opentypeFontCache.get(key)
  if (cached) return cached

  // Check if already loading
  let loadPromise = loadingPromises.get(`opentype:${key}`)
  if (!loadPromise) {
    const fontPath = getFontPath(family, weight)
    loadPromise = (async () => {
      const font = await opentype.load(fontPath)
      opentypeFontCache.set(key, font)
    })()
    loadingPromises.set(`opentype:${key}`, loadPromise)
  }

  await loadPromise
  const font = opentypeFontCache.get(key)
  if (!font) {
    throw new Error(`OpenType font ${key} failed to load from ${getFontPath(family, weight)}`)
  }
  return font
}

/**
 * Get a Three.js Font object for 3D rendering
 * This is the main function used by the 3D generation code
 * Can be used synchronously if fonts are preloaded, or asynchronously
 */
export function getFont(family: FontFamily, weight: FontWeight): Font | Promise<Font> {
  const key = getFontKey(family, weight)
  const cached = fontCache.get(key)
  if (cached) return cached
  
  // Not cached, need to load asynchronously
  return loadThreeFont(family, weight)
}

/**
 * Get an opentype.js Font object for 2D SVG rendering
 */
export async function getOpenTypeFont(family: FontFamily, weight: FontWeight): Promise<opentype.Font> {
  return loadOpenTypeFont(family, weight)
}

/**
 * Get SVG path data for text using opentype.js
 * This is used for 2D preview rendering
 * Returns the path data and bounding box for proper centering
 */
export async function getTextPath(
  text: string,
  family: FontFamily,
  weight: FontWeight,
  fontSizeMm: number
): Promise<{ path: string; width: number; height: number; x: number; y: number }> {
  const font = await getOpenTypeFont(family, weight)
  const THREE_TTFLOADER_SIZE_FACTOR = 100 / 72
  const fontSize = Math.max(0.01, fontSizeMm * THREE_TTFLOADER_SIZE_FACTOR)
  
  // Get the path
  const path = font.getPath(text, 0, 0, fontSize)
  
  // Get bounding box
  const bbox = path.getBoundingBox()
  const width = bbox.x2 - bbox.x1
  const height = bbox.y2 - bbox.y1
  
  // Generate SVG path data
  const pathData = path.toSVG(2) // 2 decimal places
  
  // Extract just the path data (remove any transform attributes)
  const match = pathData.match(/d="([^"]+)"/)
  const d = match ? match[1] : ''
  
  return {
    path: d,
    width,
    height,
    x: bbox.x1,
    y: bbox.y1,
  }
}

/**
 * Preload all fonts to ensure they're available synchronously
 * Call this at app startup
 */
export async function preloadFonts(): Promise<void> {
  const families: FontFamily[] = ['roboto', 'notoserif']
  const weights: FontWeight[] = ['regular', 'bold']
  
  const promises: Promise<void>[] = []
  for (const family of families) {
    for (const weight of weights) {
      promises.push(
        loadThreeFont(family, weight)
          .then(async () => {
            // Also preload opentype version
            await loadOpenTypeFont(family, weight)
          })
          .catch((error) => {
            console.error(`Failed to preload font ${family}:${weight}:`, error)
            throw error
          })
      )
    }
  }
  
  await Promise.all(promises)
}
