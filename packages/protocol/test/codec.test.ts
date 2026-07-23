import { describe, expect, it } from 'vitest'
import { createGameState, addPlayer } from '@bullet/core'
import type { ClientMessage, ServerMessage } from '@bullet/protocol'
import {
  decodeCamFrame,
  decodeMessage,
  encodeCamFrame,
  encodeMessage,
  isCamFrame,
  CLIENT_MESSAGE_TAGS,
  SERVER_MESSAGE_TAGS,
  PROTOCOL_VERSION
} from '@bullet/protocol'
import fixtures from './fixtures/messages.json' with { type: 'json' }

describe('codec', () => {
  it('locks every fixture message shape to a known tag (canary)', () => {
    const knownTags = new Set<string>([...CLIENT_MESSAGE_TAGS, ...SERVER_MESSAGE_TAGS])
    for (const [name, fixture] of Object.entries(fixtures)) {
      expect(knownTags.has(fixture.t), `fixture ${name}`).toBe(true)
      const decoded = decodeMessage(encodeMessage(fixture as ClientMessage | ServerMessage))
      expect(decoded).toEqual(fixture)
    }
  })

  it('covers every declared tag with a fixture (canary)', () => {
    const fixtureTags = new Set(Object.values(fixtures).map(f => f.t))
    for (const tag of [...CLIENT_MESSAGE_TAGS, ...SERVER_MESSAGE_TAGS]) {
      if (tag === 'snapshot') continue
      expect(fixtureTags.has(tag), `tag ${tag}`).toBe(true)
    }
  })

  it('round-trips a snapshot containing real game state', () => {
    const state = createGameState()
    addPlayer(state, 'p1', 'Alex')
    const msg: ServerMessage = { t: 'snapshot', serverTime: 1234, state }
    const decoded = decodeMessage(encodeMessage(msg))
    expect(decoded).toEqual(msg)
  })

  it('rejects malformed json and unknown tags', () => {
    expect(() => decodeMessage('not json')).toThrow()
    expect(() => decodeMessage(JSON.stringify({ t: 'hack' }))).toThrow()
    expect(() => decodeMessage(JSON.stringify({ nope: true }))).toThrow()
  })

  it('round-trips binary cam frames without base64', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
    const framed = encodeCamFrame('player-42', jpeg)
    expect(isCamFrame(framed)).toBe(true)
    const { playerId, jpeg: out } = decodeCamFrame(framed)
    expect(playerId).toBe('player-42')
    expect(out).toEqual(jpeg)
  })

  it('does not mistake json text bytes for a cam frame', () => {
    const text = new TextEncoder().encode('{"t":"start"}')
    expect(isCamFrame(text)).toBe(false)
  })

  it('pins the protocol version', () => {
    expect(PROTOCOL_VERSION).toBe(1)
    expect((fixtures.join as { protocolVersion: number }).protocolVersion).toBe(PROTOCOL_VERSION)
  })
})
