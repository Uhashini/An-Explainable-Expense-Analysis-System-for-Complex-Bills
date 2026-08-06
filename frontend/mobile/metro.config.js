process.env.EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK = '1';
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
};

config.watcher = {
  ...config.watcher,
  healthCheck: { enabled: false },
};

module.exports = config;
