import { act } from './modern-test-renderer.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

import './react-native-test-mock.js'
import { horizontalScrollTo, verticalScrollTo } from './test-spies.js'
import {
  basicColumns,
  cellGeometry,
  createGridElement,
  findBodyCellFrame,
  findBodyCellContent,
  findRenderedNodes,
  findHeaderText,
  layoutGrid,
  pinnedColumns,
  renderGrid,
  scrollHorizontal,
  scrollVertical
} from './grid-test-utils.js'
import type { DataGridColumn, DataGridHandle } from '../src/index.js'

/** Wide enough that a 400px viewport keeps a usable center band next to the pinned overlays. */
const widePinnedColumns: readonly DataGridColumn<{ readonly id: number }>[] = [
  { id: 'id', width: 100, pinned: 'left', renderCell: ({ row }) => `id-${row.id}` },
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `c${index}`,
    width: 120,
    renderCell: ({ row }: { row: { readonly id: number } }) => `c${index}-${row.id}`
  })),
  { id: 'actions', width: 80, pinned: 'right' as const, renderCell: () => 'actions' }
]

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

    it('does not scroll an unpinned column that is already fully visible', () => {
      const gridRef = { current: null as DataGridHandle | null }
      const grid = renderGrid({ gridRef, columns: basicColumns })
      layoutGrid(grid, { width: 400, height: 200 })

      act(() => gridRef.current?.scrollToColumn(2))
      expect(horizontalScrollTo).not.toHaveBeenCalled()

      act(() => gridRef.current?.scrollToColumn(0, { animated: false, align: 'start' }))
      expect(horizontalScrollTo).toHaveBeenCalledWith({ x: 0, animated: false })
    })

    it('accounts for multiple pinned columns and deterministically aligns center targets', () => {
      const columns = [
        { id: 'left-a', width: 50, pinned: 'left' as const, renderCell: () => null },
        { id: 'left-b', width: 70, pinned: 'left' as const, renderCell: () => null },
        { id: 'first', width: 100, renderCell: () => null },
        { id: 'target', width: 120, renderCell: () => null },
        { id: 'last', width: 110, renderCell: () => null },
        { id: 'right-a', width: 40, pinned: 'right' as const, renderCell: () => null },
        { id: 'right-b', width: 30, pinned: 'right' as const, renderCell: () => null }
      ]
      const gridRef = { current: null as DataGridHandle | null }
      const grid = renderGrid({ gridRef, columns })
      layoutGrid(grid, { width: 400, height: 200 })

      act(() => gridRef.current?.scrollToColumn('target', { align: 'start' }))
      expect(horizontalScrollTo).toHaveBeenLastCalledWith({ x: 100, animated: true })

      act(() => gridRef.current?.scrollToColumn(3, { align: 'center', animated: false }))
      expect(horizontalScrollTo).toHaveBeenLastCalledWith({ x: 55, animated: false })

      act(() => gridRef.current?.scrollToColumn(3, { align: 'end' }))
      expect(horizontalScrollTo).toHaveBeenLastCalledWith({ x: 10, animated: true })

      act(() => gridRef.current?.scrollToColumn(3))
      expect(horizontalScrollTo).toHaveBeenLastCalledWith({ x: 10, animated: true })
    })

    it('uses auto alignment to reveal a target without moving an already visible center column', () => {
      const gridRef = { current: null as DataGridHandle | null }
      const grid = renderGrid({ gridRef, columns: pinnedColumns })
      layoutGrid(grid, { width: 600, height: 200 })
      horizontalScrollTo.mockClear()

      scrollHorizontal(grid, 100)
      act(() => gridRef.current?.scrollToColumn('revenue'))
      expect(horizontalScrollTo).not.toHaveBeenCalled()

      act(() => gridRef.current?.scrollToColumn('region'))
      expect(horizontalScrollTo).toHaveBeenCalledWith({ x: 0, animated: true })
    })

    it('does not scroll for pinned targets', () => {
      const gridRef = { current: null as DataGridHandle | null }
      const grid = renderGrid({ gridRef, columns: pinnedColumns })
      layoutGrid(grid, { width: 600, height: 200 })
      horizontalScrollTo.mockClear()

      act(() => gridRef.current?.scrollToColumn('id', { align: 'end' }))
      act(() => gridRef.current?.scrollToColumn(5))
      expect(horizontalScrollTo).not.toHaveBeenCalled()
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
    it('reports the non-overscanned visible window separately from the overscanned render window', () => {
      const onVisibleRangeChange = vi.fn()
      const onRenderRangeChange = vi.fn()
      const grid = renderGrid({
        rowOverscan: 2,
        columnOverscan: 1,
        onVisibleRangeChange,
        onRenderRangeChange
      })
      layoutGrid(grid, { width: 200, height: 200 })

      expect(onVisibleRangeChange.mock.lastCall?.[0]).toMatchObject({
        rows: { startIndex: 0, endIndex: 4 },
        columns: { logicalStartIndex: 0, logicalEndIndex: 2 }
      })
      expect(onRenderRangeChange.mock.lastCall?.[0]).toMatchObject({
        rows: { startIndex: 0, endIndex: 6 },
        columns: { logicalStartIndex: 0, logicalEndIndex: 3 }
      })
    })

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
        columns: widePinnedColumns,
        columnOverscan: 0,
        rowOverscan: 0,
        onVisibleRangeChange
      })
      layoutGrid(grid, { width: 400, height: 200 })
      onVisibleRangeChange.mockClear()

      scrollHorizontal(grid, 200)
      expect(onVisibleRangeChange).toHaveBeenCalledTimes(1)
      expect(
        onVisibleRangeChange.mock.lastCall?.[0].columns.items.map((item) => item.index)
      ).toEqual([2, 3, 4])
    })

    it('excludes center columns hidden underneath the pinned overlays from the visible window', () => {
      const onVisibleRangeChange = vi.fn()
      const onRenderRangeChange = vi.fn()
      const grid = renderGrid({
        columns: widePinnedColumns,
        columnOverscan: 0,
        rowOverscan: 0,
        onVisibleRangeChange,
        onRenderRangeChange
      })
      // Viewport 400 wide; the left pin covers 0-100 and the right pin covers 320-400, so only
      // the 220px band between them shows center columns: c0 (100-220) and c1 (220-340).
      layoutGrid(grid, { width: 400, height: 200 })

      expect(
        onVisibleRangeChange.mock.lastCall?.[0].columns.items.map((item) => item.index)
      ).toEqual([1, 2])
      // c2 starts at 340, entirely behind the right pin, but stays mounted for render.
      expect(
        onRenderRangeChange.mock.lastCall?.[0].columns.items.map((item) => item.index)
      ).toEqual([1, 2, 3])
    })

    it('reports no visible center columns when the pinned overlays cover the whole viewport', () => {
      const onVisibleRangeChange = vi.fn()
      // The pinned fixture reserves 412px of overlay, leaving no center band at 400px wide.
      const grid = renderGrid({
        columns: pinnedColumns,
        columnOverscan: 0,
        rowOverscan: 0,
        onVisibleRangeChange
      })
      layoutGrid(grid, { width: 400, height: 200 })

      expect(onVisibleRangeChange.mock.lastCall?.[0].columns.items).toEqual([])
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

    it('keeps the current scroll offsets when a deep grid is resized', () => {
      const onVisibleRangeChange = vi.fn()
      const grid = renderGrid({
        rowCount: 100_000,
        rowOverscan: 0,
        columnOverscan: 0,
        onVisibleRangeChange
      })
      layoutGrid(grid, { width: 400, height: 200 })
      scrollVertical(grid, 48 * 50_000)
      onVisibleRangeChange.mockClear()

      layoutGrid(grid, { width: 320, height: 300 })

      expect(onVisibleRangeChange).toHaveBeenCalledTimes(1)
      expect(onVisibleRangeChange.mock.lastCall?.[0].rows.startIndex).toBe(50_000)
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
      const grid = renderGrid({ rowOverscan: 0, rowCount: 20, onRenderRangeChange: trackRows })
      layoutGrid(grid, { width: 400, height: 140 })
      expect(visibleRows.length).toBeLessThanOrEqual(2)

      act(() => {
        grid.update(
          createGridElement({ rowOverscan: 3, rowCount: 20, onRenderRangeChange: trackRows })
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
        onRenderRangeChange: trackColumns
      })
      layoutGrid(grid, { width: 200, height: 200 })
      const initialCount = centerColumnIds.length

      act(() => {
        grid.update(
          createGridElement({
            columnOverscan: 2,
            rowOverscan: 0,
            onRenderRangeChange: trackColumns
          })
        )
      })

      expect(centerColumnIds.length).toBeGreaterThan(initialCount)
    })

    it('updates mounted row geometry when rowHeight changes without scrolling', () => {
      const gridRef = { current: null as DataGridHandle | null }
      const grid = renderGrid({ gridRef, rowHeight: 48, rowOverscan: 0 })
      layoutGrid(grid, { width: 400, height: 120 })

      act(() => {
        grid.update(createGridElement({ gridRef, rowHeight: 64 }))
      })
      expect(cellGeometry(findBodyCellFrame(grid, 'id-1').props.style)).toMatchObject({
        height: 64
      })
      act(() => gridRef.current?.scrollToRow(2))
      expect(verticalScrollTo).toHaveBeenLastCalledWith({ y: 128, animated: true })
    })

    it('updates visible cell width and offset when a visible column width changes without scrolling', () => {
      const grid = renderGrid({ rowCount: 1, rowOverscan: 0, columnOverscan: 0 })
      layoutGrid(grid, { width: 400, height: 200 })

      const resizedColumns = [
        basicColumns[0]!,
        { ...basicColumns[1]!, width: 180 },
        basicColumns[2]!
      ]
      act(() => {
        grid.update(
          createGridElement({
            rowCount: 1,
            rowOverscan: 0,
            columnOverscan: 0,
            columns: resizedColumns
          })
        )
      })

      expect(cellGeometry(findBodyCellFrame(grid, 'region-0').props.style)).toMatchObject({
        left: 260,
        width: 100
      })
    })

    it('removes a newly pinned column from center cells without scrolling', () => {
      const grid = renderGrid({ rowCount: 1, rowOverscan: 0, columnOverscan: 0 })
      layoutGrid(grid, { width: 400, height: 200 })

      const newlyPinnedColumns = [
        { ...basicColumns[0]!, pinned: 'left' as const },
        { ...basicColumns[1]!, pinned: 'left' as const },
        basicColumns[2]!
      ]
      act(() => {
        grid.update(
          createGridElement({
            rowCount: 1,
            rowOverscan: 0,
            columnOverscan: 0,
            columns: newlyPinnedColumns
          })
        )
      })

      expect(findBodyCellContent(grid, 'name-0')).toHaveLength(0)
      expect(findRenderedNodes(grid, 'grid-pinned-cell-0-name')).toHaveLength(1)
    })

    it('updates visible cell geometry when columns are reordered without scrolling', () => {
      const grid = renderGrid({ rowCount: 1, rowOverscan: 0, columnOverscan: 0 })
      layoutGrid(grid, { width: 150, height: 200 })

      const reorderedColumns = [basicColumns[2]!, basicColumns[0]!, basicColumns[1]!]
      act(() => {
        grid.update(
          createGridElement({
            rowCount: 1,
            rowOverscan: 0,
            columnOverscan: 0,
            columns: reorderedColumns
          })
        )
      })

      expect(cellGeometry(findBodyCellFrame(grid, 'id-0').props.style)).toMatchObject({
        left: 100,
        width: 80
      })
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
