import { execFileSync, execSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { rolloutSettled } from './rollout.mjs'

const REPO = 'alexkancode/bullet-friends'
const SERVER_URL = 'https://bullet-friends-production.up.railway.app'
const CI_TIMEOUT_MS = 8 * 60 * 1000
const HEALTH_TIMEOUT_MS = 6 * 60 * 1000
const ROLLOUT_TIMEOUT_MS = 5 * 60 * 1000

function run(label, command) {
  console.log(`\n== ${label}`)
  execSync(command, { stdio: 'inherit' })
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function fail(message) {
  console.error(`\nDEPLOY ABORTED: ${message}`)
  process.exit(1)
}

if (git(['status', '--porcelain']).length > 0) fail('working tree is dirty — commit or stash first')
if (git(['branch', '--show-current']) !== 'main') fail('not on main')
const head = git(['rev-parse', 'HEAD'])
console.log(`deploying ${head.slice(0, 12)}`)

run('gate: lint', 'npm run lint')
run('gate: typecheck', 'npm run typecheck')
run('gate: tests', 'npm test')
run('gate: build', 'npm run build')
run('push', 'git push origin main')

console.log('\n== waiting for CI')
const ciDeadline = Date.now() + CI_TIMEOUT_MS
let conclusion = ''
while (Date.now() < ciDeadline) {
  await sleep(15000)
  const runs = JSON.parse(
    execFileSync('gh', ['run', 'list', '--repo', REPO, '--commit', head, '--json', 'status,conclusion'], { encoding: 'utf8' })
  )
  const ciRun = runs[0]
  if (!ciRun) continue
  process.stdout.write(`  ci: ${ciRun.status}\n`)
  if (ciRun.status === 'completed') {
    conclusion = ciRun.conclusion
    break
  }
}
if (conclusion !== 'success') fail(`CI did not succeed (${conclusion || 'timed out'})`)

run('railway: stamp commit', `railway variables --service bullet-friends --set "COMMIT_SHA=${head}"`)
run('railway: deploy', 'railway up --service bullet-friends --detach')

console.log('\n== waiting for server health to report HEAD')
const healthDeadline = Date.now() + HEALTH_TIMEOUT_MS
let live = ''
while (Date.now() < healthDeadline) {
  await sleep(10000)
  const health = await fetch(`${SERVER_URL}/health`, { cache: 'no-store' }).then(r => r.json()).catch(() => undefined)
  live = typeof health?.commit === 'string' ? health.commit : 'unreachable'
  process.stdout.write(`  health: ${live.slice(0, 12)}\n`)
  if (live === head) break
}
if (live !== head) fail('server never reported HEAD — check railway logs')

console.log('\n== waiting for the previous deployment to drain')
const rolloutDeadline = Date.now() + ROLLOUT_TIMEOUT_MS
let settled = false
while (Date.now() < rolloutDeadline) {
  const deployments = JSON.parse(
    execFileSync('railway', ['deployment', 'list', '--service', 'bullet-friends', '--json', '--limit', '5'], { encoding: 'utf8' })
  )
  process.stdout.write(`  deployments: ${deployments.map(d => d.status).join(', ')}\n`)
  settled = rolloutSettled(deployments)
  if (settled) break
  await sleep(10000)
}
if (!settled) fail('previous deployment never drained — check railway deployment list')

console.log('\n== final verification')
const verify = spawnSync('node', [fileURLToPath(new URL('../deploy-bullet-friends-verification/verify.mjs', import.meta.url))], { stdio: 'inherit' })
if (verify.status !== 0) process.exit(verify.status ?? 1)

run('smoke: production', `BASE_URL=${SERVER_URL} bash scripts/smoke.sh`)
