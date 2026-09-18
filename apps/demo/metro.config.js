const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')
const config = getDefaultConfig(projectRoot)

config.watchFolders = [
  path.join(workspaceRoot, 'packages/core'),
  path.join(workspaceRoot, 'packages/react-native')
]
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(workspaceRoot, 'node_modules')
]

function resolveFromReactNative(relativePath) {
  const reactNativeRoot = path.dirname(require.resolve('react-native/package.json'))
  return require.resolve(relativePath, { paths: [reactNativeRoot] })
}

config.resolver.emptyModulePath = resolveFromReactNative(
  'metro-runtime/src/modules/empty-module.js'
)
config.transformer.asyncRequireModulePath = resolveFromReactNative(
  'metro-runtime/src/modules/asyncRequire.js'
)

module.exports = config
