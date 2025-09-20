const PALETTE = [
  '#1C7ED6',
  '#F59F00',
  '#E03131',
  '#7048E8',
  '#2B8A3E',
  '#0CA678',
  '#D6336C',
  '#3B5BDB',
  '#F76707',
  '#40C057',
  '#15AABF',
  '#495057',
]

export function deriveColour(project: string) {
  const key = project.toLowerCase()
  let hash = 0
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(index)
    hash |= 0
  }

  const paletteIndex = Math.abs(hash) % PALETTE.length
  return PALETTE[paletteIndex]
}

export function ensureReadableText(colour: string) {
  const hex = colour.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1f1f1f' : '#ffffff'
}
