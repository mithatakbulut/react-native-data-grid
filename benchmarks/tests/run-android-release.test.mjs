import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const runner = fileURLToPath(new URL('../scripts/run-android-release.mjs', import.meta.url))

function run(args) {
  return spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8' })
}

test('dry-run prints the 24-run publish matrix and lab URLs', () => {
  const result = run(['--dry-run'])
  assert.equal(result.status, 0, result.stderr)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.matrixName, 'publish')
  assert.equal(payload.runCount, 24)
  assert.equal(payload.runs[0].labUrl.startsWith('rndg://lab?'), true)
  assert.equal(
    payload.runs.some(
      (run) =>
        run.dataset === '100k-x-250' &&
        run.implementation === 'two-dimensional' &&
        run.scenario === 'fast-horizontal'
    ),
    true
  )
})

test('selectors shrink the cartesian product', () => {
  const result = run([
    '--dry-run',
    '--dataset',
    '100k-x-250',
    '--implementation',
    'two-dimensional',
    '--renderer',
    'text',
    '--scenario',
    'fast-vertical',
    '--runs',
    '1'
  ])
  assert.equal(result.status, 0, result.stderr)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.runCount, 1)
  assert.equal(payload.runs[0].dataset, '100k-x-250')
  assert.equal(payload.runs[0].scenario, 'fast-vertical')
})

test('unknown flags fail closed', () => {
  const result = run(['--not-a-flag'])
  assert.notEqual(result.status, 0)
})
