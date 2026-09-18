import { act } from './modern-test-renderer.js'
import { describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

import './react-native-test-mock.js'
import { layoutGrid, renderGrid } from './grid-test-utils.js'
import type { DataGridColumn } from '../src/index.js'

type Row = { readonly id: number }

const columns: readonly DataGridColumn<Row>[] = [
  { id: 'left', width: 80, pinned: 'left', renderCell: ({ row }) => `left-${row.id}` },
  { id: 'center', width: 120, renderCell: ({ row }) => `center-${row.id}` },
  { id: 'right', width: 80, pinned: 'right', renderCell: ({ row }) => `right-${row.id}` }
]

function findPressable(grid: ReturnType<typeof renderGrid>, text: string) {
  const node = grid.root.findAll(
    (candidate) => candidate.type === 'Pressable' && candidate.props.children === text
  )[0]
  if (!node) throw new Error(`expected pressable cell for ${text}`)
  return node
}

describe('DataGrid interactions', () => {
  it('does not add Pressable cells without interaction callbacks', () => {
    const grid = renderGrid({ columns, rowCount: 1, rowOverscan: 0, columnOverscan: 0 })
    layoutGrid(grid, { width: 400, height: 200 })

    expect(grid.root.findAll((candidate) => candidate.type === 'Pressable')).toHaveLength(0)
  })

  it('emits the same typed cell event for center and pinned cells', () => {
    const onCellPress = vi.fn()
    const onCellLongPress = vi.fn()
    const grid = renderGrid({
      columns,
      rowCount: 1,
      rowOverscan: 0,
      columnOverscan: 0,
      onCellPress,
      onCellLongPress
    })
    layoutGrid(grid, { width: 400, height: 200 })

    act(() => {
      findPressable(grid, 'center-0').props.onPress()
      findPressable(grid, 'left-0').props.onLongPress()
      findPressable(grid, 'right-0').props.onPress()
    })

    expect(onCellPress).toHaveBeenNthCalledWith(1, {
      row: { id: 0 },
      rowIndex: 0,
      column: columns[1],
      columnIndex: 1
    })
    expect(onCellLongPress).toHaveBeenCalledWith({
      row: { id: 0 },
      rowIndex: 0,
      column: columns[0],
      columnIndex: 0
    })
    expect(onCellPress).toHaveBeenNthCalledWith(2, {
      row: { id: 0 },
      rowIndex: 0,
      column: columns[2],
      columnIndex: 2
    })
  })

  it('emits cell then row press callbacks once for the pressed cell', () => {
    const calls: string[] = []
    const onCellPress = vi.fn(() => calls.push('cell'))
    const onRowPress = vi.fn(() => calls.push('row'))
    const grid = renderGrid({
      columns,
      rowCount: 1,
      rowOverscan: 0,
      columnOverscan: 0,
      onCellPress,
      onRowPress
    })
    layoutGrid(grid, { width: 400, height: 200 })

    act(() => findPressable(grid, 'right-0').props.onPress())

    expect(calls).toEqual(['cell', 'row'])
    expect(onRowPress).toHaveBeenCalledTimes(1)
    expect(onRowPress).toHaveBeenCalledWith({ row: { id: 0 }, rowIndex: 0 })
  })
})
