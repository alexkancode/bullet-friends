import type { GameDesign, GameState, Phase } from '@bullet/core'
import { defaultDesign, roomCodeForGroup } from '@bullet/core'
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
import { formatStopwatch } from './ui/stopwatch.js'
import { nextStep, selectGroup } from './ui/onboarding.js'
import { statsExit } from './ui/leave.js'
import { memberLabel, visibilityControl } from './ui/groups.js'
import type { GroupSelectReason, OnboardProfile } from './ui/onboarding.js'
import { createGoogleAuthProvider, nullAuthProvider } from './auth/google.js'
import { inviteCodeFromSearch, inviteUrl } from './auth/invites.js'
import { apiBaseFromWsUrl, createGroupApi, ApiError } from './net/api.js'
import type { ApiGroup } from './net/api.js'
import { AudioEngine } from './audio/engine.js'
import { DemoLoop } from './attract/demo.js'
import { DesignerStudio } from './ui/designer.js'
import { detectAudioEvents, musicForPhase } from './audio/events.js'

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
  hud: el('hud'),
  stepAuth: el('step-auth'),
  tabSignin: el<HTMLButtonElement>('tab-signin'),
  tabSignup: el<HTMLButtonElement>('tab-signup'),
  signinForm: el<HTMLFormElement>('signin-form'),
  signinEmail: el<HTMLInputElement>('signin-email'),
  signinPassword: el<HTMLInputElement>('signin-password'),
  signupForm: el<HTMLFormElement>('signup-form'),
  signupName: el<HTMLInputElement>('signup-name'),
  signupEmail: el<HTMLInputElement>('signup-email'),
  signupPassword: el<HTMLInputElement>('signup-password'),
  signupConfirm: el<HTMLInputElement>('signup-confirm'),
  authError: el('auth-error'),
  gsiButton: el('gsi-button'),
  stepConsent: el('step-consent'),
  consentYes: el<HTMLButtonElement>('consent-yes'),
  consentNo: el<HTMLButtonElement>('consent-no'),
  consentError: el('consent-error'),
  stepGroup: el('step-group'),
  myGroups: el('my-groups'),
  groupNameInput: el<HTMLInputElement>('group-name-input'),
  groupCreateButton: el<HTMLButtonElement>('group-create-button'),
  groupError: el('group-error'),
  stepReady: el('step-ready'),
  readyTitle: el('ready-title'),
  roomLabel: el('room-label'),
  playButton: el<HTMLButtonElement>('play-button'),
  inviteButton: el<HTMLButtonElement>('invite-button'),
  historyButton: el<HTMLButtonElement>('history-button'),
  switchGroupButton: el<HTMLButtonElement>('switch-group-button'),
  visibilityButton: el<HTMLButtonElement>('visibility-button'),
  publicGroupsLabel: el('public-groups-label'),
  publicGroups: el('public-groups'),
  groupNote: el('group-note'),
  stepStaging: el('step-staging'),
  stagingRoom: el('staging-room'),
  rosterList: el('roster-list'),
  startButton: el<HTMLButtonElement>('start-button'),
  camNote: el('cam-note'),
  shop: el('shop'),
  shopCards: el('shop-cards'),
  shopWaiting: el('shop-waiting'),
  stats: el('stats'),
  statsLegend: el('stats-legend'),
  statsCharts: el('stats-charts'),
  statsTable: el('stats-table-host'),
  playAgainButton: el<HTMLButtonElement>('play-again-button'),
  countdownBanner: el('countdown-banner'),
  history: el('history'),
  historyTitle: el('history-title'),
  historyTableHost: el('history-table-host'),
  historyCloseButton: el<HTMLButtonElement>('history-close-button'),
  audioToggle: el<HTMLButtonElement>('audio-toggle'),
  pause: el('pause'),
  pauseTitle: el('pause-title'),
  pauseClock: el('pause-clock'),
  resumeButton: el<HTMLButtonElement>('resume-button'),
  leaveButton: el<HTMLButtonElement>('leave-button'),
  designSelect: el<HTMLSelectElement>('design-select'),
  studioButton: el<HTMLButtonElement>('studio-button'),
  designer: el('designer'),
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

const clientIdEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const auth = clientIdEnv ? createGoogleAuthProvider(clientIdEnv) : nullAuthProvider
let sessionToken = browserPlatform.loadSession()
const groupApi = createGroupApi(apiBaseFromWsUrl(serverUrl()), () => sessionToken)

let profile: OnboardProfile | undefined
let myGroups: ApiGroup[] = []
let activeGroup: ApiGroup | undefined
let joined = false
let leaveRequested = false
let socket: GameSocket | undefined
let selfId: string | undefined
let cameraStarted = false
let shownPhase: Phase | 'none' = 'none'
let renderedOfferKey = ''
let lastAudioState: GameState | undefined
const audio = new AudioEngine(ART_BASE, browserPlatform.loadAudioMuted())
const demo = new DemoLoop()
let lastFrameAt = performance.now()
const DEMO_DESIGN = defaultDesign()
let currentDesign: GameDesign = defaultDesign()
let myDesigns: { id: string; name: string }[] = []

const studio = new DesignerStudio(
  {
    overlay: ui.designer,
    nameInput: el<HTMLInputElement>('designer-name'),
    tabsHost: el('designer-tabs'),
    sectionHost: el('designer-sections'),
    note: el('designer-note'),
    saveButton: el<HTMLButtonElement>('designer-save'),
    closeButton: el<HTMLButtonElement>('designer-close')
  },
  ART_BASE,
  (design, id) => groupApi.saveDesign(design, id),
  () => void refreshDesigns()
)

async function refreshDesigns(): Promise<void> {
  myDesigns = await groupApi.listDesigns().catch(() => [])
  const selected = ui.designSelect.value
  ui.designSelect.replaceChildren()
  const classic = document.createElement('option')
  classic.value = ''
  classic.textContent = 'Classic'
  ui.designSelect.append(classic)
  for (const design of myDesigns) {
    const option = document.createElement('option')
    option.value = design.id
    option.textContent = design.name
    ui.designSelect.append(option)
  }
  if ([...ui.designSelect.options].some(o => o.value === selected)) ui.designSelect.value = selected
}

ui.studioButton.addEventListener('click', () => {
  const selectedId = ui.designSelect.value
  if (!selectedId) {
    studio.open(defaultDesign(), undefined)
    return
  }
  void groupApi.getDesign(selectedId).then(design => {
    studio.open(design ?? defaultDesign(), design ? selectedId : undefined)
  })
})

function reflectAudioToggle(): void {
  ui.audioToggle.textContent = audio.isMuted() ? 'Sound: off' : 'Sound: on'
}

ui.audioToggle.addEventListener('click', () => {
  audio.setMuted(!audio.isMuted())
  browserPlatform.saveAudioMuted(audio.isMuted())
  reflectAudioToggle()
})
reflectAudioToggle()

function renderFlow(): void {
  const step = joined ? 'staging' : nextStep(profile, activeGroup !== undefined)
  ui.stepAuth.hidden = step !== 'auth'
  ui.stepConsent.hidden = step !== 'consent'
  ui.stepGroup.hidden = step !== 'group'
  ui.stepReady.hidden = step !== 'ready'
  ui.stepStaging.hidden = step !== 'staging'
  if (step === 'group') renderGroupList()
  if (step === 'ready' && activeGroup) {
    ui.readyTitle.textContent = activeGroup.name
    ui.roomLabel.textContent = roomCodeForGroup(activeGroup.id)
    renderVisibilityButton()
  }
  if (step === 'staging' && activeGroup) {
    ui.stagingRoom.textContent = roomCodeForGroup(activeGroup.id)
  }
}

function renderVisibilityButton(): void {
  const control = visibilityControl(activeGroup, profile?.userId ?? '')
  ui.visibilityButton.hidden = control === undefined
  if (control) ui.visibilityButton.textContent = control.label
}

function groupPickItem(label: string, onPick: () => void): HTMLLIElement {
  const item = document.createElement('li')
  const pick = document.createElement('button')
  pick.className = 'group-pick'
  pick.type = 'button'
  pick.textContent = label
  pick.addEventListener('click', onPick)
  item.append(pick)
  return item
}

function renderGroupList(): void {
  ui.myGroups.replaceChildren()
  for (const group of myGroups) {
    ui.myGroups.append(
      groupPickItem(`${group.name} (${memberLabel(group.memberIds.length)})`, () => {
        activeGroup = group
        renderFlow()
      })
    )
  }
  if (myGroups.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'cam-note'
    empty.textContent = 'No groups yet — create one below or open a friend’s invite link.'
    ui.myGroups.append(empty)
  }
  void renderPublicGroups()
}

async function renderPublicGroups(): Promise<void> {
  const groups = await groupApi.publicGroups().catch(() => [])
  ui.publicGroupsLabel.hidden = groups.length === 0
  ui.publicGroups.replaceChildren()
  for (const group of groups) {
    ui.publicGroups.append(groupPickItem(`${group.name} (${memberLabel(group.memberIds.length)}) · Join`, () => void joinPublicGroup(group)))
  }
}

async function joinPublicGroup(group: ApiGroup): Promise<void> {
  try {
    await adoptGroup(await groupApi.joinGroup(group.id))
  } catch {
    ui.groupError.textContent = 'Could not join that crew'
  }
}

async function adoptGroup(group: ApiGroup): Promise<void> {
  await refreshGroups()
  activeGroup = myGroups.find(g => g.id === group.id) ?? group
  renderFlow()
}

async function adoptSession(token: string, newProfile: OnboardProfile): Promise<void> {
  sessionToken = token
  browserPlatform.saveSession(token)
  profile = newProfile
  await afterAuth()
}

async function afterAuth(): Promise<void> {
  const invite = inviteCodeFromSearch(location.search)
  if (invite) {
    const joinedGroup = await groupApi.acceptInvite(invite)
    if (joinedGroup) {
      activeGroup = joinedGroup
      ui.groupNote.textContent = `Joined group ${joinedGroup.name}`
    }
    history.replaceState(null, '', location.pathname)
  }
  await refreshGroups()
  renderFlow()
}

async function refreshGroups(reason: GroupSelectReason = 'load'): Promise<void> {
  const me = await groupApi.me()
  profile = me.profile
  myGroups = me.groups
  void refreshDesigns()
  activeGroup = selectGroup(myGroups, activeGroup, reason)
}

async function restoreSession(): Promise<void> {
  if (!sessionToken) {
    renderFlow()
    return
  }
  try {
    await afterAuth()
  } catch {
    sessionToken = undefined
    browserPlatform.clearSession()
    renderFlow()
  }
}

function authFail(error: unknown): void {
  ui.authError.textContent = error instanceof ApiError ? error.message : 'Could not reach the server'
}

ui.tabSignin.addEventListener('click', () => setAuthTab('signin'))
ui.tabSignup.addEventListener('click', () => setAuthTab('signup'))

function setAuthTab(tab: 'signin' | 'signup'): void {
  ui.signinForm.hidden = tab !== 'signin'
  ui.signupForm.hidden = tab !== 'signup'
  ui.tabSignin.classList.toggle('tab-active', tab === 'signin')
  ui.tabSignup.classList.toggle('tab-active', tab === 'signup')
  ui.authError.textContent = ''
}

ui.signinForm.addEventListener('submit', event => {
  event.preventDefault()
  void groupApi
    .login(ui.signinEmail.value.trim(), ui.signinPassword.value)
    .then(result => adoptSession(result.token, result.profile))
    .catch(authFail)
})

ui.signupForm.addEventListener('submit', event => {
  event.preventDefault()
  if (ui.signupPassword.value !== ui.signupConfirm.value) {
    ui.authError.textContent = 'Passwords do not match'
    return
  }
  void groupApi
    .signup(ui.signupName.value.trim(), ui.signupEmail.value.trim(), ui.signupPassword.value)
    .then(result => adoptSession(result.token, result.profile))
    .catch(authFail)
})

if (auth.enabled) {
  auth.renderButton(ui.gsiButton, googleToken => {
    void groupApi
      .googleExchange(googleToken)
      .then(result => adoptSession(result.token, result.profile))
      .catch(authFail)
  })
}

function answerConsent(allowed: boolean): void {
  void groupApi
    .setCamConsent(allowed)
    .then(() => {
      if (profile) profile = { ...profile, camConsent: allowed }
      renderFlow()
    })
    .catch(() => {
      ui.consentError.textContent = 'Could not save your choice, try again'
    })
}

ui.consentYes.addEventListener('click', () => answerConsent(true))
ui.consentNo.addEventListener('click', () => answerConsent(false))

ui.groupCreateButton.addEventListener('click', () => {
  const name = ui.groupNameInput.value.trim()
  if (!name) return
  void groupApi
    .createGroup(name)
    .then(group => {
      ui.groupNameInput.value = ''
      return adoptGroup(group)
    })
    .catch(() => {
      ui.groupError.textContent = 'Could not create the group'
    })
})

ui.visibilityButton.addEventListener('click', () => {
  const control = visibilityControl(activeGroup, profile?.userId ?? '')
  if (!activeGroup || !control) return
  void groupApi
    .setVisibility(activeGroup.id, control.next)
    .then(adoptGroup)
    .catch(() => (ui.groupNote.textContent = 'Could not change visibility'))
})

ui.switchGroupButton.addEventListener('click', () => {
  void refreshGroups('switch').then(renderFlow)
})

ui.inviteButton.addEventListener('click', () => {
  if (!activeGroup) return
  void groupApi
    .createInvite(activeGroup.id)
    .then(code => {
      const link = inviteUrl(location.href, code)
      return navigator.clipboard
        .writeText(link)
        .then(() => (ui.groupNote.textContent = 'Invite link copied to clipboard'))
        .catch(() => (ui.groupNote.textContent = `Invite link: ${link}`))
    })
    .catch(() => (ui.groupNote.textContent = 'Could not create an invite'))
})

ui.historyButton.addEventListener('click', () => {
  if (!activeGroup) return
  void groupApi
    .history(activeGroup.id)
    .then(runs => {
      ui.historyTitle.textContent = `Run history — ${activeGroup?.name ?? ''}`
      renderHistoryTable(ui.historyTableHost, runs)
      ui.history.hidden = false
    })
    .catch(() => (ui.groupNote.textContent = 'Could not load history'))
})

ui.historyCloseButton.addEventListener('click', () => {
  ui.history.hidden = true
})

ui.resumeButton.addEventListener('click', () => socket?.send({ t: 'resume' }))
ui.leaveButton.addEventListener('click', () => {
  leaveRequested = true
  socket?.send({ t: 'leave' })
})
window.addEventListener('keydown', event => {
  if (event.code !== 'Escape' || !joined || !socket) return
  const state = buffer.latest()
  if (!state) return
  if (state.pausedBy !== '') socket.send({ t: 'resume' })
  else if (state.phase === 'fighting' || state.phase === 'countdown') socket.send({ t: 'pause' })
})

ui.playButton.addEventListener('click', () => void joinGame())
ui.startButton.addEventListener('click', () => socket?.send({ t: 'start' }))
ui.playAgainButton.addEventListener('click', () => {
  if (statsExit(leaveRequested).action === 'disconnect') socket?.close()
  else socket?.send({ t: 'playAgain' })
})

async function joinGame(): Promise<void> {
  if (!profile || !activeGroup || !sessionToken) return
  audio.enable()
  ui.playButton.disabled = true
  ui.groupNote.textContent = ''
  try {
    socket = await connectSocket(serverUrl(), {
      onMessage: msg => {
        if (msg.t === 'welcome') {
          selfId = msg.playerId
          joined = true
          leaveRequested = false
          renderFlow()
        }
        if (msg.t === 'design') currentDesign = msg.design
        if (msg.t === 'snapshot') {
          buffer.push(performance.now(), msg.state)
          for (const event of detectAudioEvents(lastAudioState, msg.state, selfId)) audio.play(event)
          audio.setMusic(musicForPhase(msg.state.phase))
          lastAudioState = msg.state
        }
        if (msg.t === 'error') ui.groupNote.textContent = msg.message
      },
      onCamFrame: (playerId, jpeg) => void feeds.accept(playerId, jpeg),
      onClose: () => {
        joined = false
        selfId = undefined
        ui.playButton.disabled = false
        ui.groupNote.textContent = leaveRequested ? '' : 'Disconnected from server'
        leaveRequested = false
        shownPhase = 'none'
        setOverlay(ui.lobby)
        renderFlow()
      }
    })
  } catch (error) {
    ui.playButton.disabled = false
    ui.groupNote.textContent = error instanceof Error ? error.message : 'Connection failed'
    return
  }
  socket.send({
    t: 'join',
    room: roomCodeForGroup(activeGroup.id),
    name: profile.name,
    protocolVersion: PROTOCOL_VERSION,
    groupId: activeGroup.id,
    idToken: sessionToken
  })
  const designId = ui.designSelect.value
  if (designId) {
    const design = await groupApi.getDesign(designId)
    if (design) socket.send({ t: 'setDesign', design })
  }
  await startCameraIfConsented()
}

async function startCameraIfConsented(): Promise<void> {
  if (cameraStarted || profile?.camConsent !== true) {
    if (profile?.camConsent === false) ui.camNote.textContent = 'Playing without webcam, as you chose'
    return
  }
  const stream = await browserPlatform.getCameraStream()
  if (!stream) {
    ui.camNote.textContent = 'Camera unavailable — playing with your initial instead'
    return
  }
  cameraStarted = true
  ui.camNote.textContent = ''
  selfVideo.srcObject = stream
  await selfVideo.play()
  startFrameCapture(selfVideo, bytes => socket?.sendFrame(bytes))
}

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
      renderShop(ui.shopCards, ui.shopWaiting, state, selfId, ART_BASE, currentDesign, gearId => {
        audio.play('gearPick')
        socket?.send({ t: 'pickGear', gearId })
      })
    }
    setOverlay(ui.shop)
  } else if (phase === 'runOver') {
    if (shownPhase !== phase) renderStatsCharts(ui.statsLegend, ui.statsCharts, ui.statsTable, state.players)
    ui.playAgainButton.textContent = statsExit(leaveRequested).label
    setOverlay(ui.stats)
  } else if (phase === 'lobby') {
    renderRoster(state)
    setOverlay(ui.lobby)
  } else {
    setOverlay(undefined)
  }
  ui.countdownBanner.hidden = phase !== 'countdown' || state.pausedBy !== ''
  if (phase === 'countdown') {
    ui.countdownBanner.textContent = `Wave ${state.wave + 1} in ${Math.ceil(state.countdownMsLeft / 1000)}`
  }
  ui.pause.hidden = state.pausedBy === ''
  if (state.pausedBy !== '') {
    ui.pauseTitle.textContent = `${state.pausedBy} Paused`
    ui.pauseClock.textContent = formatStopwatch(state.pausedMs)
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

function resizeCanvas(): void {
  ui.canvas.width = ui.canvas.clientWidth * devicePixelRatio
  ui.canvas.height = ui.canvas.clientHeight * devicePixelRatio
}

function frame(): void {
  const now = performance.now()
  const delta = Math.min(now - lastFrameAt, 250)
  lastFrameAt = now
  if (joined) {
    ui.canvas.classList.remove('canvas-dimmed')
    const state = buffer.sample(now)
    if (state) {
      drawScene({ canvas: ui.canvas, sprites, feeds, selfVideo, design: currentDesign }, state, selfId)
      updateHud(hudElements, state, state.players.find(p => p.id === selfId), currentDesign)
      syncScreens(state)
    }
  } else {
    ui.canvas.classList.add('canvas-dimmed')
    drawScene({ canvas: ui.canvas, sprites, feeds, selfVideo, design: DEMO_DESIGN }, demo.advance(delta), undefined)
  }
  requestAnimationFrame(frame)
}

const keys = trackMovementKeys()
let inputSeq = 0
setInterval(() => {
  if (!socket || !selfId) return
  socket.send({ t: 'input', seq: ++inputSeq, move: keys.current() })
}, INPUT_SEND_MS)

window.addEventListener('resize', resizeCanvas)
resizeCanvas()
setOverlay(ui.lobby)
setAuthTab('signin')
void restoreSession()
requestAnimationFrame(frame)
