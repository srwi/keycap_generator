export function newId(prefix = 'id'): string {
  const rnd = crypto.getRandomValues(new Uint32Array(2))
  return `${prefix}_${rnd[0].toString(16)}${rnd[1].toString(16)}`
}


