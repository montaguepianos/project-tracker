export type PackingResult = {
  squareSize: number
  gap: number
  columns: number
  rows: number
  visibleCount: number
}

export type PackingOptions = {
  minSize?: number
  gapCandidates?: number[]
  fallbackGap?: number
  extraRowHeight?: number
}

const DEFAULT_GAPS = [6, 4, 2]
const DEFAULT_MIN_SIZE = 14

export function computeSquarePacking(
  width: number,
  height: number,
  count: number,
  options: PackingOptions = {},
): PackingResult {
  const minSize = options.minSize ?? DEFAULT_MIN_SIZE
  const gapCandidates = options.gapCandidates ?? DEFAULT_GAPS
  const fallbackGap = options.fallbackGap ?? Math.min(...gapCandidates, 2)
  const extraRowHeight = options.extraRowHeight ?? 0

  if (!count || width <= 0 || height <= 0) {
    return { squareSize: 0, gap: gapCandidates[0] ?? fallbackGap, columns: 0, rows: 0, visibleCount: 0 }
  }

  const smallestGap = Math.min(...gapCandidates, fallbackGap)
  const maxColumns = Math.max(1, Math.floor((width + smallestGap) / (minSize + smallestGap)))
  const maxRows = Math.max(
    1,
    Math.floor((height + smallestGap + extraRowHeight) / (minSize + extraRowHeight + smallestGap)),
  )

  let best: PackingResult | null = null

  for (let columns = 1; columns <= Math.min(count, maxColumns); columns += 1) {
    const rows = Math.ceil(count / columns)
    if (rows > maxRows) continue

    for (const gap of gapCandidates) {
      const size = availableSquare(width, height, columns, rows, gap, extraRowHeight)
      const candidate: PackingResult = { squareSize: size, gap, columns, rows, visibleCount: count }
      if (!best || size > best.squareSize) {
        best = candidate
      }
    }
  }

  if (best && best.squareSize >= minSize) {
    return best
  }

  const columns = Math.max(1, Math.floor((width + fallbackGap) / (minSize + fallbackGap)))
  const rows = Math.max(
    1,
    Math.floor((height + fallbackGap + extraRowHeight) / (minSize + extraRowHeight + fallbackGap)),
  )
  const visibleCapacity = Math.max(1, columns * rows)
  const visibleCount = Math.min(count, visibleCapacity)
  const size = availableSquare(width, height, columns, rows, fallbackGap, extraRowHeight)

  return {
    squareSize: Math.max(minSize, size),
    gap: fallbackGap,
    columns,
    rows,
    visibleCount,
  }
}

function availableSquare(
  width: number,
  height: number,
  columns: number,
  rows: number,
  gap: number,
  extraRowHeight: number,
) {
  const widthAvailable = width - gap * (columns - 1)
  const heightAvailable = height - gap * (rows - 1) - extraRowHeight * rows
  if (widthAvailable <= 0 || heightAvailable <= 0) return 0
  return Math.max(0, Math.min(widthAvailable / columns, heightAvailable / rows))
}
