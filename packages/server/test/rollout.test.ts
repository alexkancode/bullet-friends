import { describe, expect, it } from 'vitest'
import { rolloutSettled } from '../../../.claude/skills/deploy-bullet-friends/rollout.mjs'

const list = (...statuses: string[]) => statuses.map((status, i) => ({ id: `d${i}`, status }))

describe('rolloutSettled', () => {
  it('is settled when the newest deployment succeeded and every older one is gone', () => {
    expect(rolloutSettled(list('SUCCESS', 'REMOVED', 'REMOVED'))).toBe(true)
    expect(rolloutSettled(list('SUCCESS', 'FAILED', 'REMOVED'))).toBe(true)
    expect(rolloutSettled(list('SUCCESS'))).toBe(true)
  })

  it('is not settled while the previous deployment still serves', () => {
    expect(rolloutSettled(list('SUCCESS', 'SUCCESS'))).toBe(false)
    expect(rolloutSettled(list('SUCCESS', 'REMOVING'))).toBe(false)
  })

  it('is not settled while the newest deployment is still building or deploying', () => {
    expect(rolloutSettled(list('BUILDING', 'SUCCESS'))).toBe(false)
    expect(rolloutSettled(list('DEPLOYING', 'SUCCESS'))).toBe(false)
    expect(rolloutSettled([])).toBe(false)
  })

  it('is not settled when the newest deployment failed', () => {
    expect(rolloutSettled(list('FAILED', 'SUCCESS'))).toBe(false)
    expect(rolloutSettled(list('CRASHED', 'REMOVED'))).toBe(false)
  })
})
