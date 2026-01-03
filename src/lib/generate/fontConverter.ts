import * as opentype from 'opentype.js'
import type { Font as ThreeFont } from 'three/examples/jsm/loaders/FontLoader.js'

/**
 * Converts a TTF font file to Three.js typeface.json format
 */
export async function convertTtfToTypeface(ttfBuffer: ArrayBuffer): Promise<ThreeFont> {
  // opentype.parse expects an ArrayBuffer or Buffer, pass it directly
  const font = opentype.parse(ttfBuffer)
  
  // Convert opentype.js font to Three.js typeface.json format
  const typeface: any = {
    glyphs: {},
    familyName: font.names.fontFamily?.en || font.names.fullName?.en || 'Custom Font',
    ascender: font.ascender,
    descender: font.descender,
    underlinePosition: font.tables.post?.underlinePosition || 0,
    underlineThickness: font.tables.post?.underlineThickness || 0,
    boundingBox: {
      xMin: font.tables.head?.xMin || 0,
      yMin: font.tables.head?.yMin || 0,
      xMax: font.tables.head?.xMax || 0,
      yMax: font.tables.head?.yMax || 0,
    },
    resolution: 1000,
    original_font_information: {
      format: 'truetype',
      copyright: font.names.copyright?.en || '',
      fontFamily: font.names.fontFamily?.en || '',
      fontSubfamily: font.names.fontSubfamily?.en || '',
      uniqueID: (font.names as any).uniqueID?.en || '',
      fullName: font.names.fullName?.en || '',
      version: font.names.version?.en || '',
      postScriptName: font.names.postScriptName?.en || '',
      trademark: font.names.trademark?.en || '',
      manufacturer: font.names.manufacturer?.en || '',
      designer: font.names.designer?.en || '',
      description: font.names.description?.en || '',
      vendorURL: (font.names as any).vendorURL?.en || '',
      designerURL: (font.names as any).designerURL?.en || '',
      license: font.names.license?.en || '',
      licenseURL: font.names.licenseURL?.en || '',
    },
  }

  // Convert glyphs
  // We'll convert common ASCII characters (32-126) plus some extended
  const charCodes: number[] = []
  for (let i = 32; i <= 126; i++) {
    charCodes.push(i)
  }
  // Add some common extended characters
  for (let i = 160; i <= 255; i++) {
    charCodes.push(i)
  }

  for (const charCode of charCodes) {
    const char = String.fromCharCode(charCode)
    const glyph = font.charToGlyph(char)
    if (glyph && glyph.index !== 0) {
      // Get path at 1000 units size (matching typeface.json resolution)
      const path = glyph.getPath(0, 0, 1000)
      
      // Convert path commands to relative SVG path format (as used in typeface.json)
      let pathString = ''
      let lastX = 0
      let lastY = 0
      
      for (const command of path.commands) {
        if (command.type === 'M') {
          // First move uses absolute coordinates (lowercase m but treated as absolute in SVG)
          pathString += `m ${command.x} ${command.y} `
          lastX = command.x
          lastY = command.y
        } else if (command.type === 'L') {
          const dx = command.x - lastX
          const dy = command.y - lastY
          pathString += `l ${dx} ${dy} `
          lastX = command.x
          lastY = command.y
        } else if (command.type === 'C') {
          // Cubic bezier - convert to relative
          const dx1 = command.x1 - lastX
          const dy1 = command.y1 - lastY
          const dx2 = command.x2 - lastX
          const dy2 = command.y2 - lastY
          const dx = command.x - lastX
          const dy = command.y - lastY
          pathString += `c ${dx1} ${dy1} ${dx2} ${dy2} ${dx} ${dy} `
          lastX = command.x
          lastY = command.y
        } else if (command.type === 'Q') {
          // Quadratic bezier - convert to relative
          const dx1 = command.x1 - lastX
          const dy1 = command.y1 - lastY
          const dx = command.x - lastX
          const dy = command.y - lastY
          pathString += `q ${dx1} ${dy1} ${dx} ${dy} `
          lastX = command.x
          lastY = command.y
        } else if (command.type === 'Z') {
          pathString += 'z '
        }
      }
      pathString = pathString.trim()

      typeface.glyphs[char] = {
        ha: glyph.advanceWidth || 0,
        x_min: glyph.xMin || 0,
        y_min: glyph.yMin || 0,
        x_max: glyph.xMax || 0,
        y_max: glyph.yMax || 0,
        o: pathString || '',
      }
    }
  }

  return typeface as ThreeFont
}

