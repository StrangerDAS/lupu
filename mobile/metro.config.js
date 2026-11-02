const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// 1. Add support for .cjs files used by Firebase
defaultConfig.resolver.sourceExts.push('cjs');

// 2. Disable package exports that break Firebase JS SDK resolution in Metro
defaultConfig.resolver.unstable_enablePackageExports = false;

module.exports = defaultConfig;
