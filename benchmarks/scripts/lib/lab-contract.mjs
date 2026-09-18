/** Canonical lab URL and publish-matrix contract used by the Android runner. */

export const APP_ID = 'com.reactnativedatagrid.demo'
export const LAB_SCHEME = 'rndg'
export const LAB_HOST = 'lab'
export const ACTIVITY = `${APP_ID}/.MainActivity`

export const DATASETS = Object.freeze(['10k-x-20', '100k-x-20', '100k-x-100', '100k-x-250'])
export const RENDERERS = Object.freeze(['text', 'rich', 'image'])
export const IMPLEMENTATIONS = Object.freeze(['two-dimensional', 'rows-only'])
export const SCENARIOS = Object.freeze([
  'stable-range',
  'fast-vertical',
  'fast-horizontal',
  'alternating'
])
export const AUTOMATED_SCENARIOS = Object.freeze(['fast-vertical', 'fast-horizontal'])

export const DEFAULT_OVERSCAN = Object.freeze({
  rowOverscan: 3,
  columnOverscan: 2,
  pinnedLeft: 1,
  pinnedRight: 1
})

export const MATRICES = Object.freeze({
  publish: Object.freeze({
    name: 'publish',
    datasets: Object.freeze(['100k-x-100', '100k-x-250']),
    renderers: Object.freeze(['text']),
    implementations: Object.freeze(['two-dimensional', 'rows-only']),
    scenarios: AUTOMATED_SCENARIOS,
    repetitions: 3
  }),
  full: Object.freeze({
    name: 'full',
    datasets: DATASETS,
    renderers: RENDERERS,
    implementations: IMPLEMENTATIONS,
    scenarios: AUTOMATED_SCENARIOS,
    repetitions: 3
  })
})

export function assertAllowed(kind, value, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`Unknown ${kind} "${value}". Expected one of: ${allowed.join(', ')}`)
  }
  return value
}

export function buildLabUrl({
  dataset,
  implementation,
  renderer,
  rowOverscan = DEFAULT_OVERSCAN.rowOverscan,
  columnOverscan = DEFAULT_OVERSCAN.columnOverscan,
  pinnedLeft = DEFAULT_OVERSCAN.pinnedLeft,
  pinnedRight = DEFAULT_OVERSCAN.pinnedRight
}) {
  assertAllowed('dataset', dataset, DATASETS)
  assertAllowed('implementation', implementation, IMPLEMENTATIONS)
  assertAllowed('renderer', renderer, RENDERERS)

  const url = new URL(`${LAB_SCHEME}://${LAB_HOST}`)
  url.searchParams.set('dataset', dataset)
  url.searchParams.set('implementation', implementation)
  url.searchParams.set('renderer', renderer)
  url.searchParams.set('rowOverscan', String(rowOverscan))
  url.searchParams.set('columnOverscan', String(columnOverscan))
  url.searchParams.set('pinnedLeft', String(pinnedLeft))
  url.searchParams.set('pinnedRight', String(pinnedRight))
  return url.toString()
}

export function labReadyNeedle({ dataset, implementation, renderer }) {
  return `lab-ready dataset:${dataset} implementation:${implementation} renderer:${renderer}`
}

export function expandMatrix(spec) {
  const runs = []
  for (const dataset of spec.datasets) {
    for (const renderer of spec.renderers) {
      for (const implementation of spec.implementations) {
        for (const scenario of spec.scenarios) {
          assertAllowed('dataset', dataset, DATASETS)
          assertAllowed('renderer', renderer, RENDERERS)
          assertAllowed('implementation', implementation, IMPLEMENTATIONS)
          assertAllowed('scenario', scenario, AUTOMATED_SCENARIOS)
          for (let repetition = 1; repetition <= spec.repetitions; repetition += 1) {
            runs.push({
              dataset,
              renderer,
              implementation,
              scenario,
              repetition,
              labUrl: buildLabUrl({ dataset, implementation, renderer })
            })
          }
        }
      }
    }
  }
  return runs
}
