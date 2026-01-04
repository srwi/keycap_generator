import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import * as opentype from 'opentype.js'

// Single source of truth: font name -> file path mapping
// To add a new font, just add an entry here
const FONTS = {
  'DejaVuSans': '/fonts/DejaVu/DejaVuSans.ttf',
  'DejaVuSans-Bold': '/fonts/DejaVu/DejaVuSans-Bold.ttf',
  'DejaVuSansMono': '/fonts/DejaVu/DejaVuSansMono.ttf',
  'DejaVuSansMono-Bold': '/fonts/DejaVu/DejaVuSansMono-Bold.ttf',
  'DejaVuSerif': '/fonts/DejaVu/DejaVuSerif.ttf',
  'DejaVuSerif-Bold': '/fonts/DejaVu/DejaVuSerif-Bold.ttf',
  'DejaVuSerif-Italic': '/fonts/DejaVu/DejaVuSerif-Italic.ttf',
} as const

// Derived types and arrays - no need to maintain separately
export type FontName = keyof typeof FONTS
export const AVAILABLE_FONTS: readonly FontName[] = Object.keys(FONTS) as FontName[]
const FONT_REGISTRY: Record<FontName, string> = FONTS

// Cache for Three.js Font objects (for 3D rendering)
const fontCache = new Map<string, Font>()

// Cache for opentype.js Font objects (for 2D SVG rendering)
const opentypeFontCache = new Map<string, opentype.Font>()

// Cache for loading promises to avoid duplicate loads
const loadingPromises = new Map<string, Promise<void>>()

/**
 * Get the TTF file path for a font name
 */
function getFontPath(fontName: FontName): string {
  const path = FONT_REGISTRY[fontName]
  if (!path) {
    // Fallback to first available font
    return FONT_REGISTRY[AVAILABLE_FONTS[0]]
  }
  return path
}

/**
 * Load a TTF file and convert it to a Three.js Font object (for 3D rendering)
 */
async function loadThreeFont(fontName: FontName): Promise<Font> {
  // Check cache
  const cached = fontCache.get(fontName)
  if (cached) return cached

  // Check if already loading
  let loadPromise = loadingPromises.get(fontName)
  if (!loadPromise) {
    const fontPath = getFontPath(fontName)
    loadPromise = (async () => {
      const ttfLoader = new TTFLoader()
      const fontJson = await ttfLoader.loadAsync(fontPath)
      const fontLoader = new FontLoader()
      const font = fontLoader.parse(fontJson)
      fontCache.set(fontName, font)
    })()
    loadingPromises.set(fontName, loadPromise)
  }

  await loadPromise
  const font = fontCache.get(fontName)
  if (!font) {
    throw new Error(`Font ${fontName} failed to load from ${getFontPath(fontName)}`)
  }
  return font
}

/**
 * Load a TTF file using opentype.js (for 2D SVG rendering)
 */
async function loadOpenTypeFont(fontName: FontName): Promise<opentype.Font> {
  // Check cache
  const cached = opentypeFontCache.get(fontName)
  if (cached) return cached

  // Check if already loading
  const loadingKey = `opentype:${fontName}`
  let loadPromise = loadingPromises.get(loadingKey)
  if (!loadPromise) {
    const fontPath = getFontPath(fontName)
    loadPromise = (async () => {
      const font = await opentype.load(fontPath)
      opentypeFontCache.set(fontName, font)
    })()
    loadingPromises.set(loadingKey, loadPromise)
  }

  await loadPromise
  const font = opentypeFontCache.get(fontName)
  if (!font) {
    throw new Error(`OpenType font ${fontName} failed to load from ${getFontPath(fontName)}`)
  }
  return font
}

/**
 * Get a Three.js Font object for 3D rendering
 * This is the main function used by the 3D generation code
 * Can be used synchronously if fonts are preloaded, or asynchronously
 */
export function getFont(fontName: FontName): Font | Promise<Font> {
  const cached = fontCache.get(fontName)
  if (cached) return cached
  
  // Not cached, need to load asynchronously
  return loadThreeFont(fontName)
}

/**
 * Get an opentype.js Font object for 2D SVG rendering
 */
export async function getOpenTypeFont(fontName: FontName): Promise<opentype.Font> {
  return loadOpenTypeFont(fontName)
}

/**
 * Get SVG path data for text using opentype.js
 * This is used for 2D preview rendering
 * Returns the path data and bounding box for proper centering
 */
export async function getTextPath(
  text: string,
  fontName: FontName,
  fontSizeMm: number
): Promise<{ path: string; width: number; height: number; x: number; y: number }> {
  const font = await getOpenTypeFont(fontName)
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
  const promises: Promise<void>[] = []
  for (const fontName of AVAILABLE_FONTS) {
    promises.push(
      loadThreeFont(fontName)
        .then(async () => {
          // Also preload opentype version
          await loadOpenTypeFont(fontName)
        })
        .catch((error) => {
          console.error(`Failed to preload font ${fontName}:`, error)
          throw error
        })
    )
  }
  
  await Promise.all(promises)
}
