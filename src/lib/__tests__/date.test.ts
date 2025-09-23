import { describe, expect, test } from 'vitest'

import { parseYmdSafe } from '@/lib/date'

describe('parseYmdSafe', () => {
  test('rejects bad inputs', () => {
    expect(parseYmdSafe(null as unknown as string).ok).toBe(false)
    expect(parseYmdSafe(undefined).ok).toBe(false)
    expect(parseYmdSafe('').ok).toBe(false)
    expect(parseYmdSafe('2025/09/23').ok).toBe(false)
    expect(parseYmdSafe('2025-13-40').ok).toBe(false)
    expect(parseYmdSafe('not-a-date').ok).toBe(false)
  })

  test('accepts valid yyyy-mm-dd', () => {
    const r = parseYmdSafe('2025-09-23')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe('2025-09-23')
  })
})


