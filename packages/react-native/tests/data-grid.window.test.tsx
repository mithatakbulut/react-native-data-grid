import { act } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

import './react-native-test-mock.js'
import { horizontalScrollTo, verticalScrollTo } from './test-spies.js'
import {
  basicColumns,
  createGridElement,
  findBodyCellContent,
  findHeaderText,
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

describe('DataGrid window behaviour', () => {
  describe('imperative scroll API', () => {
    it('scrollToRow delegates to the vertical scroller with the layout row offset', () => {
      const gridRef = { current: null as DataGridHandle | null }
      const grid = renderGrid({ gridRef, rowHeight: 48 })
      layoutGrid(grid, { width: 400, height: 200 })

      act(() => gridRef.current?.scrollToRow(3))
      expect(verticalScrollTo).toHaveBeenCalledWith({ y: 144, animated: true })

      act(() => gridRef.current?.scrollToRow(0, false))
      expect(verticalScrollTo).toHaveBeenCalledWith({ y: 0, animated: false })
    })

    it('scrollToColumn delegates to the horizontal scroller with the layout column offset', () => {
      const gridRef = { current: null as DataGridHandle | null }
      const grid = renderGrid({ gridRef, columns: basicColumns })
      layoutGrid(grid, { width: 400, height: 200 })

      act(() => gridRef.current?.scrollToColumn(2))
      expect(horizontalScrollTo).toHaveBeenCalledWith({ x: 200, animated: true })

      act(() => gridRef.current?.scrollToColumn(0, false))
      expect(horizontalScrollTo).toHaveBeenCalledWith({ x: 0, animated: false })
    })

    it('includes the target row in the visible window after the corresponding vertical scroll event', () => {
      const visibleRows: number[] = []
      const grid = renderGrid({
        rowOverscan: 0,
        onVisibleRangeChange: ({ rows }) => {
          visibleRows.length = 0
          for (let index = rows.startIndex; index < rows.endIndex; index += 1)
            visibleRows.push(index)
        }
      })
      layoutGrid(grid, { width: 400, height: 200 })
      scrollVertical(grid, 48 * 5)
      expect(visibleRows).toContain(5)
    })
  })

  describe('visible range callbacks', () => {
    it('fires onVisibleRangeChange once after the initial layout', () => {
      const onVisibleRangeChange = vi.fn()
      const grid = renderGrid({ onVisibleRangeChange, columnOverscan: 0, rowOverscan: 0 })
      layoutGrid(grid, { width: 400, height: 200 })

      expect(onVisibleRangeChange).toHaveBeenCalledTimes(1)
      expect(onVisibleRangeChange.mock.lastCall?.[0].rows.startIndex).toBe(0)
      expect(
        onVisibleRangeChange.mock.lastCall?.[0].columns.items.map((item) => item.index)
      ).toEqual([0, 1, 2])
    })

    it('fires onVisibleRangeChange when horizontal scroll changes the column window', () => {
      const onVisibleRangeChange = vi.fn()
      const grid = renderGrid({
        columns: pinnedColumns,
        columnOverscan: 0,
        rowOverscan: 0,
        onVisibleRangeChange
      })
      layoutGrid(grid, { width: 400, height: 200 })
      onVisibleRangeChange.mockClear()

      scrollHorizontal(grid, 420)
      expect(onVisibleRangeChange).toHaveBeenCalledTimes(1)
      expect(
        onVisibleRangeChange.mock.lastCall?.[0].columns.items.map((item) => item.index)
      ).toEqual([3])
    })

    it('fires onVisibleRangeChange when vertical scroll changes the row window', () => {
      const onVisibleRangeChange = vi.fn()
      const grid = renderGrid({ rowOverscan: 0, columnOverscan: 0, onVisibleRangeChange })
      layoutGrid(grid, { width: 400, height: 140 })
      onVisibleRangeChange.mockClear()

      scrollVertical(grid, 96)
      expect(onVisibleRangeChange).toHaveBeenCalledTimes(1)
      expect(onVisibleRangeChange.mock.lastCall?.[0].rows.startIndex).toBe(2)
    })

    it('does not fire onVisibleRangeChange when scroll stays inside the same range', () => {
      const gridRef = { current: null as DataGridHandle | null }
      const onVisibleRangeChange = vi.fn()
      const grid = renderGrid({
        gridRef,
        enableProfiling: true,
        rowOverscan: 3,
        columnOverscan: 1,
        onVisibleRangeChange
      })
      layoutGrid(grid, { width: 400, height: 200 })
      onVisibleRangeChange.mockClear()
      act(() => gridRef.current?.resetProfiling())

      scrollVertical(grid, 4)
      scrollVertical(grid, 8)
      expect(onVisibleRangeChange).not.toHaveBeenCalled()
      expect(gridRef.current?.getProfilingSnapshot().scrollEvents).toBe(2)
      expect(gridRef.current?.getProfilingSnapshot().scrollEventsWithoutRangeChange).toBe(2)
    })

    it('subtracts headerHeight from the body viewport when calculating visible rows', () => {
      const visibleRows: number[] = []
      const grid = renderGrid({
        headerHeight: 44,
        rowHeight: 48,
        rowOverscan: 0,
        rowCount: 20,
        onVisibleRangeChange: ({ rows }) => {
          visibleRows.length = 0
          for (let index = rows.startIndex; index < rows.endIndex; index += 1)
            visibleRows.push(index)
        }
      })
      layoutGrid(grid, { width: 400, height: 140 })

      expect(visibleRows).toEqual([0, 1])
    })
  })

  describe('prop and configuration changes', () => {
    it('recalculates the mounted window when rowOverscan changes', () => {
      const visibleRows: number[] = []
      const trackRows = ({ rows }: { rows: { startIndex: number; endIndex: number } }) => {
        visibleRows.length = 0
        for (let index = rows.startIndex; index < rows.endIndex; index += 1) visibleRows.push(index)
      }
      const grid = renderGrid({ rowOverscan: 0, rowCount: 20, onVisibleRangeChange: trackRows })
      layoutGrid(grid, { width: 400, height: 140 })
      expect(visibleRows.length).toBeLessThanOrEqual(2)

      act(() => {
        grid.update(
          createGridElement({ rowOverscan: 3, rowCount: 20, onVisibleRangeChange: trackRows })
        )
      })
      expect(visibleRows.length).toBeGreaterThan(2)
    })

    it('tolerates shrinking the columns prop before the window recalculates', () => {
      const grid = renderGrid({ columns: basicColumns, rowCount: 1, rowOverscan: 0 })
      layoutGrid(grid, { width: 400, height: 200 })

      act(() => {
        grid.update(
          createGridElement({
            rowCount: 1,
            rowOverscan: 0,
            columns: [
              {
                id: 'only',
                width: 120,
                renderCell: ({ row }: { row: { id: number } }) => `only-${row.id}`
              }
            ]
          })
        )
      })
      layoutGrid(grid, { width: 400, height: 200 })
      expect(findBodyCellContent(grid, 'only-0')).toHaveLength(1)
    })

    it('recalculates layout when columns are replaced', () => {
      const onVisibleRangeChange = vi.fn()
      const grid = renderGrid({
        columns: basicColumns,
        rowCount: 1,
        rowOverscan: 0,
        onVisibleRangeChange
      })
      layoutGrid(grid, { width: 400, height: 200 })
      expect(findBodyCellContent(grid, 'id-0')).toHaveLength(1)

      const replacement = [
        {
          id: 'sku',
          width: 80,
          renderCell: ({ row }: { row: { id: number } }) => `sku-${row.id}`
        },
        {
          id: 'qty',
          width: 120,
          renderCell: ({ row }: { row: { id: number } }) => `qty-${row.id}`
        },
        {
          id: 'bin',
          width: 100,
          renderCell: ({ row }: { row: { id: number } }) => `bin-${row.id}`
        }
      ]
      act(() => {
        grid.update(
          createGridElement({
            columns: replacement,
            rowCount: 1,
            rowOverscan: 0,
            onVisibleRangeChange
          })
        )
      })
      layoutGrid(grid, { width: 400, height: 200 })

      expect(findBodyCellContent(grid, 'id-0')).toHaveLength(0)
      expect(findBodyCellContent(grid, 'sku-0')).toHaveLength(1)
    })

    it('extends scrollable content when rowCount increases while keeping visible cells mounted', () => {
      const grid = renderGrid({ rowCount: 5, rowOverscan: 0, columnOverscan: 0 })
      layoutGrid(grid, { width: 400, height: 200 })
      const firstCell = findBodyCellContent(grid, 'id-0')[0]

      act(() => {
        grid.update(createGridElement({ rowCount: 20, rowOverscan: 0, columnOverscan: 0 }))
      })

      const verticalScroll = grid.root.find((node) => node.props.testID === 'grid-vertical-scroll')
      expect(verticalScroll?.props.contentContainerStyle.height).toBe(20 * 48)
      expect(findBodyCellContent(grid, 'id-0')[0]).toBe(firstCell)
    })

    it('recalculates the mounted column window when columnOverscan changes', () => {
      const centerColumnIds: string[] = []
      const trackColumns = ({ columns }: { columns: { items: readonly { index: number }[] } }) => {
        centerColumnIds.length = 0
        centerColumnIds.push(...columns.items.map((item) => basicColumns[item.index]!.id))
      }
      const grid = renderGrid({
        columnOverscan: 0,
        rowOverscan: 0,
        onVisibleRangeChange: trackColumns
      })
      layoutGrid(grid, { width: 200, height: 200 })
      const initialCount = centerColumnIds.length

      act(() => {
        grid.update(
          createGridElement({
            columnOverscan: 2,
            rowOverscan: 0,
            onVisibleRangeChange: trackColumns
          })
        )
      })

      expect(centerColumnIds.length).toBeGreaterThan(initialCount)
    })

    it('recalculates row offsets when rowHeight changes', () => {
      const gridRef = { current: null as DataGridHandle | null }
      const grid = renderGrid({ gridRef, rowHeight: 48 })
      layoutGrid(grid, { width: 400, height: 200 })

      act(() => {
        grid.update(createGridElement({ gridRef, rowHeight: 64 }))
      })
      act(() => gridRef.current?.scrollToRow(2))
      expect(verticalScrollTo).toHaveBeenLastCalledWith({ y: 128, animated: true })
    })
  })

  describe('empty and minimal grids', () => {
    it('renders headers but no body rows when rowCount is zero', () => {
      const grid = renderGrid({ rowCount: 0, columns: basicColumns })
      layoutGrid(grid, { width: 400, height: 200 })

      expect(findBodyCellContent(grid, 'id-0')).toHaveLength(0)
      expect(findHeaderText(grid, 'id').length).toBeGreaterThan(0)
    })

    it('renders a single center cell for a one-row one-column grid', () => {
      const columns = [
        {
          id: 'only',
          width: 120,
          renderCell: ({ row }: { row: { id: number } }) => `only-${row.id}`
        }
      ]
      const grid = renderGrid({ rowCount: 1, columns, rowOverscan: 0, columnOverscan: 0 })
      layoutGrid(grid, { width: 400, height: 200 })

      expect(findBodyCellContent(grid, 'only-0')).toHaveLength(1)
    })

    it('mounts no body cells before layout and populates the window on first layout', () => {
      const grid = renderGrid({ rowCount: 1, rowOverscan: 0, columnOverscan: 0 })
      expect(findBodyCellContent(grid, 'id-0')).toHaveLength(0)

      layoutGrid(grid, { width: 400, height: 200 })
      expect(findBodyCellContent(grid, 'id-0')).toHaveLength(1)
    })
  })
})
