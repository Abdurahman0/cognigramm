// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Build output, not source: linting it buried the twenty real warnings
    // under twenty thousand generated ones.
    ignores: ["dist/*", "dist-web/*", ".preview-web/*", "node_modules/*"],
  }
]);
