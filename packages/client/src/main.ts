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
import { renderHistoryTable } from './ui/historyTable.js'
import { createGoogleAuthProvider, nullAuthProvider } from './auth/google.js'
import { inviteCodeFromSearch, inviteUrl } from './auth/invites.js'
import { apiBaseFromWsUrl, createGroupApi } from './net/api.js'
import type { ApiGroup } from './net/api.js'

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
  countdownBanner: el('countdown-banner'),
  statsLegend: el('stats-legend'),
  statsCharts: el('stats-charts'),
  statsTable: el('stats-table-host'),
  playAgainButton: el<HTMLButtonElement>('play-again-button'),
  canvas: el<HTMLCanvasElement>('game'),
  authPanel: el('auth-panel'),
  gsiButton: el('gsi-button'),
  groupPanel: el('group-panel'),
  groupGreeting: el('group-greeting'),
  groupSelect: el<HTMLSelectElement>('group-select'),
  groupNameInput: el<HTMLInputElement>('group-name-input'),
  groupCreateButton: el<HTMLButtonElement>('group-create-button'),
  inviteButton: el<HTMLButtonElement>('invite-button'),
  historyButton: el<HTMLButtonElement>('history-button'),
  groupNote: el('group-note'),
  history: el('history'),
  historyTitle: el('history-title'),
  historyTableHost: el('history-table-host'),
  historyCloseButton: el<HTMLButtonElement>('history-close-button')
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
  ui.countdownBanner.hidden = phase !== 'countdown'
  if (phase === 'countdown') {
    ui.countdownBanner.textContent = `Wave ${state.wave + 1} in ${Math.ceil(state.countdownMsLeft / 1000)}`
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
  const idToken = auth.token()
  const groupId = ui.groupSelect.value
  socket.send({
    t: 'join',
    room,
    name,
    protocolVersion: PROTOCOL_VERSION,
    ...(idToken && groupId ? { groupId, idToken } : {})
  })
  await startCamera()
}

const clientIdEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const auth = clientIdEnv ? createGoogleAuthProvider(clientIdEnv) : nullAuthProvider
const groupApi = createGroupApi(apiBaseFromWsUrl(serverUrl()), auth.token)
let selectedGroup: ApiGroup | undefined

function note(text: string): void {
  ui.groupNote.textContent = text
}

async function refreshGroups(): Promise<void> {
  const me = await groupApi.me()
  ui.groupSelect.replaceChildren()
  for (const group of me.groups) {
    const option = document.createElement('option')
    option.value = group.id
    option.textContent = group.name
    ui.groupSelect.append(option)
  }
  selectedGroup = me.groups.find(g => g.id === ui.groupSelect.value)
}

async function onSignedIn(name: string): Promise<void> {
  ui.groupGreeting.textContent = `Signed in as ${name}`
  ui.groupPanel.hidden = false
  const invite = inviteCodeFromSearch(location.search)
  if (invite) {
    const joined = await groupApi.acceptInvite(invite)
    note(joined ? `Joined group ${joined.name}` : 'That invite link was already used')
  }
  await refreshGroups()
}

if (auth.enabled) {
  ui.authPanel.hidden = false
  auth.renderButton(ui.gsiButton, (_token, profile) => void onSignedIn(profile.name).catch(() => note('Could not load your groups')))
}

ui.groupSelect.addEventListener('change', () => {
  selectedGroup = undefined
  void refreshGroups()
})
ui.groupCreateButton.addEventListener('click', () => {
  const name = ui.groupNameInput.value.trim()
  if (!name) return
  void groupApi
    .createGroup(name)
    .then(async group => {
      ui.groupNameInput.value = ''
      await refreshGroups()
      ui.groupSelect.value = group.id
      note(`Created group ${group.name}`)
    })
    .catch(() => note('Could not create the group'))
})
ui.inviteButton.addEventListener('click', () => {
  const groupId = ui.groupSelect.value
  if (!groupId) return
  void groupApi
    .createInvite(groupId)
    .then(code => {
      const link = inviteUrl(location.href, code)
      return navigator.clipboard
        .writeText(link)
        .then(() => note('Invite link copied to clipboard'))
        .catch(() => note(`Invite link: ${link}`))
    })
    .catch(() => note('Could not create an invite'))
})
ui.historyButton.addEventListener('click', () => {
  const groupId = ui.groupSelect.value
  if (!groupId) return
  void groupApi
    .history(groupId)
    .then(runs => {
      ui.historyTitle.textContent = `Run history — ${selectedGroup?.name ?? ui.groupSelect.selectedOptions[0]?.textContent ?? ''}`
      renderHistoryTable(ui.historyTableHost, runs)
      ui.history.hidden = false
    })
    .catch(() => note('Could not load history'))
})
ui.historyCloseButton.addEventListener('click', () => {
  ui.history.hidden = true
})

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
