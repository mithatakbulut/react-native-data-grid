import { act as reactAct } from 'react'
import { createRoot, type Root, type TestInstance } from 'test-renderer'

declare module 'test-renderer' {
  interface TestInstance {
    find(predicate: (instance: TestInstance) => boolean): TestInstance
    findAll(predicate: (instance: TestInstance) => boolean): TestInstance[]
  }
}

export type ReactTestInstance = TestInstance

export type ReactTestRenderer = {
  readonly root: TestInstance
  update(element: React.ReactElement): void
}

/**
 * Compatibility adapter for the structural grid tests. It uses Test Renderer,
 * the React 19 replacement for the deprecated react-test-renderer package.
 */
export function create(element: React.ReactElement): ReactTestRenderer {
  const renderer = createRoot()
  installLegacyStructuralQueries(renderer.container)
  act(() => renderer.render(element))
  return createRendererResult(renderer)
}

export function act(callback: () => void): void {
  // These tests exercise synchronous layout and scroll handlers. React still
  // returns a thenable from act(), but the committed host tree is available
  // before that thenable settles for this synchronous work.
  void reactAct(callback)
}

function createRendererResult(renderer: Root): ReactTestRenderer {
  return {
    get root() {
      return renderer.container
    },
    update(element) {
      act(() => renderer.render(element))
    }
  }
}

function installLegacyStructuralQueries(container: TestInstance): void {
  const prototype = Object.getPrototypeOf(container) as TestInstance
  if ('findAll' in prototype) return

  prototype.findAll = function findAll(predicate) {
    return this.queryAll(predicate)
  }
  prototype.find = function find(predicate) {
    const matches = this.queryAll(predicate)
    if (matches.length !== 1)
      throw new Error(`expected one matching node, received ${matches.length}`)
    return matches[0]!
  }
}
