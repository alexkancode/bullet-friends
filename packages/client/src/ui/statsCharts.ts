import type { PlayerState } from '@bullet/core'
import { buildMetricSeries, METRICS } from './statsData.js'
import type { MetricSeries } from './statsData.js'
import { playerColor, INK } from '../render/palette.js'

const SVG_NS = 'http://www.w3.org/2000/svg'
const CHART = { width: 340, height: 190, top: 16, right: 76, bottom: 26, left: 40 }

export function renderStatsCharts(legendHost: HTMLElement, chartsHost: HTMLElement, tableHost: HTMLElement, players: PlayerState[]): void {
  renderLegend(legendHost, players)
  chartsHost.replaceChildren()
  for (const metric of METRICS) {
    const series = buildMetricSeries(players, metric.key)
    chartsHost.append(buildChart(metric.label, series))
  }
  renderTotalsTable(tableHost, players)
}

function renderLegend(host: HTMLElement, players: PlayerState[]): void {
  host.replaceChildren()
  if (players.length < 2) return
  players.forEach((player, index) => {
    const entry = document.createElement('span')
    entry.className = 'legend-entry'
    const swatch = document.createElement('span')
    swatch.className = 'legend-swatch'
    swatch.style.setProperty('--swatch', playerColor(index))
    const name = document.createElement('span')
    name.textContent = player.name
    entry.append(swatch, name)
    host.append(entry)
  })
}

function buildChart(label: string, series: MetricSeries[]): HTMLElement {
  const waves = Math.max(1, ...series.map(s => s.values.length))
  const maxValue = Math.max(1, ...series.flatMap(s => s.values)) * 1.1

  const figure = document.createElement('figure')
  figure.className = 'chart'
  const caption = document.createElement('figcaption')
  caption.className = 'chart-title'
  caption.textContent = label
  figure.append(caption)

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${CHART.width} ${CHART.height}`)
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', `${label} per wave`)

  const plotWidth = CHART.width - CHART.left - CHART.right
  const plotHeight = CHART.height - CHART.top - CHART.bottom
  const xAt = (i: number) => CHART.left + (waves === 1 ? plotWidth / 2 : (i / (waves - 1)) * plotWidth)
  const yAt = (v: number) => CHART.top + plotHeight - (v / maxValue) * plotHeight

  for (let g = 0; g <= 2; g++) {
    const value = (maxValue / 2) * g
    const line = document.createElementNS(SVG_NS, 'line')
    line.setAttribute('x1', String(CHART.left))
    line.setAttribute('x2', String(CHART.left + plotWidth))
    line.setAttribute('y1', String(yAt(value)))
    line.setAttribute('y2', String(yAt(value)))
    line.setAttribute('stroke', g === 0 ? INK.baseline : INK.gridline)
    line.setAttribute('stroke-width', '1')
    svg.append(line)
    const tick = document.createElementNS(SVG_NS, 'text')
    tick.setAttribute('x', String(CHART.left - 6))
    tick.setAttribute('y', String(yAt(value) + 4))
    tick.setAttribute('class', 'chart-tick')
    tick.setAttribute('text-anchor', 'end')
    tick.textContent = formatValue(value)
    svg.append(tick)
  }

  for (let w = 0; w < waves; w++) {
    const tick = document.createElementNS(SVG_NS, 'text')
    tick.setAttribute('x', String(xAt(w)))
    tick.setAttribute('y', String(CHART.height - 8))
    tick.setAttribute('class', 'chart-tick')
    tick.setAttribute('text-anchor', 'middle')
    tick.textContent = String(w + 1)
    svg.append(tick)
  }

  for (const s of series) {
    const color = playerColor(s.colorIndex)
    if (s.values.length > 1) {
      const path = document.createElementNS(SVG_NS, 'path')
      path.setAttribute('d', s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(v)}`).join(' '))
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', color)
      path.setAttribute('stroke-width', '2')
      path.setAttribute('stroke-linejoin', 'round')
      svg.append(path)
    }
    s.values.forEach((v, i) => {
      const marker = document.createElementNS(SVG_NS, 'circle')
      marker.setAttribute('cx', String(xAt(i)))
      marker.setAttribute('cy', String(yAt(v)))
      marker.setAttribute('r', '4')
      marker.setAttribute('fill', color)
      const tooltip = document.createElementNS(SVG_NS, 'title')
      tooltip.textContent = `${s.name} — wave ${i + 1}: ${formatValue(v)}`
      marker.append(tooltip)
      svg.append(marker)
    })
    const lastValue = s.values[s.values.length - 1]
    if (lastValue !== undefined) {
      const endLabel = document.createElementNS(SVG_NS, 'text')
      endLabel.setAttribute('x', String(xAt(s.values.length - 1) + 8))
      endLabel.setAttribute('y', String(yAt(lastValue) + 4))
      endLabel.setAttribute('class', 'chart-end-label')
      endLabel.textContent = s.name
      svg.append(endLabel)
    }
  }

  figure.append(svg)
  return figure
}

function renderTotalsTable(host: HTMLElement, players: PlayerState[]): void {
  host.replaceChildren()
  const table = document.createElement('table')
  table.className = 'stats-table'
  const head = table.createTHead().insertRow()
  for (const text of ['Player', 'Level', ...METRICS.map(m => m.label)]) {
    const th = document.createElement('th')
    th.textContent = text
    head.append(th)
  }
  const body = table.createTBody()
  players.forEach((player, index) => {
    const row = body.insertRow()
    const nameCell = row.insertCell()
    const swatch = document.createElement('span')
    swatch.className = 'legend-swatch'
    swatch.style.setProperty('--swatch', playerColor(index))
    nameCell.append(swatch, document.createTextNode(` ${player.name}`))
    row.insertCell().textContent = String(player.level)
    for (const metric of METRICS) {
      const total = player.history.reduce((sum, entry) => sum + entry[metric.key], 0)
      row.insertCell().textContent = formatValue(total)
    }
  })
  host.append(table)
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
