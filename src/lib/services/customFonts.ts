export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function isTtfFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.ttf')
}

export function baseNameFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

export function makeUniqueFontName(baseName: string, existing: Set<string>): string {
  const trimmed = baseName.trim() || 'Custom Font'
  if (!existing.has(trimmed)) return trimmed
  for (let i = 2; i < 1000; i++) {
    const candidate = `${trimmed} (${i})`
    if (!existing.has(candidate)) return candidate
  }
  return `${trimmed} (${Date.now()})`
}
