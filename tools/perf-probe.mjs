import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { defaultDesign, roomCodeForGroup } from '../packages/core/dist/index.js'
import { PROTOCOL_VERSION, encodeCamFrame } from '../packages/protocol/dist/index.js'

const require = createRequire(import.meta.url)

const OPTIONS = parseArgs(process.argv.slice(2))
const API = OPTIONS.api ?? 'http://localhost:8080'
const PAGE = OPTIONS.url ?? 'http://localhost:4173'
const WS = API.replace(/^http/, 'ws')
const SECONDS = Number(OPTIONS.seconds ?? 20)
const THROTTLE = Number(OPTIONS.throttle ?? 1)
const SCENARIO = OPTIONS.scenario ?? 'light'
const BOTS = Number(OPTIONS.bots ?? (SCENARIO === 'heavy' ? 3 : 0))

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, '')] = argv[i + 1]
  return out
}

function loadPlaywright() {
  const roots = [process.env['PLAYWRIGHT_PATH'], '/home/alex/Desktop/dev/jellysite/node_modules/playwright'].filter(Boolean)
  for (const root of roots) {
    try {
      return require(root)
    } catch {
      continue
    }
  }
  throw new Error('playwright not found. Set PLAYWRIGHT_PATH to a playwright install.')
}

async function api(path, token, body) {
  const response = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`)
  return response.json()
}

const HEAVY_DESIGN = () => {
  const base = defaultDesign()
  return {
    ...base,
    name: 'Perf Heavy',
    enemies: base.enemies.slice(0, 1).map(enemy => ({ ...enemy, baseHp: 60, touchDamagePerSecond: 0, speed: 40 })),
    levels: base.levels.map(level => ({ ...level, durationMs: 120000, spawnIntervalMs: 100, enemyIds: [base.enemies[0].id] }))
  }
}

function instrumentation() {
  const perf = {
    frames: [],
    calls: {},
    jsonParse: { count: 0, ms: 0, bytes: 0 },
    bitmap: { count: 0, ms: 0 },
    snapshots: { count: 0, enemies: [], projectiles: [], orbs: [], players: [], bytes: [], phases: {} },
    startedAt: 0
  }
  window.__perf = perf

  let last = performance.now()
  const tick = now => {
    perf.frames.push(now - last)
    last = now
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  const nativeParse = JSON.parse
  JSON.parse = function (text, reviver) {
    const started = performance.now()
    const value = nativeParse.call(this, text, reviver)
    perf.jsonParse.ms += performance.now() - started
    perf.jsonParse.count += 1
    perf.jsonParse.bytes += typeof text === 'string' ? text.length : 0
    if (value && value.t === 'snapshot' && value.state) {
      perf.snapshots.count += 1
      perf.snapshots.enemies.push(value.state.enemies.length)
      perf.snapshots.projectiles.push(value.state.projectiles.length)
      perf.snapshots.orbs.push(value.state.orbs.length)
      perf.snapshots.players.push(value.state.players.length)
      perf.snapshots.bytes.push(typeof text === 'string' ? text.length : 0)
      const phase = value.state.phase
      perf.snapshots.phases[phase] = (perf.snapshots.phases[phase] ?? 0) + 1
    }
    return value
  }

  const nativeBitmap = window.createImageBitmap
  window.createImageBitmap = function (...args) {
    const started = performance.now()
    return nativeBitmap.apply(this, args).then(bitmap => {
      perf.bitmap.ms += performance.now() - started
      perf.bitmap.count += 1
      return bitmap
    })
  }

  const proto = CanvasRenderingContext2D.prototype
  for (const name of ['drawImage', 'fill', 'stroke', 'fillRect', 'fillText', 'arc', 'beginPath', 'save', 'restore', 'createRadialGradient', 'clip', 'setTransform', 'translate', 'scale']) {
    const native = proto[name]
    if (typeof native !== 'function') continue
    proto[name] = function (...args) {
      perf.calls[name] = (perf.calls[name] ?? 0) + 1
      return native.apply(this, args)
    }
  }

  setInterval(() => {
    const card = document.querySelector('#shop:not([hidden]) #shop-cards .gear-card:not([disabled])')
    if (card) card.click()
  }, 250)

  perf.reset = () => {
    perf.frames.length = 0
    perf.calls = {}
    perf.jsonParse = { count: 0, ms: 0, bytes: 0 }
    perf.bitmap = { count: 0, ms: 0 }
    perf.snapshots = { count: 0, enemies: [], projectiles: [], orbs: [], players: [], bytes: [], phases: {} }
    perf.startedAt = performance.now()
    last = performance.now()
  }
}

function percentile(values, p) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]
}

const mean = values => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length)
const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits

function spawnBot(WebSocketImpl, room, name, jpeg) {
  const socket = new WebSocketImpl(WS)
  let playerId
  let angle = Math.random() * Math.PI * 2
  const timers = []
  socket.on('open', () => {
    socket.send(JSON.stringify({ t: 'join', room, name, protocolVersion: PROTOCOL_VERSION }))
    timers.push(
      setInterval(() => {
        angle += 0.08
        socket.send(JSON.stringify({ t: 'input', seq: 0, move: { x: Math.cos(angle), y: Math.sin(angle) } }))
      }, 50)
    )
    timers.push(
      setInterval(() => {
        if (playerId) socket.send(encodeCamFrame(playerId, jpeg))
      }, 84)
    )
  })
  socket.on('message', (data, isBinary) => {
    if (isBinary) return
    const msg = JSON.parse(data.toString())
    if (msg.t === 'welcome') playerId = msg.playerId
    if (msg.t === 'snapshot' && msg.state.phase === 'shopping' && playerId) {
      const offer = msg.state.pendingOffers[playerId]
      if (offer && offer.length > 0) socket.send(JSON.stringify({ t: 'pickGear', gearId: offer[0] }))
    }
  })
  socket.on('error', () => undefined)
  return () => {
    for (const timer of timers) clearInterval(timer)
    socket.close()
  }
}

async function main() {
  const { chromium } = loadPlaywright()
  const { WebSocket: NodeWebSocket } = require('ws')
  const stamp = Date.now()
  const email = `perf+${stamp}@example.com`

  const auth = await api('/api/auth/signup', undefined, { name: 'Perf Probe', email, password: 'password123' })
  await api('/api/me/cam-consent', auth.token, { allowed: true })
  const group = await api('/api/groups', auth.token, { name: `Perf ${stamp}` })
  const room = roomCodeForGroup(group.id)
  const designId = SCENARIO === 'heavy' ? (await api('/api/designs', auth.token, { design: HEAVY_DESIGN() })).id : ''

  const gpuArgs = OPTIONS.gpu === '1' ? ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] : []
  const browser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', ...gpuArgs]
  })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['camera'] })
  await context.addInitScript(instrumentation)
  const page = await context.newPage()
  page.on('pageerror', error => console.error('pageerror', error.message))

  const jpeg = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 96
      canvas.height = 96
      const ctx = canvas.getContext('2d')
      for (let i = 0; i < 96; i += 8) {
        ctx.fillStyle = `hsl(${i * 4}, 70%, 50%)`
        ctx.fillRect(i, 0, 8, 96)
      }
      return canvas.toDataURL('image/jpeg', 0.55).split(',')[1]
    }),
    'base64'
  )

  const stopBots = Array.from({ length: BOTS }, (_, i) => spawnBot(NodeWebSocket, room, `Bot ${i + 1}`, new Uint8Array(jpeg)))

  await page.goto(PAGE)
  await page.fill('#signin-email', email)
  await page.fill('#signin-password', 'password123')
  await page.click('#signin-form .button-primary')
  await page.waitForSelector('#step-ready:not([hidden])', { timeout: 20000 })
  if (designId) await page.selectOption('#design-select', { label: 'Perf Heavy' })
  await page.click('#play-button')
  await page.waitForSelector('#step-staging:not([hidden])')
  await page.click('#start-button')
  await page.waitForSelector('#hud:not([hidden])')

  const warmupMs = SCENARIO === 'heavy' ? 25000 : 4000
  await page.waitForTimeout(warmupMs)

  const client = await context.newCDPSession(page)
  await client.send('Performance.enable')
  await client.send('Profiler.enable')
  await client.send('Profiler.setSamplingInterval', { interval: 200 })
  await client.send('HeapProfiler.enable')
  if (THROTTLE > 1) await client.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  await page.waitForTimeout(1500)

  const before = await client.send('Performance.getMetrics')
  await client.send('Profiler.start')
  await client.send('HeapProfiler.startSampling', { samplingInterval: 4096 })
  await page.evaluate(() => window.__perf.reset())

  await page.waitForTimeout(SECONDS * 1000)

  const dump = await page.evaluate(() => ({ ...window.__perf, reset: undefined }))
  const { profile } = await client.send('Profiler.stop')
  const { profile: heap } = await client.send('HeapProfiler.stopSampling')
  const after = await client.send('Performance.getMetrics')
  if (THROTTLE > 1) await client.send('Emulation.setCPUThrottlingRate', { rate: 1 })

  for (const stop of stopBots) stop()
  await browser.close()

  const report = buildReport(dump, profile, heap, before.metrics, after.metrics)
  printReport(report)
  const fighting = report.entities.phases['fighting'] ?? 0
  if (fighting < report.entities.snapshots * 0.9) {
    console.error(`\nINVALID RUN: only ${fighting}/${report.entities.snapshots} snapshots were in the fighting phase (${JSON.stringify(report.entities.phases)}).`)
    process.exitCode = 1
  }
  if (OPTIONS.json) {
    writeFileSync(OPTIONS.json, JSON.stringify(report, null, 2))
    console.log(`\nwrote ${OPTIONS.json}`)
  }
}

function metricDelta(before, after, name) {
  const pick = list => list.find(m => m.name === name)?.value ?? 0
  return pick(after) - pick(before)
}

function selfTimes(profile) {
  const byId = new Map(profile.nodes.map(node => [node.id, node]))
  const totals = new Map()
  const interval = (profile.endTime - profile.startTime) / 1000
  const samples = profile.samples ?? []
  const perSample = samples.length > 0 ? interval / samples.length : 0
  for (const id of samples) {
    const node = byId.get(id)
    if (!node) continue
    const frame = node.callFrame
    const file = (frame.url ?? '').split('/').pop() ?? 'unknown'
    const key = `${frame.functionName || '(anonymous)'} · ${file}:${frame.lineNumber + 1}`
    totals.set(key, (totals.get(key) ?? 0) + perSample)
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name, ms]) => ({ name, ms: round(ms) }))
}

function heapTotals(heap) {
  const totals = new Map()
  const walk = node => {
    const size = (node.selfSize ?? 0)
    if (size > 0) {
      const frame = node.callFrame
      const file = (frame.url ?? '').split('/').pop() ?? 'unknown'
      const key = `${frame.functionName || '(anonymous)'} · ${file}:${frame.lineNumber + 1}`
      totals.set(key, (totals.get(key) ?? 0) + size)
    }
    for (const child of node.children ?? []) walk(child)
  }
  walk(heap.head)
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name, bytes]) => ({ name, kb: round(bytes / 1024, 1) }))
}

function buildReport(dump, profile, heap, before, after) {
  const frames = dump.frames.filter(delta => delta > 0)
  const scriptMs = metricDelta(before, after, 'ScriptDuration') * 1000
  const layoutMs = metricDelta(before, after, 'LayoutDuration') * 1000
  const styleMs = metricDelta(before, after, 'RecalcStyleDuration') * 1000
  const taskMs = metricDelta(before, after, 'TaskDuration') * 1000
  const allocated = heapTotals(heap)
  return {
    scenario: SCENARIO,
    throttle: THROTTLE,
    seconds: SECONDS,
    bots: BOTS,
    frames: {
      count: frames.length,
      fps: round(frames.length / SECONDS, 1),
      meanMs: round(mean(frames)),
      p50Ms: round(percentile(frames, 0.5)),
      p95Ms: round(percentile(frames, 0.95)),
      p99Ms: round(percentile(frames, 0.99)),
      maxMs: round(Math.max(...frames)),
      over16ms: frames.filter(f => f > 16.7).length,
      over33ms: frames.filter(f => f > 33.4).length
    },
    entities: {
      snapshots: dump.snapshots.count,
      enemiesMean: round(mean(dump.snapshots.enemies), 0),
      enemiesMax: dump.snapshots.enemies.length > 0 ? Math.max(...dump.snapshots.enemies) : 0,
      projectilesMean: round(mean(dump.snapshots.projectiles), 0),
      orbsMean: round(mean(dump.snapshots.orbs), 0),
      players: dump.snapshots.players.length > 0 ? Math.max(...dump.snapshots.players) : 0,
      phases: dump.snapshots.phases,
      snapshotKbMean: round(mean(dump.snapshots.bytes) / 1024, 1),
      snapshotKbPerSecond: round((dump.snapshots.bytes.reduce((a, b) => a + b, 0) / 1024) / SECONDS, 1)
    },
    budget: {
      scriptMsPerFrame: round(scriptMs / Math.max(frames.length, 1)),
      styleMsPerFrame: round(styleMs / Math.max(frames.length, 1)),
      layoutMsPerFrame: round(layoutMs / Math.max(frames.length, 1)),
      taskMsPerFrame: round(taskMs / Math.max(frames.length, 1)),
      jsonParseMsPerFrame: round(dump.jsonParse.ms / Math.max(frames.length, 1)),
      bitmapMsPerFrame: round(dump.bitmap.ms / Math.max(frames.length, 1))
    },
    json: { ...dump.jsonParse, ms: round(dump.jsonParse.ms), kb: round(dump.jsonParse.bytes / 1024, 1) },
    bitmaps: { count: dump.bitmap.count, ms: round(dump.bitmap.ms) },
    drawCallsPerFrame: Object.fromEntries(
      Object.entries(dump.calls)
        .map(([name, count]) => [name, round(count / Math.max(frames.length, 1), 1)])
        .sort((a, b) => b[1] - a[1])
    ),
    hotFunctions: selfTimes(profile).slice(0, 18),
    allocators: allocated.slice(0, 12),
    allocatedKbTotal: round(allocated.reduce((sum, entry) => sum + entry.kb, 0), 1)
  }
}

function printReport(report) {
  console.log(`\n=== peak-frames: ${report.scenario} @ ${report.throttle}x CPU, ${report.seconds}s, ${report.bots} bots`)
  console.table(report.frames)
  console.table(report.entities)
  console.table(report.budget)
  console.log('draw calls per frame:', report.drawCallsPerFrame)
  console.log(`json parse: ${report.json.count} calls, ${report.json.ms}ms, ${report.json.kb}kb`)
  console.log(`cam bitmaps: ${report.bitmaps.count} decodes, ${report.bitmaps.ms}ms`)
  console.log(`\ntop JS self time (ms over ${report.seconds}s):`)
  for (const entry of report.hotFunctions) console.log(`  ${String(entry.ms).padStart(7)}  ${entry.name}`)
  console.log(`\ntop allocators (kb over ${report.seconds}s, total sampled ${report.allocatedKbTotal}kb):`)
  for (const entry of report.allocators) console.log(`  ${String(entry.kb).padStart(9)}  ${entry.name}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
