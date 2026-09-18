import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

import './react-native-test-mock.js'
import {
  DataGrid,
  findBodyCellContent,
  layoutGrid,
  pinnedColumns,
  renderGrid,
  RowVirtualizedDataGrid,
  scrollHorizontal
} from './grid-test-utils.js'
import type { DataGridHandle } from '../src/index.js'

afterEach(() => {
  vi.clearAllMocks()
})

describe('RowVirtualizedDataGrid', () => {
  it('mounts every center column for each visible row regardless of horizontal scroll', () => {
    const centerColumnIds: string[] = []
    const grid = renderGrid({
      Grid: RowVirtualizedDataGrid,
      columns: pinnedColumns,
      rowCount: 1,
      rowOverscan: 0,
      columnOverscan: 0,
      onRenderRangeChange: ({ columns }) => {
        centerColumnIds.length = 0
        centerColumnIds.push(...columns.items.map((item) => pinnedColumns[item.index]!.id))
      }
    })
    layoutGrid(grid, { width: 400, height: 200 })
    expect(centerColumnIds.sort()).toEqual(['region', 'revenue'])

    scrollHorizontal(grid, 420)
    expect(centerColumnIds.sort()).toEqual(['region', 'revenue'])
    expect(findBodyCellContent(grid, 'region-0')).toHaveLength(1)
    expect(findBodyCellContent(grid, 'revenue-0')).toHaveLength(1)
  })

  it('does not unmount center cells on horizontal scroll unlike the fully virtualized grid', () => {
    const gridRef = { current: null as DataGridHandle | null }
    const grid = renderGrid({
      Grid: RowVirtualizedDataGrid,
      columns: pinnedColumns,
      rowOverscan: 0,
      columnOverscan: 0,
      enableProfiling: true,
      gridRef
    })
    layoutGrid(grid, { width: 400, height: 200 })

    gridRef.current?.resetProfiling()
    scrollHorizontal(grid, 420)

    const snapshot = gridRef.current!.getProfilingSnapshot()
    expect(snapshot.cellUnmounts).toBe(0)
    expect(snapshot.rangeChanges).toBe(0)
  })

  it('still unmounts center cells on horizontal scroll for the fully virtualized DataGrid baseline', () => {
    const gridRef = { current: null as DataGridHandle | null }
    const grid = renderGrid({
      Grid: DataGrid,
      columns: pinnedColumns,
      rowOverscan: 0,
      columnOverscan: 0,
      enableProfiling: true,
      gridRef
    })
    layoutGrid(grid, { width: 400, height: 200 })

    gridRef.current?.resetProfiling()
    scrollHorizontal(grid, 420)

    const snapshot = gridRef.current!.getProfilingSnapshot()
    expect(snapshot.cellUnmounts).toBeGreaterThan(0)
    expect(snapshot.rangeChanges).toBe(1)
  })
})
