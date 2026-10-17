import type { KleKey, KleKeyboard, LayoutBounds } from './kleTypes'

// Canonical KLE label position reordering matrix (by Ian Prest)
// Maps from serialized label order (based on \n splitting) to normalized positions 0..11
// prettier-ignore
const LABEL_MAP: number[][] = [
  // 0  1  2  3  4  5  6  7  8  9 10 11   // align flags
  [  0, 6, 2, 8, 9,11, 3, 5, 1, 4, 7,10 ], // 0 = no centering
  [  1, 7,-1,-1, 9,11, 4,-1,-1,-1,-1,10 ], // 1 = center x
  [  3,-1, 5,-1, 9,11,-1,-1, 4,-1,-1,10 ], // 2 = center y
  [  4,-1,-1,-1, 9,11,-1,-1,-1,-1,-1,10 ], // 3 = center x & y
  [  0, 6, 2, 8,10,-1, 3, 5, 1, 4, 7,-1 ], // 4 = center front (default)
  [  1, 7,-1,-1,10,-1, 4,-1,-1,-1,-1,-1 ], // 5 = center front & x
  [  3,-1, 5,-1,10,-1,-1,-1, 4,-1,-1,-1 ], // 6 = center front & y
  [  4,-1,-1,-1,10,-1,-1,-1,-1,-1,-1,-1 ], // 7 = center front & x & y
]

function reorderAligned<T>(arr: (T | undefined)[], align: number, defaultValue: T): T[] {
  const ret: T[] = new Array(12).fill(defaultValue)
  const map = LABEL_MAP[align] || LABEL_MAP[4]
  for (let i = 0; i < arr.length; i++) {
    const targetIdx = map[i]
    if (targetIdx !== undefined && targetIdx >= 0 && targetIdx < 12 && arr[i] !== undefined && arr[i] !== '') {
      ret[targetIdx] = arr[i] as T
    }
  }
  return ret
}

/**
 * Checks whether a KLE key defines a secondary rectangular shape (e.g. ISO Enter, Stepped Caps).
 */
export function hasSecondaryShape(k: KleKey): boolean {
  return (k.width2 !== k.width || k.height2 !== k.height || k.x2 !== 0 || k.y2 !== 0) && k.width2 > 0 && k.height2 > 0
}

/**
 * Returns the indices of active legends on a key.
 * Checks top surface slots (0..8) first. If none have content,
 * falls back to front legend slots (9..11).
 */
export function getKeyActiveSlots(k: KleKey): number[] {
  const active: number[] = []
  for (let i = 0; i < 9; i++) {
    if (k.labels[i] && k.labels[i].trim() !== '') {
      active.push(i)
    }
  }
  if (active.length === 0) {
    for (let i = 9; i < 12; i++) {
      if (k.labels[i] && k.labels[i].trim() !== '') {
        active.push(i)
        break
      }
    }
  }
  return active
}

function normalizeHexColor(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const s = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) {
    return s.toLowerCase()
  }
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1].toLowerCase()
    const g = s[2].toLowerCase()
    const b = s[3].toLowerCase()
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return undefined
}

function cleanKleLabel(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

/**
 * Robust JSON5 / Lenient JSON parser for KLE raw data.
 * Supports:
 * - Unquoted object keys ({ w: 1.5, x: 0.25 })
 * - Single-quoted strings ('...') and double-quoted strings ("...") with full escape sequences
 * - Multi-line and single-line comments (/* ... *\/ and // ...)
 * - Trailing commas in objects and arrays
 * - Raw KLE pastes with or without outer enclosing brackets [ ... ]
 */
export function parseLenientJson(input: string): unknown {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Input is empty.')

  let pos = 0
  const len = trimmed.length

  function skipWhitespaceAndComments(): void {
    while (pos < len) {
      const ch = trimmed[pos]
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        pos++
        continue
      }
      if (ch === '/' && pos + 1 < len) {
        if (trimmed[pos + 1] === '/') {
          pos += 2
          while (pos < len && trimmed[pos] !== '\n' && trimmed[pos] !== '\r') {
            pos++
          }
          continue
        }
        if (trimmed[pos + 1] === '*') {
          pos += 2
          while (pos + 1 < len && !(trimmed[pos] === '*' && trimmed[pos + 1] === '/')) {
            pos++
          }
          pos += 2
          continue
        }
      }
      break
    }
  }

  function parseString(): string {
    const quote = trimmed[pos++]
    let result = ''
    while (pos < len) {
      const ch = trimmed[pos++]
      if (ch === quote) {
        return result
      }
      if (ch === '\\' && pos < len) {
        const next = trimmed[pos++]
        switch (next) {
          case 'n':
            result += '\n'
            break
          case 'r':
            result += '\r'
            break
          case 't':
            result += '\t'
            break
          case 'b':
            result += '\b'
            break
          case 'f':
            result += '\f'
            break
          case '\\':
            result += '\\'
            break
          case '"':
            result += '"'
            break
          case "'":
            result += "'"
            break
          case 'u': {
            const hex = trimmed.slice(pos, pos + 4)
            pos += 4
            result += String.fromCharCode(parseInt(hex, 16))
            break
          }
          default:
            result += next
        }
      } else {
        result += ch
      }
    }
    throw new Error(`Unterminated string at character ${pos}.`)
  }

  function parseNumber(): number {
    const start = pos
    if (trimmed[pos] === '-' || trimmed[pos] === '+') pos++
    while (pos < len && trimmed[pos] >= '0' && trimmed[pos] <= '9') pos++
    if (pos < len && trimmed[pos] === '.') {
      pos++
      while (pos < len && trimmed[pos] >= '0' && trimmed[pos] <= '9') pos++
    }
    if (pos < len && (trimmed[pos] === 'e' || trimmed[pos] === 'E')) {
      pos++
      if (pos < len && (trimmed[pos] === '+' || trimmed[pos] === '-')) pos++
      while (pos < len && trimmed[pos] >= '0' && trimmed[pos] <= '9') pos++
    }
    const numStr = trimmed.slice(start, pos)
    const val = Number(numStr)
    if (isNaN(val)) throw new Error(`Invalid number '${numStr}' at character ${start}.`)
    return val
  }

  function parseIdentifier(): string {
    const start = pos
    while (pos < len && /[a-zA-Z0-9_$-]/.test(trimmed[pos])) {
      pos++
    }
    return trimmed.slice(start, pos)
  }

  function parseObject(): Record<string, any> {
    pos++ // consume '{'
    const obj: Record<string, any> = {}
    while (true) {
      skipWhitespaceAndComments()
      if (pos >= len) throw new Error('Unterminated object (missing "}").')
      if (trimmed[pos] === '}') {
        pos++
        return obj
      }

      // Parse key
      let key = ''
      if (trimmed[pos] === '"' || trimmed[pos] === "'") {
        key = parseString()
      } else if (/[a-zA-Z0-9_$-]/.test(trimmed[pos])) {
        key = parseIdentifier()
      } else {
        throw new Error(`Unexpected character for object key at character ${pos}: '${trimmed[pos]}'.`)
      }

      skipWhitespaceAndComments()
      if (pos >= len || trimmed[pos] !== ':') {
        throw new Error(`Expected ':' after key '${key}' at character ${pos}.`)
      }
      pos++ // consume ':'

      const val = parseValue()
      obj[key] = val

      skipWhitespaceAndComments()
      if (pos < len && trimmed[pos] === ',') {
        pos++ // consume ','
      } else if (pos < len && trimmed[pos] === '}') {
        // Will be consumed next iteration
      } else {
        throw new Error(`Expected ',' or '}' at character ${pos}.`)
      }
    }
  }

  function parseArray(): any[] {
    pos++ // consume '['
    const arr: any[] = []
    while (true) {
      skipWhitespaceAndComments()
      if (pos >= len) throw new Error('Unterminated array (missing "]").')
      if (trimmed[pos] === ']') {
        pos++
        return arr
      }

      const val = parseValue()
      arr.push(val)

      skipWhitespaceAndComments()
      if (pos < len && trimmed[pos] === ',') {
        pos++ // consume ','
      } else if (pos < len && trimmed[pos] === ']') {
        // Will be consumed next iteration
      } else {
        throw new Error(`Expected ',' or ']' at character ${pos}.`)
      }
    }
  }

  function parseValue(): any {
    skipWhitespaceAndComments()
    if (pos >= len) throw new Error('Unexpected end of input.')
    const ch = trimmed[pos]
    if (ch === '{') return parseObject()
    if (ch === '[') return parseArray()
    if (ch === '"' || ch === "'") return parseString()
    if (ch === '-' || ch === '+' || ch === '.' || (ch >= '0' && ch <= '9')) return parseNumber()
    if (/[a-zA-Z_$]/.test(ch)) {
      const ident = parseIdentifier()
      if (ident === 'true') return true
      if (ident === 'false') return false
      if (ident === 'null') return null
      return ident
    }
    throw new Error(`Unexpected character '${ch}' at character ${pos}.`)
  }

  // Top level: parse one or multiple comma-separated items
  const items: any[] = []
  while (true) {
    skipWhitespaceAndComments()
    if (pos >= len) break
    items.push(parseValue())
    skipWhitespaceAndComments()
    if (pos < len && trimmed[pos] === ',') {
      pos++
    }
  }

  if (items.length === 0) {
    throw new Error('Input is empty.')
  }

  // If user pasted a single 2D array [ [row1], [row2] ]
  if (items.length === 1 && Array.isArray(items[0])) {
    return items[0]
  }

  // If user pasted comma-separated rows [row1], [row2] or {meta}, [row1]
  return items
}

/**
 * Deserializes raw KLE rows (parsed JSON array) into a structured KleKeyboard.
 */
export function deserializeKle(rows: unknown[]): KleKeyboard {
  if (!Array.isArray(rows)) {
    throw new Error('KLE data must be an array of rows.')
  }

  const kbd: KleKeyboard = {
    meta: {
      name: '',
    },
    keys: [],
  }

  // Running state machine
  let currentKeyProps: {
    textColor: (string | undefined)[]
    defaultTextColor: string | undefined
    x: number
    y: number
    width: number
    height: number
    x2: number
    y2: number
    width2: number
    height2: number
    rotation_x: number
    rotation_y: number
    rotation_angle: number
    decal: boolean
    profile: string
  } = {
    textColor: [],
    defaultTextColor: undefined,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    x2: 0,
    y2: 0,
    width2: 0,
    height2: 0,
    rotation_x: 0,
    rotation_y: 0,
    rotation_angle: 0,
    decal: false,
    profile: '',
  }

  let align = 4
  let keyIdCounter = 0

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]

    if (Array.isArray(row)) {
      for (let k = 0; k < row.length; k++) {
        const item = row[k]

        if (typeof item === 'string') {
          // It's a key!
          const rawLabels = item.split('\n').map(cleanKleLabel)
          const labels = reorderAligned(rawLabels, align, '')
          const reorderedColors = reorderAligned<string | undefined>(currentKeyProps.textColor, align, undefined)
          const textColors = reorderedColors.map(c => {
            return normalizeHexColor(c) ?? currentKeyProps.defaultTextColor
          })

          if (!currentKeyProps.decal) {
            const key: KleKey = {
              id: `kle_key_${keyIdCounter++}`,
              labels,
              textColor: textColors,
              x: currentKeyProps.x,
              y: currentKeyProps.y,
              width: currentKeyProps.width,
              height: currentKeyProps.height,
              x2: currentKeyProps.x2,
              y2: currentKeyProps.y2,
              width2: currentKeyProps.width2 === 0 ? currentKeyProps.width : currentKeyProps.width2,
              height2: currentKeyProps.height2 === 0 ? currentKeyProps.height : currentKeyProps.height2,
              rotation_x: currentKeyProps.rotation_x,
              rotation_y: currentKeyProps.rotation_y,
              rotation_angle: currentKeyProps.rotation_angle,
              profile: currentKeyProps.profile,
            }

            kbd.keys.push(key)
          }

          // Prepare state for next key
          currentKeyProps.x += currentKeyProps.width
          currentKeyProps.width = 1
          currentKeyProps.height = 1
          currentKeyProps.x2 = 0
          currentKeyProps.y2 = 0
          currentKeyProps.width2 = 0
          currentKeyProps.height2 = 0
          currentKeyProps.decal = false
        } else if (typeof item === 'object' && item !== null) {
          // Property modifier
          const mod = item as Record<string, any>

          if (mod.r !== undefined) currentKeyProps.rotation_angle = Number(mod.r) || 0
          if (mod.rx !== undefined) {
            currentKeyProps.rotation_x = Number(mod.rx) || 0
            currentKeyProps.x = currentKeyProps.rotation_x
            currentKeyProps.y = currentKeyProps.rotation_y
          }
          if (mod.ry !== undefined) {
            currentKeyProps.rotation_y = Number(mod.ry) || 0
            currentKeyProps.x = currentKeyProps.rotation_x
            currentKeyProps.y = currentKeyProps.rotation_y
          }
          if (mod.a !== undefined) align = Number(mod.a) || 0
          if (mod.p !== undefined) currentKeyProps.profile = String(mod.p)
          if (mod.t !== undefined) {
            const splitColors = String(mod.t).split('\n')
            if (splitColors[0]) {
              currentKeyProps.defaultTextColor = normalizeHexColor(splitColors[0])
            }
            currentKeyProps.textColor = splitColors
          }
          if (mod.x !== undefined) currentKeyProps.x += Number(mod.x) || 0
          if (mod.y !== undefined) currentKeyProps.y += Number(mod.y) || 0
          if (mod.w !== undefined) {
            currentKeyProps.width = Number(mod.w) || 1
          }
          if (mod.h !== undefined) {
            currentKeyProps.height = Number(mod.h) || 1
          }
          if (mod.x2 !== undefined) currentKeyProps.x2 = Number(mod.x2) || 0
          if (mod.y2 !== undefined) currentKeyProps.y2 = Number(mod.y2) || 0
          if (mod.w2 !== undefined) currentKeyProps.width2 = Number(mod.w2) || 0
          if (mod.h2 !== undefined) currentKeyProps.height2 = Number(mod.h2) || 0
          if (mod.d !== undefined) currentKeyProps.decal = Boolean(mod.d)
        }
      }

      // End of row: advance y and reset x to rotation origin
      currentKeyProps.y += 1
      currentKeyProps.x = currentKeyProps.rotation_x
    } else if (typeof row === 'object' && row !== null && r === 0) {
      // First element may be keyboard metadata
      const meta = row as Record<string, any>
      if (meta.name) kbd.meta.name = String(meta.name)
    }
  }

  return kbd
}

/**
 * Calculates the bounding box for all keys in the layout, taking rotations into account.
 */
export function calculateLayoutBounds(keys: KleKey[]): LayoutBounds {
  if (keys.length === 0) {
    return { minX: 0, maxX: 1, minY: 0, maxY: 1, width: 1, height: 1 }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const k of keys) {
    const corners = [
      { x: k.x, y: k.y },
      { x: k.x + k.width, y: k.y },
      { x: k.x + k.width, y: k.y + k.height },
      { x: k.x, y: k.y + k.height },
    ]

    // If secondary shape exists (e.g. ISO Enter)
    if (hasSecondaryShape(k)) {
      corners.push(
        { x: k.x + k.x2, y: k.y + k.y2 },
        { x: k.x + k.x2 + k.width2, y: k.y + k.y2 },
        { x: k.x + k.x2 + k.width2, y: k.y + k.y2 + k.height2 },
        { x: k.x + k.x2, y: k.y + k.y2 + k.height2 }
      )
    }

    const rad = (k.rotation_angle * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)

    for (const pt of corners) {
      let finalX = pt.x
      let finalY = pt.y

      if (k.rotation_angle !== 0) {
        // Rotate around rotation center (rotation_x, rotation_y)
        const dx = pt.x - k.rotation_x
        const dy = pt.y - k.rotation_y
        finalX = k.rotation_x + dx * cos - dy * sin
        finalY = k.rotation_y + dx * sin + dy * cos
      }

      if (finalX < minX) minX = finalX
      if (finalX > maxX) maxX = finalX
      if (finalY < minY) minY = finalY
      if (finalY > maxY) maxY = finalY
    }
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(0.1, maxX - minX),
    height: Math.max(0.1, maxY - minY),
  }
}
