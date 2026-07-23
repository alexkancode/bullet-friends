import type { GameState, Phase } from '@bullet/core'
import { PROTOCOL_VERSION } from '@bullet/protocol'
import type { GameSocket } from './net/socket.js'
import { connectSocket } from './net/socket.js'
import { SnapshotBuffer } from './net/interpolation.js'
import { browserPlatform } from './platform/browser.js'
import { startFrameCapture } from './camera/capture.js'
import { CamFeeds } from './camera/feeds.js'
import { trackMovementKeys } from './input/keyboard.js'
import { SpriteStore } from './render/sprites.js'
import { drawScene } from './render/scene.js'
import { updateHud } from './ui/hud.js'
import { renderShop } from './ui/shop.js'
import { renderStatsCharts } from './ui/statsCharts.js'

const INPUT_SEND_MS = 50
const ART_BASE = import.meta.env.BASE_URL

function serverUrl(): string {
  const configured = import.meta.env.VITE_SERVER_URL as string | undefined
  if (configured) return configured
  return `ws://${location.hostname}:8080`
}

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found) throw new Error(`missing element #${id}`)
  return found as T
}

const ui = {
  lobby: el('lobby'),
  lobbyError: el('lobby-error'),
  nameInput: el<HTMLInputElement>('name-input'),
  roomInput: el<HTMLInputElement>('room-input'),
  joinButton: el<HTMLButtonElement>('join-button'),
  startPanel: el('start-panel'),
  roomLabel: el('room-label'),
  rosterList: el('roster-list'),
  startButton: el<HTMLButtonElement>('start-button'),
  camNote: el('cam-note'),
  hud: el('hud'),
  shop: el('shop'),
  shopCards: el('shop-cards'),
  shopWaiting: el('shop-waiting'),
  stats: el('stats'),
  statsLegend: el('stats-legend'),
  statsCharts: el('stats-charts'),
  statsTable: el('stats-table-host'),
  playAgainButton: el<HTMLButtonElement>('play-again-button'),
  canvas: el<HTMLCanvasElement>('game')
}

const hudElements = {
  wave: el('hud-wave'),
  timerFill: el('hud-timer-fill'),
  hpFill: el('hud-hp-fill'),
  hpLabel: el('hud-hp-label'),
  xpFill: el('hud-xp-fill'),
  levelLabel: el('hud-level')
}

const sprites = new SpriteStore(ART_BASE)
const feeds = new CamFeeds()
const buffer = new SnapshotBuffer()
const selfVideo = document.createElement('video')
selfVideo.muted = true
selfVideo.playsInline = true

let socket: GameSocket | undefined
let selfId: string | undefined
let shownPhase: Phase | 'none' = 'none'
let renderedOfferKey = ''

function setOverlay(overlay: HTMLElement | undefined): void {
  for (const panel of [ui.lobby, ui.shop, ui.stats]) panel.hidden = panel !== overlay
  ui.hud.hidden = overlay === ui.lobby
}

function syncScreens(state: GameState): void {
  const phase = state.phase
  if (phase === 'shopping') {
    const offerKey = selfId ? JSON.stringify(state.pendingOffers[selfId] ?? []) + Object.keys(state.pendingOffers).join() : ''
    if (shownPhase !== phase || offerKey !== renderedOfferKey) {
      renderedOfferKey = offerKey
      renderShop(ui.shopCards, ui.shopWaiting, state, selfId, ART_BASE, gearId => {
        socket?.send({ t: 'pickGear', gearId })
      })
    }
    setOverlay(ui.shop)
  } else if (phase === 'runOver') {
    if (shownPhase !== phase) renderStatsCharts(ui.statsLegend, ui.statsCharts, ui.statsTable, state.players)
    setOverlay(ui.stats)
  } else if (phase === 'lobby') {
    renderRoster(state)
    setOverlay(ui.lobby)
  } else {
    setOverlay(undefined)
  }
  shownPhase = phase
}

function renderRoster(state: GameState): void {
  ui.rosterList.replaceChildren()
  for (const player of state.players) {
    const item = document.createElement('li')
    item.textContent = player.name
    ui.rosterList.append(item)
  }
}

async function joinGame(): Promise<void> {
  const name = ui.nameInput.value.trim() || 'Spud'
  const room = ui.roomInput.value.trim() || randomRoomCode()
  browserPlatform.saveName(name)
  ui.joinButton.disabled = true
  ui.lobbyError.textContent = ''
  try {
    socket = await connectSocket(serverUrl(), {
      onMessage: msg => {
        if (msg.t === 'welcome') {
          selfId = msg.playerId
          ui.roomLabel.textContent = msg.room
          ui.startPanel.hidden = false
        }
        if (msg.t === 'snapshot') buffer.push(performance.now(), msg.state)
        if (msg.t === 'error') ui.lobbyError.textContent = msg.message
      },
      onCamFrame: (playerId, jpeg) => void feeds.accept(playerId, jpeg),
      onClose: () => {
        ui.lobbyError.textContent = 'Disconnected from server'
        ui.joinButton.disabled = false
        ui.startPanel.hidden = true
        selfId = undefined
      }
    })
  } catch (error) {
    ui.lobbyError.textContent = error instanceof Error ? error.message : 'Connection failed'
    ui.joinButton.disabled = false
    return
  }
  socket.send({ t: 'join', room, name, protocolVersion: PROTOCOL_VERSION })
  await startCamera()
}

async function startCamera(): Promise<void> {
  const stream = await browserPlatform.getCameraStream()
  if (!stream) {
    ui.camNote.textContent = 'Camera unavailable — playing with an initial instead'
    return
  }
  ui.camNote.textContent = ''
  selfVideo.srcObject = stream
  await selfVideo.play()
  startFrameCapture(selfVideo, bytes => socket?.sendFrame(bytes))
}

function randomRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  return Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('')
}

function resizeCanvas(): void {
  ui.canvas.width = ui.canvas.clientWidth * devicePixelRatio
  ui.canvas.height = ui.canvas.clientHeight * devicePixelRatio
}

function frame(): void {
  const state = buffer.sample(performance.now())
  if (state) {
    drawScene({ canvas: ui.canvas, sprites, feeds, selfVideo }, state, selfId)
    updateHud(hudElements, state, state.players.find(p => p.id === selfId))
    syncScreens(state)
  }
  requestAnimationFrame(frame)
}

const keys = trackMovementKeys()
let inputSeq = 0
setInterval(() => {
  if (!socket || !selfId) return
  socket.send({ t: 'input', seq: ++inputSeq, move: keys.current() })
}, INPUT_SEND_MS)

ui.nameInput.value = browserPlatform.loadName()
ui.joinButton.addEventListener('click', () => void joinGame())
ui.startButton.addEventListener('click', () => socket?.send({ t: 'start' }))
ui.playAgainButton.addEventListener('click', () => socket?.send({ t: 'playAgain' }))
window.addEventListener('resize', resizeCanvas)

resizeCanvas()
setOverlay(ui.lobby)
requestAnimationFrame(frame)
