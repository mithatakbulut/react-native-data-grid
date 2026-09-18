import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const packageRoot = resolve(import.meta.dirname, '..')
const repositoryRoot = resolve(packageRoot, '..', '..')

describe('published compatibility policy', () => {
  it('limits peer dependencies to the React Native versions covered by CI', async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(packageRoot, 'package.json'), 'utf8')
    ) as {
      peerDependencies: Record<string, string>
    }

    expect(packageJson.peerDependencies).toMatchObject({
      react: '>=19.2.3 <20.0.0',
      'react-native': '>=0.86.0 <0.88.0'
    })
  })

  it('documents supported releases separately from versions that may work', async () => {
    const readme = await readFile(resolve(repositoryRoot, 'README.md'), 'utf8')

    expect(readme).toContain('The supported React Native releases are **0.86.x** and **0.87.x**.')
    expect(readme).toContain(
      'Versions outside the peer range may happen to work, but are not supported'
    )
  })

  it('keeps CI coverage at the supported range boundaries', async () => {
    const workflow = await readFile(
      resolve(repositoryRoot, '.github/workflows/react-native-compatibility.yml'),
      'utf8'
    )

    expect(workflow).toContain('react-native: 0.86.0')
    expect(workflow).toContain('react-native: 0.87.0')
    expect(workflow).toContain('node scripts/test-react-native-compatibility.mjs')
  })
})
