import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import type { FontFamily, FontWeight } from '../state/types'

import helvetikerRegularJson from '../fonts/helvetiker_regular.typeface.json'
import helvetikerBoldJson from '../fonts/helvetiker_bold.typeface.json'

const loader = new FontLoader()
const cache = new Map<string, Font>()

export function getFont(family: FontFamily, weight: FontWeight): Font {
  const key = `${family}:${weight}`
  const cached = cache.get(key)
  if (cached) return cached

  if (family === 'helvetiker' && weight === 'regular') {
    const font = loader.parse(helvetikerRegularJson as any)
    cache.set(key, font)
    return font
  }

  if (family === 'helvetiker' && weight === 'bold') {
    const font = loader.parse(helvetikerBoldJson as any)
    cache.set(key, font)
    return font
  }

  const font = loader.parse(helvetikerRegularJson as any)
  cache.set(key, font)
  return font
}


