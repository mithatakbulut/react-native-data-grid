import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

import './react-native-test-mock.js'
import { Image, Text, View } from 'react-native'
import {
  findBodyCellContent,
  findBodyCellFrame,
  findHeaderText,
  findRenderedNode,
  layoutGrid,
  renderGrid,
  scrollVertical
} from './grid-test-utils.js'
import type { DataGridColumn } from '../src/index.js'

const mountCounts = new Map<string, number>()
const unmountCounts = new Map<string, number>()

function trackLifecycle(key: string) {
  mountCounts.set(key, (mountCounts.get(key) ?? 0) + 1)
  return () => {
    unmountCounts.set(key, (unmountCounts.get(key) ?? 0) + 1)
  }
}

function LifecycleCell({ label }: { readonly label: string }) {
  useEffect(() => trackLifecycle(label), [label])
  return label
}

afterEach(() => {
  vi.clearAllMocks()
  mountCounts.clear()
  unmountCounts.clear()
})

describe('DataGrid custom cell rendering', () => {
  it('renders plain strings and nested views in center cells', () => {
    const columns: readonly DataGridColumn<{ id: number }>[] = [
      {
        id: 'text',
        width: 100,
        renderCell: ({ row }) => `plain-${row.id}`
      },
      {
        id: 'nested',
        width: 140,
        renderCell: ({ row }) => (
          <View>
            <Text>{`nested-${row.id}`}</Text>
          </View>
        )
      }
    ]
    const grid = renderGrid({ columns, rowCount: 1, rowOverscan: 0, columnOverscan: 0 })
    layoutGrid(grid, { width: 400, height: 200 })

    expect(findBodyCellContent(grid, 'plain-0')).toHaveLength(1)
    expect(findBodyCellContent(grid, 'nested-0')).toHaveLength(1)
  })

  it('renders mocked Image nodes with expected props', () => {
    const columns: readonly DataGridColumn<{ id: number }>[] = [
      {
        id: 'avatar',
        width: 80,
        renderCell: ({ row }) => (
          <View>
            <Image
              source={{ uri: `https://example.com/${row.id}.png` }}
              style={{ width: 24, height: 24 }}
            />
            <Text>{`img-${row.id}`}</Text>
          </View>
        )
      }
    ]
    const grid = renderGrid({ columns, rowCount: 1, rowOverscan: 0, columnOverscan: 0 })
    layoutGrid(grid, { width: 400, height: 200 })

    const image = grid.root.find(
      (node) => node.type === 'Image' && node.props.source?.uri === 'https://example.com/0.png'
    )
    expect(image).toBeDefined()
    expect(findBodyCellContent(grid, 'img-0')).toHaveLength(1)
  })

  it('calls getRow only for rows in the current render window', () => {
    const requestedRows = new Set<number>()
    const grid = renderGrid({
      rowCount: 20,
      rowHeight: 48,
      headerHeight: 44,
      rowOverscan: 0,
      columnOverscan: 0,
      columns: [{ id: 'a', width: 80, renderCell: ({ row }) => `a-${row.id}` }],
      getRow: (rowIndex) => {
        requestedRows.add(rowIndex)
        return { id: rowIndex }
      }
    })
    layoutGrid(grid, { width: 400, height: 140 })

    expect(requestedRows.has(0)).toBe(true)
    expect(requestedRows.has(19)).toBe(false)
    expect([...requestedRows].every((index) => index >= 0 && index <= 3)).toBe(true)
  })

  it('resolves each rendered row once across center and pinned cells', () => {
    const getRow = vi.fn((rowIndex: number) => ({ id: rowIndex }))
    const columns: readonly DataGridColumn<{ id: number }>[] = [
      {
        id: 'left',
        width: 80,
        pinned: 'left',
        renderCell: ({ row }) => `left-${row.id}`
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `center-${index}`,
        width: 80,
        renderCell: ({ row }: { readonly row: { readonly id: number } }) => `center-${row.id}`
      })),
      {
        id: 'right',
        width: 80,
        pinned: 'right',
        renderCell: ({ row }) => `right-${row.id}`
      }
    ]
    const grid = renderGrid({
      rowCount: 20,
      rowOverscan: 0,
      columnOverscan: 0,
      columns,
      getRow
    })

    layoutGrid(grid, { width: 1_200, height: 1_004 })

    expect(getRow).toHaveBeenCalledTimes(20)
    expect(getRow.mock.calls.map(([rowIndex]) => rowIndex)).toEqual(
      Array.from({ length: 20 }, (_, index) => index)
    )
  })

  it('calls getRow again and remounts cells when a row scrolls back into view', () => {
    const getRowCalls: number[] = []
    const columns: readonly DataGridColumn<{ id: number }>[] = [
      {
        id: 'tracked',
        width: 120,
        renderCell: ({ row }) => <LifecycleCell label={`cell-${row.id}`} />
      }
    ]
    const grid = renderGrid({
      columns,
      rowOverscan: 0,
      columnOverscan: 0,
      getRow: (rowIndex) => {
        getRowCalls.push(rowIndex)
        return { id: rowIndex }
      }
    })
    layoutGrid(grid, { width: 400, height: 140 })
    getRowCalls.length = 0
    mountCounts.clear()
    unmountCounts.clear()

    scrollVertical(grid, 96)
    scrollVertical(grid, 0)

    expect(getRowCalls).toContain(0)
    expect(mountCounts.get('cell-0')).toBe(1)
    expect(unmountCounts.get('cell-0')).toBe(1)
  })

  it('unmounts cell content when a row leaves the vertical window', () => {
    const columns: readonly DataGridColumn<{ id: number }>[] = [
      {
        id: 'tracked',
        width: 120,
        renderCell: ({ row }) => <LifecycleCell label={`cell-${row.id}`} />
      }
    ]
    const grid = renderGrid({ columns, rowOverscan: 0, columnOverscan: 0 })
    layoutGrid(grid, { width: 400, height: 140 })
    expect(mountCounts.get('cell-0')).toBe(1)

    scrollVertical(grid, 96)
    expect(unmountCounts.get('cell-0')).toBe(1)
    expect(mountCounts.get('cell-2')).toBe(1)
  })

  it('renders string headers, function headers, and custom header nodes', () => {
    const columns: readonly DataGridColumn<{ id: number }>[] = [
      { id: 'a', width: 80, header: 'Alpha', renderCell: ({ row }) => `${row.id}` },
      {
        id: 'b',
        width: 80,
        header: (column) => `Fn-${column.id}`,
        renderCell: ({ row }) => `${row.id}`
      },
      {
        id: 'c',
        width: 80,
        header: <Text>custom-header</Text>,
        renderCell: ({ row }) => `${row.id}`
      }
    ]
    const grid = renderGrid({ columns, rowCount: 1, rowOverscan: 0, columnOverscan: 0 })
    layoutGrid(grid, { width: 400, height: 200 })

    expect(findHeaderText(grid, 'Alpha')).toHaveLength(1)
    expect(findHeaderText(grid, 'Fn-b')).toHaveLength(1)
    expect(findHeaderText(grid, 'custom-header')).toHaveLength(1)
  })

  it('applies static theme styles and contextual body row and cell styles', () => {
    const theme = {
      root: { backgroundColor: 'theme-root' },
      header: { backgroundColor: 'theme-header' },
      headerCell: { backgroundColor: 'theme-header-cell' },
      cell: { borderColor: 'theme-cell' },
      pinnedCell: { borderRightWidth: 3 },
      headerText: { color: 'theme-header-text' }
    }
    const getRowStyle = vi.fn(() => ({ backgroundColor: 'row-status' }))
    const getCellStyle = vi.fn(({ columnIndex }: { readonly columnIndex: number }) => ({
      opacity: columnIndex + 1
    }))
    const columns: readonly DataGridColumn<{ id: number }>[] = [
      {
        id: 'left',
        width: 80,
        pinned: 'left',
        header: 'Left',
        renderCell: ({ row }) => `left-${row.id}`
      },
      {
        id: 'center',
        width: 120,
        header: 'Center',
        renderCell: ({ row }) => `center-${row.id}`
      }
    ]
    const grid = renderGrid({
      rowCount: 1,
      rowOverscan: 0,
      columnOverscan: 0,
      columns,
      theme,
      getRowStyle,
      getCellStyle
    })
    layoutGrid(grid, { width: 400, height: 200 })

    const root = grid.root.find((node) => node.type === 'View' && node.props.testID === 'grid')
    const centerFrame = findBodyCellFrame(grid, 'center-0')
    const row = grid.root.find(
      (node) =>
        node.type === 'View' &&
        Array.isArray(node.props.style) &&
        node.props.style.some(
          (style) =>
            typeof style === 'object' &&
            style !== null &&
            'backgroundColor' in style &&
            style.backgroundColor === 'row-status'
        )
    )
    const pinnedFrame = findRenderedNode(grid, 'grid-pinned-cell-0-left')
    const centerHeaderFrame = grid.root.find(
      (node) =>
        node.type === 'View' &&
        Array.isArray(node.props.style) &&
        node.props.style.some(
          (style) =>
            typeof style === 'object' &&
            style !== null &&
            'backgroundColor' in style &&
            style.backgroundColor === 'theme-header-cell'
        )
    )
    const header = grid.root.find(
      (node) =>
        node.type === 'View' &&
        Array.isArray(node.props.style) &&
        node.props.style.some(
          (style) =>
            typeof style === 'object' &&
            style !== null &&
            'backgroundColor' in style &&
            style.backgroundColor === 'theme-header'
        )
    )
    const headerText = findHeaderText(grid, 'Center')[0]!

    expect(root.props.style).toContainEqual(theme.root)
    expect(row.props.style).toContainEqual({ backgroundColor: 'row-status' })
    expect(centerFrame.props.style).toContainEqual(theme.cell)
    expect(centerFrame.props.style).toContainEqual({ opacity: 2 })
    expect(pinnedFrame.props.style).toContainEqual(theme.pinnedCell)
    expect(pinnedFrame.props.style).toContainEqual({ opacity: 1 })
    expect(header.props.style).toContainEqual(theme.header)
    expect(centerHeaderFrame.props.style).toContainEqual(theme.headerCell)
    expect(headerText.props.style).toContainEqual(theme.headerText)
    expect(getRowStyle).toHaveBeenCalledWith({ row: { id: 0 }, rowIndex: 0 })
    expect(getCellStyle).toHaveBeenCalledWith({
      row: { id: 0 },
      rowIndex: 0,
      column: columns[0],
      columnIndex: 0
    })
    expect(getCellStyle).toHaveBeenCalledWith({
      row: { id: 0 },
      rowIndex: 0,
      column: columns[1],
      columnIndex: 1
    })
  })
})
