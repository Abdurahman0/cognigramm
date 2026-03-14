const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "zustand/middleware") {
    return context.resolveRequest(
      context,
      path.resolve(__dirname, "node_modules/zustand/middleware.js"),
      platform
    );
  }

  if (platform === "web" && moduleName === "zustand/react/shallow") {
    return context.resolveRequest(
      context,
      path.resolve(__dirname, "node_modules/zustand/react/shallow.js"),
      platform
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
