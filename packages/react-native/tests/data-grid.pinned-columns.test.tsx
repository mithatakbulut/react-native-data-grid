import { act } from './modern-test-renderer.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

import './react-native-test-mock.js'
import {
  findRenderedNode,
  findRenderedNodes,
  layoutGrid,
  renderGrid,
  scrollHorizontal,
  scrollVertical,
  absoluteLeft,
  translateX,
  visualLeft,
  visualRight
} from './grid-test-utils.js'
import type { DataGridColumn, DataGridHandle } from '../src/index.js'

type Row = { readonly id: number }

const singlePinnedColumns: readonly DataGridColumn<Row>[] = [
  {
    id: 'id',
    width: 80,
    pinned: 'left',
    renderCell: ({ row }) => `row-${row.id}`
  },
  {
    id: 'name',
    width: 120,
    renderCell: ({ row }) => `name-${row.id}`
  },
  {
    id: 'revenue',
    width: 100,
    renderCell: ({ row }) => `revenue-${row.id}`
  },
  {
    id: 'actions',
    width: 70,
    pinned: 'right',
    renderCell: ({ row }) => `actions-${row.id}`
  }
]

const multiPinnedColumns: readonly DataGridColumn<Row>[] = [
  { id: 'id', width: 80, pinned: 'left', renderCell: ({ row }) => `id-${row.id}` },
  { id: 'name', width: 160, pinned: 'left', renderCell: ({ row }) => `name-${row.id}` },
  { id: 'region', width: 120, renderCell: ({ row }) => `region-${row.id}` },
  { id: 'revenue', width: 140, renderCell: ({ row }) => `revenue-${row.id}` },
  { id: 'status', width: 100, pinned: 'right', renderCell: ({ row }) => `status-${row.id}` },
  { id: 'actions', width: 72, pinned: 'right', renderCell: ({ row }) => `actions-${row.id}` }
]

afterEach(() => {
  vi.clearAllMocks()
})

describe('DataGrid pinned columns', () => {
  it('counter-translates a right pinned header from the one authoritative horizontal scroll value', () => {
    const grid = renderGrid({ columns: singlePinnedColumns })
    layoutGrid(grid, { width: 400, height: 200 })

    const rightHeader = findRenderedNode(grid, 'grid-pinned-header-actions')
    expect(translateX(rightHeader.props.style)).toBe(30)

    scrollHorizontal(grid, 120)
    expect(translateX(rightHeader.props.style)).toBe(150)
    expect(300 - 120 + translateX(rightHeader.props.style)).toBe(330)
  })

  it('mounts each pinned column once per rendered row and keeps it in the vertical row window', () => {
    const grid = renderGrid({ columns: singlePinnedColumns, rowOverscan: 0 })
    layoutGrid(grid, { width: 400, height: 140 })

    expect(findRenderedNodes(grid, 'grid-pinned-cell-0-id')).toHaveLength(1)
    expect(findRenderedNodes(grid, 'grid-pinned-cell-0-actions')).toHaveLength(1)
    expect(findRenderedNodes(grid, 'grid-pinned-cell-2-id')).toHaveLength(0)

    scrollVertical(grid, 96)
    expect(findRenderedNodes(grid, 'grid-pinned-cell-0-id')).toHaveLength(0)
    expect(findRenderedNodes(grid, 'grid-pinned-cell-2-id')).toHaveLength(1)
    expect(findRenderedNodes(grid, 'grid-pinned-cell-3-id')).toHaveLength(1)
  })

  it('keeps multiple left pinned columns in declared left-to-right order after horizontal scroll', () => {
    const grid = renderGrid({ columns: multiPinnedColumns })
    layoutGrid(grid, { width: 400, height: 200 })

    const assertLeftPinnedOrder = (scrollX: number) => {
      scrollHorizontal(grid, scrollX)
      const headers = ['id', 'name'].map((id) => findRenderedNode(grid, `grid-pinned-header-${id}`))
      const visualLefts = headers.map((header) => visualLeft(header, scrollX))
      expect(visualLefts).toEqual([0, 80])
      expect(visualLefts[0]!).toBeLessThan(visualLefts[1]!)
    }

    assertLeftPinnedOrder(0)
    assertLeftPinnedOrder(160)
    assertLeftPinnedOrder(420)
  })

  it('keeps multiple right pinned columns at their declared right-to-left edge offsets after horizontal scroll', () => {
    const grid = renderGrid({ columns: multiPinnedColumns })
    const viewportWidth = 400
    layoutGrid(grid, { width: viewportWidth, height: 200 })

    const assertRightPinnedEdges = (scrollX: number) => {
      scrollHorizontal(grid, scrollX)
      const status = findRenderedNode(grid, 'grid-pinned-header-status')
      const actions = findRenderedNode(grid, 'grid-pinned-header-actions')
      expect(visualRight(status, scrollX, 100)).toBe(viewportWidth - 72)
      expect(visualRight(actions, scrollX, 72)).toBe(viewportWidth)
    }

    assertRightPinnedEdges(0)
    assertRightPinnedEdges(180)
    assertRightPinnedEdges(520)
  })

  it('replaces only center cells on a horizontal range change while pinned cells for unchanged rows stay mounted', () => {
    const gridRef = { current: null as DataGridHandle | null }
    const centerColumnIds: string[] = []
    const grid = renderGrid({
      columns: multiPinnedColumns,
      rowOverscan: 1,
      columnOverscan: 0,
      enableProfiling: true,
      gridRef,
      onRenderRangeChange: ({ columns }) => {
        centerColumnIds.length = 0
        centerColumnIds.push(...columns.items.map((item) => multiPinnedColumns[item.index]!.id))
      }
    })
    layoutGrid(grid, { width: 400, height: 200 })
    expect(centerColumnIds).toEqual(['region', 'revenue'])

    const pinnedCell = findRenderedNode(grid, 'grid-pinned-cell-0-id')

    act(() => gridRef.current?.resetProfiling())
    scrollHorizontal(grid, 420)
    expect(centerColumnIds).toEqual(['revenue'])

    expect(findRenderedNode(grid, 'grid-pinned-cell-0-id')).toBe(pinnedCell)
    const snapshot = gridRef.current!.getProfilingSnapshot()
    expect(snapshot.rangeChanges).toBe(1)
    expect(snapshot.cellUnmounts).toBeGreaterThan(0)
    expect(snapshot.rowMounts).toBe(0)
    expect(snapshot.rowUnmounts).toBe(0)
  })

  it('leaves exactly one instance of each pinned column per visible row after a fast horizontal update sequence', () => {
    const grid = renderGrid({ columns: multiPinnedColumns, rowOverscan: 0 })
    layoutGrid(grid, { width: 400, height: 200 })

    for (const scrollX of [0, 40, 120, 80, 260, 200, 360, 300]) scrollHorizontal(grid, scrollX)

    for (const rowIndex of [0, 1, 2]) {
      for (const columnId of ['id', 'name', 'status', 'actions']) {
        expect(findRenderedNodes(grid, `grid-pinned-cell-${rowIndex}-${columnId}`)).toHaveLength(1)
      }
    }
  })

  it('mounts and unmounts rows, including pinned cells, after a fast vertical update sequence', () => {
    const grid = renderGrid({ columns: multiPinnedColumns, rowOverscan: 0 })
    layoutGrid(grid, { width: 400, height: 140 })

    for (const scrollY of [0, 24, 96, 48, 192, 144, 240]) scrollVertical(grid, scrollY)

    expect(findRenderedNodes(grid, 'grid-pinned-cell-0-id')).toHaveLength(0)
    expect(findRenderedNodes(grid, 'grid-pinned-cell-5-id')).toHaveLength(1)
    expect(findRenderedNodes(grid, 'grid-pinned-cell-6-actions')).toHaveLength(1)
    for (const rowIndex of [5, 6]) {
      for (const columnId of ['id', 'name', 'status', 'actions']) {
        expect(findRenderedNodes(grid, `grid-pinned-cell-${rowIndex}-${columnId}`)).toHaveLength(1)
      }
    }
  })

  it('renders each pinned column once when the viewport is narrower than the combined pinned widths', () => {
    const centerColumnIds: string[] = []
    const grid = renderGrid({
      columns: multiPinnedColumns,
      rowOverscan: 0,
      columnOverscan: 0,
      onRenderRangeChange: ({ columns }) => {
        centerColumnIds.length = 0
        centerColumnIds.push(...columns.items.map((item) => multiPinnedColumns[item.index]!.id))
      }
    })
    layoutGrid(grid, { width: 300, height: 200 })

    expect(centerColumnIds).toEqual(['region'])
    for (const rowIndex of [0, 1, 2]) {
      for (const columnId of ['id', 'name', 'status', 'actions']) {
        expect(findRenderedNodes(grid, `grid-pinned-cell-${rowIndex}-${columnId}`)).toHaveLength(1)
      }
    }
    expect(findRenderedNodes(grid, 'grid-pinned-header-id')).toHaveLength(1)
    expect(findRenderedNodes(grid, 'grid-pinned-header-name')).toHaveLength(1)
    expect(findRenderedNodes(grid, 'grid-pinned-header-status')).toHaveLength(1)
    expect(findRenderedNodes(grid, 'grid-pinned-header-actions')).toHaveLength(1)
  })

  it('recalculates right-pinned compensation on viewport resize without changing logical column offsets', () => {
    const grid = renderGrid({ columns: multiPinnedColumns })
    layoutGrid(grid, { width: 400, height: 200 })
    scrollHorizontal(grid, 100)

    const actionsHeader = findRenderedNode(grid, 'grid-pinned-header-actions')
    const logicalLeftBefore = absoluteLeft(actionsHeader.props.style)
    const translateBefore = translateX(actionsHeader.props.style)

    layoutGrid(grid, { width: 320, height: 200 })

    const actionsAfterResize = findRenderedNode(grid, 'grid-pinned-header-actions')
    expect(absoluteLeft(actionsAfterResize.props.style)).toBe(logicalLeftBefore)
    expect(translateX(actionsAfterResize.props.style)).not.toBe(translateBefore)
    expect(visualRight(actionsAfterResize, 100, 72)).toBe(320)
  })
})
