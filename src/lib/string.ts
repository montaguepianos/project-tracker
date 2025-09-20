export function formatISODate(value: Date | string) {
  if (typeof value === 'string') return value
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function normaliseTitle(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}
