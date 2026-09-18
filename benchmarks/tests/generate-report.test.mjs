import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { generateReportMarkdown } from '../scripts/lib/generate-report.mjs'
import { parseGfxInfo } from '../scripts/lib/parse-gfxinfo.mjs'

const sampleMetrics = parseGfxInfo(`
Total frames rendered: 200
Janky frames: 10 (5.00%)
50th percentile: 8ms
90th percentile: 14ms
95th percentile: 18ms
Number Missed Vsync: 2
Number Slow UI thread: 4
`)

const rowsOnlyMetrics = parseGfxInfo(`
Total frames rendered: 220
Janky frames: 33 (15.00%)
50th percentile: 11ms
90th percentile: 22ms
95th percentile: 28ms
Number Missed Vsync: 9
Number Slow UI thread: 18
`)

function sessionFixture() {
  return {
    generatedAtUtc: '2026-09-18T04:00:00Z',
    matrixName: 'publish',
    repetitions: 3,
    settleMs: 1500,
    sourceCommit: 'a'.repeat(40),
    sourceDirty: false,
    packageVersion: '0.2.0',
    buildCommand: 'pnpm benchmark:android:release',
    runtimeVersions: 'react-native 0.79.0; expo ~53.0.0',
    devices: [
      {
        label: 'Google Pixel 8',
        os: 'Android 15 (SDK 35)',
        storageThermal: 'battery 80%; thermal 32.0C'
      }
    ],
    runs: [
      {
        deviceLabel: 'Google Pixel 8',
        dataset: '100k-x-250',
        renderer: 'text',
        implementation: 'two-dimensional',
        scenario: 'fast-horizontal',
        repetition: 1,
        metrics: sampleMetrics,
        memoryPssKb: 321000,
        rawArtifact: './raw/two-d.txt'
      },
      {
        deviceLabel: 'Google Pixel 8',
        dataset: '100k-x-250',
        renderer: 'text',
        implementation: 'rows-only',
        scenario: 'fast-horizontal',
        repetition: 1,
        metrics: rowsOnlyMetrics,
        memoryPssKb: 410000,
        rawArtifact: './raw/rows.txt'
      },
      {
        deviceLabel: 'Google Pixel 8',
        dataset: '100k-x-250',
        renderer: 'text',
        implementation: 'two-dimensional',
        scenario: 'fast-vertical',
        repetition: 1,
        error: 'gfxinfo reported 0 frames',
        metrics: null,
        memoryPssKb: null,
        rawArtifact: null
      }
    ]
  }
}

test('generated report fills the publish template from parsed gfxinfo', () => {
  const markdown = generateReportMarkdown(sessionFixture())
  assert.match(markdown, /Source commit[\s\S]*aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/)
  assert.match(markdown, /Profiling enabled for frame claim \| No/)
  assert.match(markdown, /Google Pixel 8/)
  assert.match(markdown, /10\/200 janky \(5%\)/)
  assert.match(markdown, /33\/220 janky \(15%\)/)
  assert.match(markdown, /FAILED: gfxinfo reported 0 frames/)
  assert.match(markdown, /N\/A — React Profiler is disabled/)
  assert.match(markdown, /TOTAL PSS 321000 KB/)
  assert.match(markdown, /\[capture\]\(\.\/raw\/two-d\.txt\)/)
  assert.match(markdown, /Rows-only − 2D mean janky-frame percent: \+10 percentage points/)
  assert.doesNotMatch(markdown, /faster than/)
})

test('report-only regenerates markdown from summary.json', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rndg-bench-report-'))
  const summaryPath = join(directory, 'summary.json')
  await writeFile(summaryPath, JSON.stringify(sessionFixture(), null, 2))
  const runner = fileURLToPath(new URL('../scripts/run-android-release.mjs', import.meta.url))
  const result = spawnSync(process.execPath, [runner, '--report-only', directory], {
    encoding: 'utf8'
  })
  assert.equal(result.status, 0, result.stderr)
  const report = await readFile(join(directory, 'REPORT.md'), 'utf8')
  assert.match(report, /100k-x-250/)
  assert.match(report, /two-dimensional/)
})
