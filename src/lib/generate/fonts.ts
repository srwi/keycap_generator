import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import * as opentype from 'opentype.js'
import { getPublicPath } from '../utils/paths'
import type { CustomFont } from '../state/types'

const BUILTIN_FONT_REGISTRY = {
  'DejaVu Sans': getPublicPath('fonts/DejaVu/DejaVuSans.ttf'),
  'DejaVu Sans Bold': getPublicPath('fonts/DejaVu/DejaVuSans-Bold.ttf'),
  'DejaVu Serif': getPublicPath('fonts/DejaVu/DejaVuSerif.ttf'),
  'DejaVu Serif Bold': getPublicPath('fonts/DejaVu/DejaVuSerif-Bold.ttf'),
  Dongle: getPublicPath('fonts/Dongle/Dongle-Regular.ttf'),
  'Dongle Bold': getPublicPath('fonts/Dongle/Dongle-Bold.ttf'),
} as const

export type FontName = string
export const AVAILABLE_FONTS: readonly string[] = Object.keys(BUILTIN_FONT_REGISTRY)

const customTtfByName = new Map<string, ArrayBuffer>()
const customBase64ByName = new Map<string, string>()

const fontCache = new Map<string, Font>()
const opentypeFontCache = new Map<string, opentype.Font>()
const loadingPromises = new Map<string, Promise<void>>()

function isBuiltinFont(fontName: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILTIN_FONT_REGISTRY, fontName)
}

function getBuiltinFontPath(fontName: string): string {
  return (BUILTIN_FONT_REGISTRY as Record<string, string>)[fontName]
}

function getCustomFontBuffer(fontName: string): ArrayBuffer | null {
  return customTtfByName.get(fontName) ?? null
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function registerCustomFonts(fonts: readonly CustomFont[] | null | undefined): void {
  if (!fonts || fonts.length === 0) return

  for (const f of fonts) {
    if (!f?.name || !f?.ttfBase64) continue
    const prev = customBase64ByName.get(f.name)
    if (prev === f.ttfBase64) continue

    const buf = base64ToArrayBuffer(f.ttfBase64)
    customBase64ByName.set(f.name, f.ttfBase64)
    customTtfByName.set(f.name, buf)

    // Invalidate any cached parsed versions for this font name.
    fontCache.delete(f.name)
    opentypeFontCache.delete(f.name)
    loadingPromises.delete(f.name)
    loadingPromises.delete(`opentype:${f.name}`)
  }
}

async function loadThreeFont(fontName: FontName): Promise<Font> {
  const cached = fontCache.get(fontName)
  if (cached) return cached

  let loadPromise = loadingPromises.get(fontName)
  if (!loadPromise) {
    loadPromise = (async () => {
      const ttfLoader = new TTFLoader()
      const fontJson = (() => {
        const customBuf = getCustomFontBuffer(fontName)
        if (customBuf) return ttfLoader.parse(customBuf)
        if (isBuiltinFont(fontName)) return ttfLoader.loadAsync(getBuiltinFontPath(fontName))
        throw new Error(`Unknown font: ${fontName}`)
      })()

      const resolvedJson = fontJson instanceof Promise ? await fontJson : fontJson
      const fontLoader = new FontLoader()
      const font = fontLoader.parse(resolvedJson)
      fontCache.set(fontName, font)
    })()
    loadingPromises.set(fontName, loadPromise)
  }

  await loadPromise
  const font = fontCache.get(fontName)
  if (!font) {
    throw new Error(`Font ${fontName} failed to load`)
  }
  return font
}

async function loadOpenTypeFont(fontName: FontName): Promise<opentype.Font> {
  const cached = opentypeFontCache.get(fontName)
  if (cached) return cached

  const loadingKey = `opentype:${fontName}`
  let loadPromise = loadingPromises.get(loadingKey)
  if (!loadPromise) {
    loadPromise = (async () => {
      const customBuf = getCustomFontBuffer(fontName)
      const font = customBuf
        ? opentype.parse(customBuf)
        : isBuiltinFont(fontName)
          ? await opentype.load(getBuiltinFontPath(fontName))
          : (() => {
              throw new Error(`Unknown font: ${fontName}`)
            })()
      opentypeFontCache.set(fontName, font)
    })()
    loadingPromises.set(loadingKey, loadPromise)
  }

  await loadPromise
  const font = opentypeFontCache.get(fontName)
  if (!font) {
    throw new Error(`OpenType font ${fontName} failed to load`)
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
