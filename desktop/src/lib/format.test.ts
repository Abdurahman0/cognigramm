import { describe, expect, it } from 'vitest'

import { formatDuration } from '@/lib/format'

describe('formatDuration', () => {
  it('formats under an hour as mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65_000)).toBe('1:05')
    expect(formatDuration(59 * 60_000 + 59_000)).toBe('59:59')
  })

  it('adds hours once the call runs long', () => {
    expect(formatDuration(3_661_000)).toBe('1:01:01')
  })

  it('does not go negative on a clock skew', () => {
    expect(formatDuration(-5_000)).toBe('0:00')
  })
})
