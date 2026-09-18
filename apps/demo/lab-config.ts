export const LAB_SCHEME = 'rndg'
export const LAB_HOST = 'lab'

export type CellMode = 'light' | 'rich' | 'image'
export type GridImplementation = 'two-dimensional' | 'rows-only'
export type PublicRenderer = 'text' | 'rich' | 'image'

export type Preset = {
  readonly id: string
  readonly label: string
  readonly rowCount: number
  readonly columnCount: number
}

export type LabConfig = {
  readonly dataset: string
  readonly implementation: GridImplementation
  readonly renderer: PublicRenderer
  readonly cellMode: CellMode
  readonly rowOverscan: number
  readonly columnOverscan: number
  readonly pinnedLeftCount: number
  readonly pinnedRightCount: number
}

export const PRESETS: readonly Preset[] = [
  { id: '10k-x-20', label: '10k × 20', rowCount: 10_000, columnCount: 20 },
  { id: '100k-x-20', label: '100k × 20', rowCount: 100_000, columnCount: 20 },
  { id: '100k-x-100', label: '100k × 100', rowCount: 100_000, columnCount: 100 },
  { id: '100k-x-250', label: '100k × 250', rowCount: 100_000, columnCount: 250 }
]

const PRESETS_BY_ID = new Map(PRESETS.map((preset) => [preset.id, preset]))

const RENDERER_TO_CELL_MODE: Record<string, CellMode> = {
  text: 'light',
  light: 'light',
  rich: 'rich',
  image: 'image'
}

const CELL_MODE_TO_RENDERER: Record<CellMode, PublicRenderer> = {
  light: 'text',
  rich: 'rich',
  image: 'image'
}

const IMPLEMENTATIONS = new Set<GridImplementation>(['two-dimensional', 'rows-only'])

export function defaultLabConfig(): LabConfig {
  const preset = PRESETS[2]!
  return {
    dataset: preset.id,
    implementation: 'two-dimensional',
    renderer: 'text',
    cellMode: 'light',
    rowOverscan: 3,
    columnOverscan: 2,
    pinnedLeftCount: 1,
    pinnedRightCount: 1
  }
}

export function presetById(id: string): Preset | undefined {
  return PRESETS_BY_ID.get(id)
}

export function datasetIdForPreset(preset: Pick<Preset, 'rowCount' | 'columnCount'>): string {
  return (
    PRESETS.find(
      (candidate) =>
        candidate.rowCount === preset.rowCount && candidate.columnCount === preset.columnCount
    )?.id ?? `${preset.rowCount}-x-${preset.columnCount}`
  )
}

export function publicRendererForCellMode(cellMode: CellMode): PublicRenderer {
  return CELL_MODE_TO_RENDERER[cellMode]
}

export function labReadyLabel(config: {
  readonly dataset: string
  readonly implementation: string
  readonly renderer: string
}): string {
  return `lab-ready dataset:${config.dataset} implementation:${config.implementation} renderer:${config.renderer}`
}

export function parseLabUrl(url: string | null | undefined): LabConfig | null {
  if (!url) return null

  const match = new RegExp(`^${LAB_SCHEME}:\\/\\/${LAB_HOST}\\/?(?:\\?(.*))?$`).exec(url)
  if (!match) return null

  const defaults = defaultLabConfig()
  const params = new URLSearchParams(match[1] ?? '')
  const dataset = params.get('dataset') ?? defaults.dataset
  const implementation = params.get('implementation') ?? defaults.implementation
  const rendererParam = params.get('renderer') ?? defaults.renderer
  const cellMode = RENDERER_TO_CELL_MODE[rendererParam]
  const preset = presetById(dataset)

  if (!preset || !cellMode || !IMPLEMENTATIONS.has(implementation as GridImplementation)) {
    return null
  }

  return {
    dataset,
    implementation: implementation as GridImplementation,
    renderer: CELL_MODE_TO_RENDERER[cellMode],
    cellMode,
    rowOverscan: readBoundedInt(params.get('rowOverscan'), defaults.rowOverscan, 0, 12),
    columnOverscan: readBoundedInt(params.get('columnOverscan'), defaults.columnOverscan, 0, 12),
    pinnedLeftCount: readBoundedInt(params.get('pinnedLeft'), defaults.pinnedLeftCount, 0, 3),
    pinnedRightCount: readBoundedInt(params.get('pinnedRight'), defaults.pinnedRightCount, 0, 1)
  }
}

function readBoundedInt(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (value == null || value === '') return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, parsed))
}
