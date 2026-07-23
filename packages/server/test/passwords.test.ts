import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../src/auth/passwords.js'

describe('passwords', () => {
  it('verifies the password it hashed', async () => {
    const hash = await hashPassword('hunter2222')
    expect(await verifyPassword('hunter2222', hash)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('hunter2222')
    expect(await verifyPassword('hunter2223', hash)).toBe(false)
  })

  it('salts every hash uniquely', async () => {
    const a = await hashPassword('same-password')
    const b = await hashPassword('same-password')
    expect(a).not.toBe(b)
    expect(await verifyPassword('same-password', a)).toBe(true)
    expect(await verifyPassword('same-password', b)).toBe(true)
  })

  it('rejects malformed stored hashes without throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-real-hash')).toBe(false)
  })
})
