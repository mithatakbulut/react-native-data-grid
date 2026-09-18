import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  formatJankEvidence,
  parseGfxInfo,
  parseMemInfoPssKb
} from '../scripts/lib/parse-gfxinfo.mjs'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

test('parseGfxInfo reads jank totals, percentiles, and counters', async () => {
  const dump = await readFile(join(fixtures, 'gfxinfo-sample.txt'), 'utf8')
  const metrics = parseGfxInfo(dump)

  assert.equal(metrics.totalFrames, 247)
  assert.equal(metrics.jankyFrames, 18)
  assert.equal(metrics.jankyPercent, 7.29)
  assert.equal(metrics.missedVsync, 5)
  assert.equal(metrics.slowUiThread, 12)
  assert.equal(metrics.p50Ms, 7)
  assert.equal(metrics.p90Ms, 12)
  assert.equal(metrics.p95Ms, 16)
  assert.equal(metrics.p99Ms, 25)
  assert.equal(metrics.histogram.at(-1)?.ms, 25)
})

test('parseGfxInfo derives jank percent and percentiles from a histogram when omitted', async () => {
  const dump = await readFile(join(fixtures, 'gfxinfo-histogram-only.txt'), 'utf8')
  const metrics = parseGfxInfo(dump)

  assert.equal(metrics.jankyFrames, 4)
  assert.equal(metrics.jankyPercent, 4)
  assert.equal(metrics.p50Ms, 5)
  assert.equal(metrics.p90Ms, 8)
  assert.equal(metrics.p95Ms, 16)
  assert.equal(metrics.p99Ms, 24)
})

test('parseGfxInfo rejects an empty dump', () => {
  assert.throws(() => parseGfxInfo(''), /empty/)
})

test('formatJankEvidence summarizes the publishable frame claim', async () => {
  const dump = await readFile(join(fixtures, 'gfxinfo-sample.txt'), 'utf8')
  assert.match(formatJankEvidence(parseGfxInfo(dump)), /18\/247 janky \(7\.29%\).*p50 7ms/)
})

test('parseMemInfoPssKb prefers TOTAL PSS then the TOTAL table row', () => {
  assert.equal(parseMemInfoPssKb('App Summary\nTOTAL PSS:    67890\n'), 67890)
  assert.equal(
    parseMemInfoPssKb('                 Pss\nTOTAL           123456    1    2\n'),
    123456
  )
  assert.equal(parseMemInfoPssKb(''), null)
})
