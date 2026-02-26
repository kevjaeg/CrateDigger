const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve .wasm files (needed by expo-sqlite web worker)
config.resolver.assetExts = [...(config.resolver.assetExts || []), "wasm"];

module.exports = withNativeWind(config, { input: "./global.css" });
