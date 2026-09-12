import { fileURLToPath } from 'node:url'

export const SMOKE_PROTOCOL_VERSION = 1

const TIMEOUT_MS = 5000

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const timer = setTimeout(() => reject(new Error(`timed out connecting to ${url}`)), TIMEOUT_MS)
    ws.addEventListener('open', () => {
      clearTimeout(timer)
      resolve(ws)
    })
    ws.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new Error(`could not connect to ${url}`))
    })
  })
}

function nextMessage(ws, tag) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${tag}`)), TIMEOUT_MS)
    const onMessage = event => {
      if (typeof event.data !== 'string') return
      const msg = JSON.parse(event.data)
      if (msg.t !== tag) return
      clearTimeout(timer)
      ws.removeEventListener('message', onMessage)
      resolve(msg)
    }
    ws.addEventListener('message', onMessage)
  })
}

function closed(ws) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('socket stayed open')), TIMEOUT_MS)
    ws.addEventListener('close', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

function expectEqual(label, actual, expected) {
  if (actual !== expected) throw new Error(`[${label}] expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`)
  console.log(`ok   [${label}]`)
}

async function checkBadMessage(url) {
  const ws = await connect(url)
  const error = nextMessage(ws, 'error')
  ws.send('not json')
  expectEqual('ws rejects unreadable message', (await error).code, 'badMessage')
  ws.close()
}

async function checkVersionMismatch(url) {
  const ws = await connect(url)
  const error = nextMessage(ws, 'error')
  const gone = closed(ws)
  ws.send(JSON.stringify({ t: 'join', room: 'SMOKE', name: 'Old Client', protocolVersion: 0 }))
  expectEqual('ws rejects stale protocol', (await error).code, 'version')
  await gone
  expectEqual('ws closes stale client', ws.readyState, WebSocket.CLOSED)
}

async function checkJoin(url) {
  const ws = await connect(url)
  const welcome = nextMessage(ws, 'welcome')
  const design = nextMessage(ws, 'design')
  ws.send(JSON.stringify({ t: 'join', room: 'SMOKE', name: 'Smoke Tester', protocolVersion: SMOKE_PROTOCOL_VERSION }))
  const welcomed = await welcome
  expectEqual('ws join is welcomed into the room', welcomed.room, 'SMOKE')
  expectEqual('ws join receives a player id', typeof welcomed.playerId, 'string')
  expectEqual('ws join receives the room design', typeof (await design).design, 'object')
  ws.close()
}

export async function probe(url) {
  await checkBadMessage(url)
  await checkVersionMismatch(url)
  await checkJoin(url)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.argv[2]
  if (!url) {
    console.error('usage: node scripts/ws-probe.mjs <ws-url>')
    process.exit(2)
  }
  probe(url).then(
    () => process.exit(0),
    error => {
      console.error(`FAIL ${error.message}`)
      process.exit(1)
    }
  )
}
