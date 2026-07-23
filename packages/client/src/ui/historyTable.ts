import type { ApiRunRecord } from '../net/api.js'

export function renderHistoryTable(host: HTMLElement, runs: ApiRunRecord[]): void {
  host.replaceChildren()
  if (runs.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'cam-note'
    empty.textContent = 'No recorded runs yet — play one while signed in with this group selected.'
    host.append(empty)
    return
  }
  const table = document.createElement('table')
  table.className = 'stats-table'
  const head = table.createTHead().insertRow()
  for (const text of ['When', 'Waves', 'Players']) {
    const th = document.createElement('th')
    th.textContent = text
    head.append(th)
  }
  const body = table.createTBody()
  for (const run of runs) {
    const row = body.insertRow()
    row.insertCell().textContent = new Date(run.endedAt).toLocaleString()
    row.insertCell().textContent = String(run.wave)
    row.insertCell().textContent = run.players
      .map(p => `${p.name} (Lv ${p.level}, ${p.kills} kills, ${Math.round(p.damageDealt)} dmg)`)
      .join(' · ')
  }
  host.append(table)
}
