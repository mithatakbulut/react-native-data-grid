import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const corePackageRoot = join(repositoryRoot, 'packages', 'core')
const reactNativePackageRoot = join(repositoryRoot, 'packages', 'react-native')
const fixtureRoot = await mkdtemp(join(tmpdir(), 'react-native-data-grid-package-consumer-'))
const tarballRoot = join(fixtureRoot, 'tarballs')

function run(command, args, cwd = fixtureRoot) {
  execFileSync(command, args, { cwd, stdio: 'inherit' })
}

async function pack(packageRoot) {
  run('pnpm', ['pack', '--pack-destination', tarballRoot], packageRoot)

  const packageName = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')).name
  const archive = (await readdir(tarballRoot)).find(
    (file) => file.endsWith('.tgz') && file.includes(packageName.replace('@', '').replace('/', '-'))
  )

  if (!archive) {
    throw new Error(`pnpm pack did not create an archive for ${packageName}`)
  }

  return join(tarballRoot, archive)
}

function readPackedFile(tarball, path) {
  return execFileSync('tar', ['-xOzf', tarball, `package/${path}`], { encoding: 'utf8' })
}

function assertPackedPackage(tarball, packageName) {
  const files = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).split('\n')
  const requiredFiles = [
    'package/package.json',
    'package/README.md',
    'package/dist/index.js',
    'package/dist/index.d.ts'
  ]

  for (const file of requiredFiles) {
    if (!files.includes(file)) {
      throw new Error(`${packageName} tarball is missing ${file}`)
    }
  }

  const packageJson = JSON.parse(readPackedFile(tarball, 'package.json'))
  if (
    packageJson.exports?.['.']?.types !== './dist/index.d.ts' ||
    packageJson.exports?.['.']?.default !== './dist/index.js'
  ) {
    throw new Error(`${packageName} tarball has an unexpected root export map`)
  }

  return packageJson
}

try {
  run('pnpm', ['build'], repositoryRoot)

  const [coreTarball, reactNativeTarball] = await Promise.all([
    pack(corePackageRoot),
    pack(reactNativePackageRoot)
  ])
  const corePackage = assertPackedPackage(coreTarball, '@react-native-data-grid/core')
  const reactNativePackage = assertPackedPackage(
    reactNativeTarball,
    '@react-native-data-grid/react-native'
  )

  if (reactNativePackage.dependencies?.['@react-native-data-grid/core'] !== corePackage.version) {
    throw new Error(
      'Packed React Native package does not depend on the packed core package version'
    )
  }

  await Promise.all([
    writeFile(
      join(fixtureRoot, 'package.json'),
      `${JSON.stringify(
        {
          name: 'react-native-data-grid-packed-consumer',
          private: true,
          type: 'module',
          scripts: {
            typecheck: 'tsc --noEmit',
            bundle: 'metro build index.js --out bundle.js --platform ios'
          },
          dependencies: {
            '@react-native-data-grid/core': `file:${coreTarball}`,
            '@react-native-data-grid/react-native': `file:${reactNativeTarball}`,
            react: '19.2.3',
            'react-native': '0.87.0'
          },
          devDependencies: {
            '@react-native/metro-config': '0.87.0',
            typescript: '^5.9.3'
          },
          // The packed React Native package depends on the exact packed core version, which is
          // not on the registry yet while a release is being prepared. Resolve it to the local
          // tarball so the smoke test exercises the artifacts under test, not published ones.
          pnpm: {
            overrides: {
              '@react-native-data-grid/core': `file:${coreTarball}`
            }
          }
        },
        null,
        2
      )}\n`
    ),
    writeFile(
      join(fixtureRoot, 'tsconfig.json'),
      `${JSON.stringify(
        {
          compilerOptions: {
            strict: true,
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            jsx: 'react-jsx',
            noEmit: true,
            skipLibCheck: true
          },
          include: ['consumer.ts']
        },
        null,
        2
      )}\n`
    ),
    writeFile(
      join(fixtureRoot, 'consumer.ts'),
      `import { createGridLayout } from '@react-native-data-grid/core'\nimport {\n  DataGrid,\n  RowVirtualizedDataGrid,\n  type ColumnScrollAlignment,\n  type DataGridColumn,\n  type DataGridHandle,\n  type DataGridProfilingSnapshot,\n  type DataGridProps,\n  type ScrollToColumnOptions\n} from '@react-native-data-grid/react-native'\n\ntype Row = { readonly name: string }\n\nconst columns: readonly DataGridColumn<Row>[] = [\n  { id: 'name', width: 160, renderCell: ({ row }) => row.name }\n]\nconst layout = createGridLayout({ columns, rowCount: 1, rowHeight: 44 })\nconst profilingSnapshot: DataGridProfilingSnapshot = {\n  commits: 0,\n  commitDurationMs: 0,\n  rowRenders: 0,\n  rowMounts: 0,\n  rowUnmounts: 0,\n  cellRenders: 0,\n  cellMounts: 0,\n  cellUnmounts: 0,\n  scrollEvents: 0,\n  scrollEventsWithoutRangeChange: 0,\n  rangeChanges: 0\n}\nconst columnAlignment: ColumnScrollAlignment = 'auto'\nconst scrollOptions: ScrollToColumnOptions = { align: columnAlignment }\n\ndeclare const gridHandle: DataGridHandle\ndeclare const gridProps: DataGridProps<Row>\nconst snapshotFromHandle: DataGridProfilingSnapshot = gridHandle.getProfilingSnapshot()\n\nvoid DataGrid\nvoid RowVirtualizedDataGrid\nvoid gridProps\nvoid layout\nvoid profilingSnapshot\nvoid scrollOptions\nvoid snapshotFromHandle\n`
    ),
    writeFile(
      join(fixtureRoot, 'index.js'),
      `import { createGridLayout } from '@react-native-data-grid/core'\nimport { DataGrid } from '@react-native-data-grid/react-native'\n\ncreateGridLayout({ columns: [{ id: 'name', width: 160 }], rowCount: 1, rowHeight: 44 })\nvoid DataGrid\n`
    ),
    writeFile(
      join(fixtureRoot, 'metro.config.cjs'),
      `const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')\n\nmodule.exports = mergeConfig(getDefaultConfig(__dirname), { projectRoot: __dirname })\n`
    )
  ])

  run('pnpm', ['install', '--config.node-linker=hoisted', '--ignore-scripts'])
  run('pnpm', ['run', 'typecheck'])
  run('pnpm', ['run', 'bundle'])
} finally {
  await rm(fixtureRoot, { recursive: true, force: true })
}
