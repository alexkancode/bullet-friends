import { describe, expect, it } from 'vitest'
import { formatStopwatch } from '../src/ui/stopwatch.js'

describe('formatStopwatch', () => {
  it('formats seconds with tenths', () => {
    expect(formatStopwatch(0)).toBe('0:00.0')
    expect(formatStopwatch(7300)).toBe('0:07.3')
    expect(formatStopwatch(59950)).toBe('0:59.9')
  })

  it('rolls into minutes', () => {
    expect(formatStopwatch(60000)).toBe('1:00.0')
    expect(formatStopwatch(83450)).toBe('1:23.4')
    expect(formatStopwatch(600000)).toBe('10:00.0')
  })
})
