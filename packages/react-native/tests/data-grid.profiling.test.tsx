import { act } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

import './react-native-test-mock.js'
import {
  findRenderedNode,
  layoutGrid,
  pinnedColumns,
  renderGrid,
  scrollHorizontal,
  scrollVertical
} from './grid-test-utils.js'
import type { DataGridHandle } from '../src/index.js'

afterEach(() => {
  vi.clearAllMocks()
})

describe('DataGrid profiling', () => {
  it('keeps counters at zero when enableProfiling is false', () => {
    const gridRef = { current: null as DataGridHandle | null }
    const grid = renderGrid({ gridRef, enableProfiling: false })
    layoutGrid(grid, { width: 400, height: 200 })
    scrollVertical(grid, 48)
    scrollHorizontal(grid, 120)

    expect(gridRef.current?.getProfilingSnapshot()).toEqual({
      commits: 0,
      commitDurationMs: 0,
      rowRenders: 0,
      rowMounts: 0,
      rowUnmounts: 0,
      cellRenders: 0,
      cellMounts: 0,
      cellUnmounts: 0,
      scrollEvents: 0,
      scrollEventsWithoutRangeChange: 0,
      rangeChanges: 0
    })
  })

  it('records scroll events when enableProfiling is true', () => {
    const gridRef = { current: null as DataGridHandle | null }
    const grid = renderGrid({ gridRef, enableProfiling: true })
    layoutGrid(grid, { width: 400, height: 200 })
    act(() => gridRef.current?.resetProfiling())

    scrollVertical(grid, 24)
    scrollHorizontal(grid, 80)

    expect(gridRef.current?.getProfilingSnapshot().scrollEvents).toBe(2)
  })

  it('resetProfiling zeroes counters without unmounting pinned cells', () => {
    const gridRef = { current: null as DataGridHandle | null }
    const grid = renderGrid({
      columns: pinnedColumns,
      gridRef,
      enableProfiling: true,
      rowOverscan: 0
    })
    layoutGrid(grid, { width: 400, height: 200 })
    scrollHorizontal(grid, 120)

    const pinnedCell = findRenderedNode(grid, 'grid-pinned-cell-0-id')
    act(() => gridRef.current?.resetProfiling())

    expect(gridRef.current?.getProfilingSnapshot().scrollEvents).toBe(0)
    expect(findRenderedNode(grid, 'grid-pinned-cell-0-id')).toBe(pinnedCell)
  })

  it('returns a shallow copy from getProfilingSnapshot', () => {
    const gridRef = { current: null as DataGridHandle | null }
    const grid = renderGrid({ gridRef, enableProfiling: true })
    layoutGrid(grid, { width: 400, height: 200 })
    scrollVertical(grid, 48)

    const snapshot = gridRef.current!.getProfilingSnapshot()
    snapshot.scrollEvents = 999

    expect(gridRef.current!.getProfilingSnapshot().scrollEvents).not.toBe(999)
  })

  it('does not leak duplicate mounts after a fast scroll sequence', () => {
    const gridRef = { current: null as DataGridHandle | null }
    const grid = renderGrid({
      columns: pinnedColumns,
      gridRef,
      enableProfiling: true,
      rowOverscan: 0,
      columnOverscan: 0
    })
    layoutGrid(grid, { width: 400, height: 200 })

    act(() => gridRef.current?.resetProfiling())
    for (const scrollX of [0, 40, 120, 80, 260, 200, 360, 300]) scrollHorizontal(grid, scrollX)
    for (const scrollY of [0, 24, 96, 48, 192, 144]) scrollVertical(grid, scrollY)

    const snapshot = gridRef.current!.getProfilingSnapshot()
    const visibleRows = 3
    const pinnedPerRow = 4
    const maxCellMounts = visibleRows * (2 + pinnedPerRow) * 4

    expect(snapshot.cellMounts).toBeLessThanOrEqual(maxCellMounts)
    expect(snapshot.cellUnmounts).toBeLessThanOrEqual(maxCellMounts)

    const pinnedCellCounts = new Map<string, number>()
    for (const node of grid.root.findAll(
      (candidate) =>
        candidate.type === 'AnimatedView' &&
        typeof candidate.props.testID === 'string' &&
        candidate.props.testID.startsWith('grid-pinned-cell-')
    )) {
      const testID = node.props.testID as string
      pinnedCellCounts.set(testID, (pinnedCellCounts.get(testID) ?? 0) + 1)
    }
    expect(pinnedCellCounts.size).toBeGreaterThan(0)
    for (const count of pinnedCellCounts.values()) expect(count).toBe(1)
  })
})
