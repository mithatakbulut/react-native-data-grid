import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const [reactNativeVersion, reactVersion] = process.argv.slice(2)

if (!reactNativeVersion || !reactVersion) {
  throw new Error(
    'Usage: node scripts/test-react-native-compatibility.mjs <react-native-version> <react-version>'
  )
}

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const packageRoot = join(repositoryRoot, 'packages', 'react-native')
const coreRoot = join(repositoryRoot, 'packages', 'core')
const fixtureRoot = await mkdtemp(join(tmpdir(), 'react-native-data-grid-compatibility-'))
const testRendererVersion = reactVersion.startsWith('19.2.') ? '1.2.0' : '1.0.0'

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: fixtureRoot,
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`)
  }
}

try {
  await Promise.all([
    cp(join(packageRoot, 'src'), join(fixtureRoot, 'src'), { recursive: true }),
    cp(join(packageRoot, 'tests'), join(fixtureRoot, 'tests'), { recursive: true }),
    cp(join(coreRoot, 'dist'), join(fixtureRoot, 'core-dist'), { recursive: true }),
    cp(join(repositoryRoot, 'tsconfig.base.json'), join(fixtureRoot, 'tsconfig.base.json'))
  ])
  await rm(join(fixtureRoot, 'tests', 'compatibility-policy.test.ts'))

  const sourcePackage = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  await cp(join(fixtureRoot, 'core-dist'), join(fixtureRoot, 'core'), { recursive: true })
  await writeFile(
    join(fixtureRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: 'react-native-data-grid-compatibility-fixture',
        private: true,
        type: 'module',
        scripts: {
          test: 'vitest run',
          typecheck: 'tsc --noEmit --project tsconfig.json'
        },
        dependencies: {
          '@react-native-data-grid/core': `file:${join(fixtureRoot, 'core')}`,
          react: reactVersion,
          'react-native': reactNativeVersion,
          'test-renderer': testRendererVersion
        },
        devDependencies: {
          '@types/react': '^19.1.0',
          typescript: '^5.9.3',
          vitest: sourcePackage.devDependencies.vitest
        }
      },
      null,
      2
    )}\n`
  )
  await writeFile(
    join(fixtureRoot, 'core', 'package.json'),
    `${JSON.stringify({
      name: '@react-native-data-grid/core',
      type: 'module',
      types: './index.d.ts',
      exports: { '.': { types: './index.d.ts', default: './index.js' } }
    })}\n`
  )
  await writeFile(
    join(fixtureRoot, 'tsconfig.json'),
    `${JSON.stringify(
      {
        extends: './tsconfig.base.json',
        compilerOptions: { jsx: 'react-jsx', rootDir: 'src', outDir: 'dist' },
        include: ['src/**/*.ts', 'src/**/*.tsx']
      },
      null,
      2
    )}\n`
  )

  run('pnpm', ['install', '--config.node-linker=hoisted'])
  run('pnpm', ['run', 'typecheck'])
  run('pnpm', ['run', 'test'])
} finally {
  await rm(fixtureRoot, { recursive: true, force: true })
}
