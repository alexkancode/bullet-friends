import type { GameState, Vec } from '@bullet/core'

export interface JoinMessage {
  t: 'join'
  room: string
  name: string
  protocolVersion: number
  groupId?: string
  idToken?: string
}

export interface InputMessage {
  t: 'input'
  seq: number
  move: Vec
}

export interface StartMessage {
  t: 'start'
}

export interface PickGearMessage {
  t: 'pickGear'
  gearId: string
}

export interface PlayAgainMessage {
  t: 'playAgain'
}

export type ClientMessage = JoinMessage | InputMessage | StartMessage | PickGearMessage | PlayAgainMessage

export interface WelcomeMessage {
  t: 'welcome'
  playerId: string
  room: string
}

export interface SnapshotMessage {
  t: 'snapshot'
  serverTime: number
  state: GameState
}

export interface RosterMessage {
  t: 'roster'
  players: { id: string; name: string }[]
}

export interface ErrorMessage {
  t: 'error'
  code: string
  message: string
}

export type ServerMessage = WelcomeMessage | SnapshotMessage | RosterMessage | ErrorMessage

export type Message = ClientMessage | ServerMessage

export const CLIENT_MESSAGE_TAGS = ['join', 'input', 'start', 'pickGear', 'playAgain'] as const satisfies readonly ClientMessage['t'][]

export const SERVER_MESSAGE_TAGS = ['welcome', 'snapshot', 'roster', 'error'] as const satisfies readonly ServerMessage['t'][]
