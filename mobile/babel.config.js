module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@": "./",
            "zustand/middleware": "zustand/middleware.js",
            "zustand/react/shallow": "zustand/react/shallow.js"
          }
        }
      ],
      "react-native-reanimated/plugin"
    ]
  };
};
