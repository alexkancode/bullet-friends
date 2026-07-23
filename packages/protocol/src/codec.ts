import type { Message } from './messages.js'
import { CLIENT_MESSAGE_TAGS, SERVER_MESSAGE_TAGS } from './messages.js'

const CAM_FRAME_TAG = 0x01

const KNOWN_TAGS = new Set<string>([...CLIENT_MESSAGE_TAGS, ...SERVER_MESSAGE_TAGS])

export function encodeMessage(msg: Message): string {
  return JSON.stringify(msg)
}

export function decodeMessage(raw: string): Message {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null || !('t' in parsed)) {
    throw new Error('message has no tag')
  }
  const tag = (parsed as { t: unknown }).t
  if (typeof tag !== 'string' || !KNOWN_TAGS.has(tag)) {
    throw new Error(`unknown message tag: ${String(tag)}`)
  }
  return parsed as Message
}

export function encodeCamFrame(playerId: string, jpeg: Uint8Array): Uint8Array {
  const idBytes = new TextEncoder().encode(playerId)
  const framed = new Uint8Array(2 + idBytes.length + jpeg.length)
  framed[0] = CAM_FRAME_TAG
  framed[1] = idBytes.length
  framed.set(idBytes, 2)
  framed.set(jpeg, 2 + idBytes.length)
  return framed
}

export function decodeCamFrame(framed: Uint8Array): { playerId: string; jpeg: Uint8Array } {
  const idLength = framed[1] ?? 0
  const playerId = new TextDecoder().decode(framed.subarray(2, 2 + idLength))
  return { playerId, jpeg: framed.subarray(2 + idLength) }
}

export function isCamFrame(data: Uint8Array): boolean {
  return data[0] === CAM_FRAME_TAG
}
