import { describe, expect, it } from 'vitest'
import { createGridLayout } from '../src/index.js'

const layout = () =>
  createGridLayout({
    rowCount: 100_000,
    rowHeight: 48,
    columns: [
      { id: 'id', width: 80, pinned: 'left' },
      { id: 'name', width: 180 },
      { id: 'status', width: 80 },
      { id: 'revenue', width: 240 },
      { id: 'actions', width: 100, pinned: 'right' }
    ]
  })

const multiPinnedLayout = () =>
  createGridLayout({
    rowCount: 100,
    rowHeight: 48,
    columns: [
      { id: 'id', width: 80, pinned: 'left' },
      { id: 'name', width: 160, pinned: 'left' },
      { id: 'region', width: 120 },
      { id: 'revenue', width: 140 },
      { id: 'status', width: 100, pinned: 'right' },
      { id: 'actions', width: 72, pinned: 'right' }
    ]
  })

describe('createGridLayout', () => {
  it('calculates the fixed row window using an exclusive end index', () => {
    expect(
      layout().getVisibleRows({ scrollY: 48 * 10 + 12, viewportHeight: 96, overscan: 2 })
    ).toEqual({
      startIndex: 8,
      endIndex: 15,
      items: [
        { index: 8, offset: 384, size: 48 },
        { index: 9, offset: 432, size: 48 },
        { index: 10, offset: 480, size: 48 },
        { index: 11, offset: 528, size: 48 },
        { index: 12, offset: 576, size: 48 },
        { index: 13, offset: 624, size: 48 },
        { index: 14, offset: 672, size: 48 }
      ]
    })
  })

  it('clamps row overscan at the dataset boundaries', () => {
    const grid = createGridLayout({ rowCount: 2, rowHeight: 10, columns: [] })
    expect(grid.getVisibleRows({ scrollY: 999, viewportHeight: 10, overscan: 3 })).toEqual({
      startIndex: 0,
      endIndex: 2,
      items: [
        { index: 0, offset: 0, size: 10 },
        { index: 1, offset: 10, size: 10 }
      ]
    })
  })

  describe('pinned columns', () => {
    it('excludes pinned columns from the center cells while retaining the logical range', () => {
      expect(layout().getVisibleColumns({ scrollX: 190, viewportWidth: 160, overscan: 1 })).toEqual(
        {
          startIndex: 0,
          endIndex: 5,
          items: [
            { index: 1, offset: 80, size: 180 },
            { index: 2, offset: 260, size: 80 },
            { index: 3, offset: 340, size: 240 }
          ]
        }
      )
    })

    it('assigns cumulative left offsets and right offsets measured from the viewport edge', () => {
      expect(multiPinnedLayout().getPinnedColumns()).toEqual([
        { id: 'id', index: 0, offset: 0, size: 80, pinned: 'left', pinnedOffset: 0 },
        { id: 'name', index: 1, offset: 80, size: 160, pinned: 'left', pinnedOffset: 80 },
        { id: 'status', index: 4, offset: 500, size: 100, pinned: 'right', pinnedOffset: 72 },
        { id: 'actions', index: 5, offset: 600, size: 72, pinned: 'right', pinnedOffset: 0 }
      ])
    })

    it('renders only unpinned center columns when overscan reaches both pinned edges', () => {
      expect(
        multiPinnedLayout().getVisibleColumns({ scrollX: 300, viewportWidth: 150, overscan: 2 })
      ).toEqual({
        startIndex: 0,
        endIndex: 6,
        items: [
          { index: 2, offset: 240, size: 120 },
          { index: 3, offset: 360, size: 140 }
        ]
      })
    })

    it('does not produce duplicate center cells when the viewport intersects only a pinned column', () => {
      expect(
        multiPinnedLayout().getVisibleColumns({ scrollX: 500, viewportWidth: 72, overscan: 0 })
      ).toEqual({ startIndex: 4, endIndex: 5, items: [] })
    })

    it('keeps the logical scroll target separate from pinned display offsets', () => {
      const grid = multiPinnedLayout()
      expect(grid.getColumnOffset(1)).toBe(80)
      expect(grid.getColumnOffset(4)).toBe(500)
      expect(grid.getPinnedColumns().map(({ id, pinnedOffset }) => ({ id, pinnedOffset }))).toEqual(
        [
          { id: 'id', pinnedOffset: 0 },
          { id: 'name', pinnedOffset: 80 },
          { id: 'status', pinnedOffset: 72 },
          { id: 'actions', pinnedOffset: 0 }
        ]
      )
    })
  })

  it('returns logical dimensions and stable geometry offsets', () => {
    const grid = layout()
    expect(grid.getTotalSize()).toEqual({ width: 680, height: 4_800_000 })
    expect(grid.getRowOffset(37)).toBe(1776)
    expect(grid.getColumnOffset(3)).toBe(340)
  })

  it('calculates a single left and right pinned offset without duplicating layout geometry', () => {
    expect(layout().getPinnedColumns()).toEqual([
      { id: 'id', index: 0, offset: 0, size: 80, pinned: 'left', pinnedOffset: 0 },
      { id: 'actions', index: 4, offset: 580, size: 100, pinned: 'right', pinnedOffset: 0 }
    ])
  })

  it('returns empty windows for zero-sized viewports and datasets', () => {
    expect(layout().getVisibleRows({ viewportHeight: 0, overscan: 3 })).toEqual({
      startIndex: 0,
      endIndex: 0,
      items: []
    })
    const grid = createGridLayout({ rowCount: 0, rowHeight: 48, columns: [] })
    expect(grid.getVisibleRows({ viewportHeight: 100, overscan: 3 })).toEqual({
      startIndex: 0,
      endIndex: 0,
      items: []
    })
  })

  it('rejects invalid geometry and out-of-bounds access', () => {
    expect(() => createGridLayout({ rowCount: -1, rowHeight: 48, columns: [] })).toThrow('rowCount')
    expect(() => createGridLayout({ rowCount: 1, rowHeight: 0, columns: [] })).toThrow('rowHeight')
    expect(() => layout().getColumnOffset(9)).toThrow('columnIndex')
  })

  describe('scroll and viewport boundaries', () => {
    it('normalizes negative scroll offsets to zero', () => {
      const grid = layout()
      expect(grid.getVisibleRows({ scrollY: -100, viewportHeight: 96, overscan: 0 })).toEqual(
        grid.getVisibleRows({ scrollY: 0, viewportHeight: 96, overscan: 0 })
      )
      expect(grid.getVisibleColumns({ scrollX: -50, viewportWidth: 160, overscan: 0 })).toEqual(
        grid.getVisibleColumns({ scrollX: 0, viewportWidth: 160, overscan: 0 })
      )
    })

    it('selects the expected item when scroll sits exactly on a row boundary', () => {
      expect(
        layout().getVisibleRows({ scrollY: 48 * 10, viewportHeight: 48, overscan: 0 })
      ).toEqual({
        startIndex: 10,
        endIndex: 11,
        items: [{ index: 10, offset: 480, size: 48 }]
      })
    })

    it('clamps the row window at the last row without trailing empty items', () => {
      const grid = createGridLayout({ rowCount: 5, rowHeight: 48, columns: [] })
      expect(grid.getVisibleRows({ scrollY: 999_999, viewportHeight: 96, overscan: 2 })).toEqual({
        startIndex: 2,
        endIndex: 5,
        items: [
          { index: 2, offset: 96, size: 48 },
          { index: 3, offset: 144, size: 48 },
          { index: 4, offset: 192, size: 48 }
        ]
      })
    })

    it('returns only strictly visible rows and columns when overscan is zero', () => {
      expect(
        layout().getVisibleRows({ scrollY: 48 * 10 + 12, viewportHeight: 96, overscan: 0 })
      ).toEqual({
        startIndex: 10,
        endIndex: 13,
        items: [
          { index: 10, offset: 480, size: 48 },
          { index: 11, offset: 528, size: 48 },
          { index: 12, offset: 576, size: 48 }
        ]
      })
      expect(layout().getVisibleColumns({ scrollX: 190, viewportWidth: 160, overscan: 0 })).toEqual(
        {
          startIndex: 1,
          endIndex: 4,
          items: [
            { index: 1, offset: 80, size: 180 },
            { index: 2, offset: 260, size: 80 },
            { index: 3, offset: 340, size: 240 }
          ]
        }
      )
    })

    it('clamps windows when scroll exceeds total content size', () => {
      const grid = createGridLayout({
        rowCount: 10,
        rowHeight: 48,
        columns: [
          { id: 'a', width: 100 },
          { id: 'b', width: 100 }
        ]
      })
      expect(grid.getVisibleRows({ scrollY: 999_999, viewportHeight: 48, overscan: 0 })).toEqual({
        startIndex: 9,
        endIndex: 10,
        items: [{ index: 9, offset: 432, size: 48 }]
      })
      expect(grid.getVisibleColumns({ scrollX: 999_999, viewportWidth: 100, overscan: 0 })).toEqual(
        {
          startIndex: 1,
          endIndex: 2,
          items: [{ index: 1, offset: 100, size: 100 }]
        }
      )
    })
  })

  describe('column geometry edge cases', () => {
    it('returns a single center column for a one-column grid', () => {
      const grid = createGridLayout({
        rowCount: 10,
        rowHeight: 48,
        columns: [{ id: 'only', width: 120 }]
      })
      expect(grid.getVisibleColumns({ scrollX: 500, viewportWidth: 80, overscan: 0 })).toEqual({
        startIndex: 0,
        endIndex: 1,
        items: [{ index: 0, offset: 0, size: 120 }]
      })
    })

    it('returns zero width and empty windows when there are no columns', () => {
      const grid = createGridLayout({ rowCount: 10, rowHeight: 48, columns: [] })
      expect(grid.getTotalSize().width).toBe(0)
      expect(grid.getPinnedColumns()).toEqual([])
      expect(grid.getVisibleColumns({ scrollX: 0, viewportWidth: 400, overscan: 1 })).toEqual({
        startIndex: 0,
        endIndex: 0,
        items: []
      })
    })

    it('returns empty center items when every column is pinned left', () => {
      const grid = createGridLayout({
        rowCount: 10,
        rowHeight: 48,
        columns: [
          { id: 'a', width: 80, pinned: 'left' },
          { id: 'b', width: 60, pinned: 'left' }
        ]
      })
      expect(grid.getVisibleColumns({ scrollX: 0, viewportWidth: 400, overscan: 2 })).toEqual({
        startIndex: 0,
        endIndex: 2,
        items: []
      })
    })

    it('returns empty center items when every column is pinned right', () => {
      const grid = createGridLayout({
        rowCount: 10,
        rowHeight: 48,
        columns: [
          { id: 'a', width: 80, pinned: 'right' },
          { id: 'b', width: 60, pinned: 'right' }
        ]
      })
      expect(grid.getVisibleColumns({ scrollX: 100, viewportWidth: 400, overscan: 2 })).toEqual({
        startIndex: 0,
        endIndex: 2,
        items: []
      })
    })

    it('includes every unpinned column when the viewport is wider than total width', () => {
      expect(
        layout().getVisibleColumns({ scrollX: 0, viewportWidth: 10_000, overscan: 0 })
      ).toEqual({
        startIndex: 0,
        endIndex: 5,
        items: [
          { index: 1, offset: 80, size: 180 },
          { index: 2, offset: 260, size: 80 },
          { index: 3, offset: 340, size: 240 }
        ]
      })
    })

    it('selects the next column when scroll sits on the last pixel of the previous column', () => {
      const grid = createGridLayout({
        rowCount: 1,
        rowHeight: 48,
        columns: [
          { id: 'a', width: 80 },
          { id: 'b', width: 120 },
          { id: 'c', width: 60 }
        ]
      })
      expect(grid.getVisibleColumns({ scrollX: 80, viewportWidth: 60, overscan: 0 })).toEqual({
        startIndex: 1,
        endIndex: 2,
        items: [{ index: 1, offset: 80, size: 120 }]
      })
    })
  })

  describe('row geometry edge cases', () => {
    it('handles a single-row dataset with different viewport heights and overscan', () => {
      const grid = createGridLayout({ rowCount: 1, rowHeight: 48, columns: [] })
      expect(grid.getVisibleRows({ scrollY: 0, viewportHeight: 24, overscan: 0 })).toEqual({
        startIndex: 0,
        endIndex: 1,
        items: [{ index: 0, offset: 0, size: 48 }]
      })
      expect(grid.getVisibleRows({ scrollY: 0, viewportHeight: 96, overscan: 2 })).toEqual({
        startIndex: 0,
        endIndex: 1,
        items: [{ index: 0, offset: 0, size: 48 }]
      })
    })

    it('returns zero height and an empty row window for rowCount zero', () => {
      const grid = createGridLayout({
        rowCount: 0,
        rowHeight: 48,
        columns: [{ id: 'a', width: 80 }]
      })
      expect(grid.getTotalSize().height).toBe(0)
      expect(grid.getVisibleRows({ scrollY: 0, viewportHeight: 100, overscan: 1 })).toEqual({
        startIndex: 0,
        endIndex: 0,
        items: []
      })
    })

    it('returns stable first and last row offsets', () => {
      const grid = createGridLayout({ rowCount: 50, rowHeight: 48, columns: [] })
      expect(grid.getRowOffset(0)).toBe(0)
      expect(grid.getRowOffset(49)).toBe(2352)
      expect(grid.getTotalSize().height).toBe(2400)
    })
  })

  describe('validation edge cases', () => {
    it('rejects duplicate column ids', () => {
      expect(() =>
        createGridLayout({
          rowCount: 1,
          rowHeight: 48,
          columns: [
            { id: 'dup', width: 80 },
            { id: 'dup', width: 100 }
          ]
        })
      ).toThrow('duplicate column id: dup')
    })

    it('rejects non-positive column widths', () => {
      expect(() =>
        createGridLayout({
          rowCount: 1,
          rowHeight: 48,
          columns: [{ id: 'bad', width: 0 }]
        })
      ).toThrow('width for column bad')
    })

    it('rejects non-finite scroll offsets', () => {
      expect(() =>
        layout().getVisibleRows({ scrollY: Number.NaN, viewportHeight: 96, overscan: 0 })
      ).toThrow('scroll offset')
      expect(() =>
        layout().getVisibleColumns({
          scrollX: Number.POSITIVE_INFINITY,
          viewportWidth: 100,
          overscan: 0
        })
      ).toThrow('scroll offset')
    })

    it('rejects negative overscan', () => {
      expect(() =>
        layout().getVisibleRows({ scrollY: 0, viewportHeight: 96, overscan: -1 })
      ).toThrow('overscan')
    })
  })
})
