import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import * as opentype from 'opentype.js'
import { getPublicPath } from '../utils/paths'

const FONT_REGISTRY = {
  DejaVuSans: getPublicPath('fonts/DejaVu/DejaVuSans.ttf'),
  'DejaVuSans-Bold': getPublicPath('fonts/DejaVu/DejaVuSans-Bold.ttf'),
  DejaVuSansMono: getPublicPath('fonts/DejaVu/DejaVuSansMono.ttf'),
  'DejaVuSansMono-Bold': getPublicPath('fonts/DejaVu/DejaVuSansMono-Bold.ttf'),
  DejaVuSerif: getPublicPath('fonts/DejaVu/DejaVuSerif.ttf'),
  'DejaVuSerif-Bold': getPublicPath('fonts/DejaVu/DejaVuSerif-Bold.ttf'),
  'DejaVuSerif-Italic': getPublicPath('fonts/DejaVu/DejaVuSerif-Italic.ttf'),
} as const

export type FontName = keyof typeof FONT_REGISTRY
export const AVAILABLE_FONTS: readonly FontName[] = Object.keys(FONT_REGISTRY) as FontName[]

const fontCache = new Map<string, Font>()
const opentypeFontCache = new Map<string, opentype.Font>()
const loadingPromises = new Map<string, Promise<void>>()

function getFontPath(fontName: FontName): string {
  return FONT_REGISTRY[fontName]
}

async function loadThreeFont(fontName: FontName): Promise<Font> {
  const cached = fontCache.get(fontName)
  if (cached) return cached

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

async function loadOpenTypeFont(fontName: FontName): Promise<opentype.Font> {
  const cached = opentypeFontCache.get(fontName)
  if (cached) return cached

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

export function getFont(fontName: FontName): Font | Promise<Font> {
  const cached = fontCache.get(fontName)
  if (cached) return cached

  return loadThreeFont(fontName)
}

export async function getTextPath(
  text: string,
  fontName: FontName,
  fontSizeMm: number
): Promise<{ path: string; width: number; height: number; x: number; y: number }> {
  const font = await loadOpenTypeFont(fontName)
  const THREE_TTFLOADER_SIZE_FACTOR = 100 / 72
  const fontSize = Math.max(0.01, fontSizeMm * THREE_TTFLOADER_SIZE_FACTOR)

  const path = font.getPath(text, 0, 0, fontSize)

  const bbox = path.getBoundingBox()
  const width = bbox.x2 - bbox.x1
  const height = bbox.y2 - bbox.y1

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

export async function preloadFonts(): Promise<void> {
  const promises: Promise<void>[] = []
  for (const fontName of AVAILABLE_FONTS) {
    promises.push(
      loadThreeFont(fontName)
        .then(async () => {
          await loadOpenTypeFont(fontName)
        })
        .catch(error => {
          console.error(`Failed to preload font ${fontName}:`, error)
          throw error
        })
    )
  }

  await Promise.all(promises)
}
