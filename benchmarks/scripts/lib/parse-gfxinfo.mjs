const INT = String.raw`(\d+)`
const FLOAT = String.raw`(\d+(?:\.\d+)?)`

/**
 * Parse `adb shell dumpsys gfxinfo` text into the fields a published report needs.
 * Missing fields stay null so a completed report can distinguish "not exposed" from zero.
 */
export function parseGfxInfo(text) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('gfxinfo dump is empty')
  }

  const totalFrames = matchInt(text, new RegExp(`Total frames rendered:\\s*${INT}`))
  const janky = matchJanky(text)
  const histogram = parseHistogram(text)
  const percentiles = {
    p50Ms: matchInt(text, new RegExp(`50th percentile:\\s*${INT}ms`)),
    p90Ms: matchInt(text, new RegExp(`90th percentile:\\s*${INT}ms`)),
    p95Ms: matchInt(text, new RegExp(`95th percentile:\\s*${INT}ms`)),
    p99Ms: matchInt(text, new RegExp(`99th percentile:\\s*${INT}ms`))
  }

  if (histogram.length > 0) {
    if (percentiles.p50Ms == null) percentiles.p50Ms = percentileFromHistogram(histogram, 50)
    if (percentiles.p90Ms == null) percentiles.p90Ms = percentileFromHistogram(histogram, 90)
    if (percentiles.p95Ms == null) percentiles.p95Ms = percentileFromHistogram(histogram, 95)
    if (percentiles.p99Ms == null) percentiles.p99Ms = percentileFromHistogram(histogram, 99)
  }

  return {
    totalFrames,
    jankyFrames: janky.frames,
    jankyPercent: janky.percent,
    missedVsync: matchInt(text, new RegExp(`Number Missed Vsync:\\s*${INT}`)),
    highInputLatency: matchInt(text, new RegExp(`Number High input latency:\\s*${INT}`)),
    slowUiThread: matchInt(text, new RegExp(`Number Slow UI thread:\\s*${INT}`)),
    slowBitmapUploads: matchInt(text, new RegExp(`Number Slow bitmap uploads:\\s*${INT}`)),
    slowIssueDrawCommands: matchInt(text, new RegExp(`Number Slow issue draw commands:\\s*${INT}`)),
    frameDeadlineMissed: matchInt(text, new RegExp(`Number Frame deadline missed:\\s*${INT}`)),
    ...percentiles,
    histogram
  }
}

export function parseMemInfoPssKb(text) {
  if (typeof text !== 'string' || text.length === 0) return null
  const totalPss = text.match(new RegExp(`TOTAL PSS:\\s*${INT}`, 'i'))
  if (totalPss) return Number(totalPss[1])
  const total = text.match(new RegExp(`^TOTAL\\s+${INT}`, 'm'))
  return total ? Number(total[1]) : null
}

export function formatJankEvidence(metrics) {
  if (!metrics || metrics.totalFrames == null || metrics.jankyFrames == null) {
    return 'N/A — gfxinfo did not expose frame totals'
  }

  const percent = metrics.jankyPercent == null ? 'n/a' : `${trimNumber(metrics.jankyPercent, 2)}%`
  const parts = [
    `${metrics.jankyFrames}/${metrics.totalFrames} janky (${percent})`,
    formatMs('p50', metrics.p50Ms),
    formatMs('p90', metrics.p90Ms),
    formatMs('p95', metrics.p95Ms)
  ].filter(Boolean)

  if (metrics.missedVsync != null) parts.push(`missed vsync ${metrics.missedVsync}`)
  if (metrics.slowUiThread != null) parts.push(`slow UI ${metrics.slowUiThread}`)
  return parts.join('; ')
}

function matchJanky(text) {
  const withPercent = text.match(new RegExp(`Janky frames:\\s*${INT}\\s*\\(${FLOAT}%\\)`))
  if (withPercent) {
    return { frames: Number(withPercent[1]), percent: Number(withPercent[2]) }
  }
  const framesOnly = text.match(new RegExp(`Janky frames:\\s*${INT}`))
  if (!framesOnly) return { frames: null, percent: null }
  const frames = Number(framesOnly[1])
  const total = matchInt(text, new RegExp(`Total frames rendered:\\s*${INT}`))
  return {
    frames,
    percent: total ? (frames / total) * 100 : null
  }
}

function parseHistogram(text) {
  const line = text.match(/HISTOGRAM:\s*(.+)/)
  if (!line) return []
  const buckets = []
  for (const token of line[1].trim().split(/\s+/)) {
    const match = token.match(/^(\d+)ms=(\d+)$/)
    if (match) buckets.push({ ms: Number(match[1]), count: Number(match[2]) })
  }
  return buckets
}

function percentileFromHistogram(histogram, percentile) {
  const total = histogram.reduce((sum, bucket) => sum + bucket.count, 0)
  if (total === 0) return null
  const target = Math.ceil((percentile / 100) * total)
  let seen = 0
  for (const bucket of histogram) {
    seen += bucket.count
    if (seen >= target) return bucket.ms
  }
  return histogram.at(-1)?.ms ?? null
}

function matchInt(text, pattern) {
  const match = text.match(pattern)
  return match ? Number(match[1]) : null
}

function formatMs(label, value) {
  return value == null ? '' : `${label} ${value}ms`
}

function trimNumber(value, digits) {
  return Number(value.toFixed(digits)).toString()
}
