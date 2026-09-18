import assert from 'node:assert/strict'
import test from 'node:test'
import { parseUiNodeBounds, swipePath, tapCenter } from '../scripts/lib/adb.mjs'
import {
  MATRICES,
  buildLabUrl,
  expandMatrix,
  labReadyNeedle
} from '../scripts/lib/lab-contract.mjs'

test('publish matrix is the 100k-wide 2D vs rows-only fling set', () => {
  const runs = expandMatrix(MATRICES.publish)
  assert.equal(runs.length, 24)
  assert.equal(
    new Set(runs.map((run) => run.dataset)).size === 2 &&
      runs.every((run) => run.dataset.startsWith('100k-x-')),
    true
  )
  assert.deepEqual([...new Set(runs.map((run) => run.renderer))], ['text'])
  assert.deepEqual([...new Set(runs.map((run) => run.implementation))].sort(), [
    'rows-only',
    'two-dimensional'
  ])
  assert.deepEqual([...new Set(runs.map((run) => run.scenario))].sort(), [
    'fast-horizontal',
    'fast-vertical'
  ])
  assert.equal(Math.max(...runs.map((run) => run.repetition)), 3)
})

test('full automated matrix covers every dataset and renderer for both flings', () => {
  const runs = expandMatrix(MATRICES.full)
  assert.equal(runs.length, 4 * 3 * 2 * 2 * 3)
})

test('lab URLs encode the exact configuration the demo app applies', () => {
  const url = buildLabUrl({
    dataset: '100k-x-250',
    implementation: 'rows-only',
    renderer: 'text'
  })
  assert.equal(
    url,
    'rndg://lab?dataset=100k-x-250&implementation=rows-only&renderer=text&rowOverscan=3&columnOverscan=2&pinnedLeft=1&pinnedRight=1'
  )
  assert.equal(
    labReadyNeedle({
      dataset: '100k-x-250',
      implementation: 'rows-only',
      renderer: 'text'
    }),
    'lab-ready dataset:100k-x-250 implementation:rows-only renderer:text'
  )
})

test('reject unknown scenario names instead of emitting a silent no-op run', () => {
  assert.throws(
    () =>
      expandMatrix({
        ...MATRICES.publish,
        scenarios: ['stable-range']
      }),
    /scenario/
  )
})

test('swipePath flings up and left inside the grid bounds', () => {
  const bounds = { left: 100, top: 400, right: 1100, bottom: 1400 }
  const vertical = swipePath(bounds, 'fast-vertical')
  const horizontal = swipePath(bounds, 'fast-horizontal')
  assert.equal(vertical.x1, vertical.x2)
  assert.ok(vertical.y1 > vertical.y2)
  assert.equal(horizontal.y1, horizontal.y2)
  assert.ok(horizontal.x1 > horizontal.x2)
  assert.deepEqual(tapCenter(bounds), { x: 600, y: 900 })
})

test('parseUiNodeBounds reads Android uiautomator identifiers', () => {
  const xml = `<hierarchy><node content-desc="demo-grid-vertical-scroll" bounds="[10,200][1000,1800]" /></hierarchy>`
  assert.deepEqual(
    parseUiNodeBounds(xml, (node) => node.includes('demo-grid-vertical-scroll')),
    { left: 10, top: 200, right: 1000, bottom: 1800 }
  )
})

test('demo lab-config keeps the same dataset ids and ready-label contract', async () => {
  const { readFile } = await import('node:fs/promises')
  const { dirname, join } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
  const source = await readFile(join(repoRoot, 'apps/demo/lab-config.ts'), 'utf8')
  assert.match(source, /id: '100k-x-100'/)
  assert.match(source, /id: '100k-x-250'/)
  assert.match(source, /LAB_SCHEME = 'rndg'/)
  assert.match(
    source,
    /lab-ready dataset:\$\{config\.dataset\} implementation:\$\{config\.implementation\} renderer:\$\{config\.renderer\}/
  )
})
