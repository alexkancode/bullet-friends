import { execFileSync } from 'node:child_process'

const REPO = 'alexkancode/bullet-friends'
const PAGES_URL = 'https://alexkancode.github.io/bullet-friends/'
const SERVER_URL = 'https://bullet-friends-production.up.railway.app'

const results = []

function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`)
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

const head = git(['rev-parse', 'HEAD'])
console.log(`local HEAD: ${head}`)

const remoteRef = git(['ls-remote', 'origin', 'refs/heads/main']).split('\t')[0] ?? ''
record('origin/main matches HEAD', remoteRef === head, remoteRef === head ? 'pushed' : `origin/main is at ${remoteRef.slice(0, 12)} — push or pull first`)

let ciConclusion = 'not found'
try {
  const runs = JSON.parse(
    execFileSync('gh', ['run', 'list', '--repo', REPO, '--commit', head, '--json', 'status,conclusion'], { encoding: 'utf8' })
  )
  const run = runs[0]
  ciConclusion = run ? (run.status === 'completed' ? run.conclusion : run.status) : 'not found'
} catch {
  ciConclusion = 'gh unavailable'
}
record('CI run for HEAD succeeded', ciConclusion === 'success', ciConclusion)

const pageHtml = await fetch(`${PAGES_URL}?verify=${Date.now()}`, { cache: 'no-store' }).then(r => r.text()).catch(() => '')
const pageCommit = /<meta name="commit" content="([^"%]*)"/.exec(pageHtml)?.[1] ?? 'missing'
record('live client serves HEAD', pageCommit === head, `page reports ${pageCommit.slice(0, 12) || 'nothing'}`)

const health = await fetch(`${SERVER_URL}/health`, { cache: 'no-store' }).then(r => r.json()).catch(() => undefined)
const serverCommit = typeof health?.commit === 'string' ? health.commit : health?.ok ? 'unstamped' : 'unreachable'
record('live server serves HEAD', serverCommit === head, `health reports ${serverCommit.slice(0, 12)}`)

const failed = results.filter(r => !r.pass)
if (failed.length === 0) {
  console.log(`\nVERDICT: fully deployed — prod is running ${head.slice(0, 12)}`)
  process.exit(0)
}
console.log(`\nVERDICT: NOT fully deployed — stale: ${failed.map(f => f.name).join('; ')}`)
if (failed.some(f => f.name === 'live server serves HEAD')) {
  console.log('server remediation: railway variables --service bullet-friends --set "COMMIT_SHA=$(git rev-parse HEAD)" && railway up --service bullet-friends --detach')
}
process.exit(1)
