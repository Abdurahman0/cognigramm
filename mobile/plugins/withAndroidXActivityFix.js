const { withProjectBuildGradle } = require('expo/config-plugins');

const ACTIVITY_FIX_BLOCK = `
subprojects {
  configurations.all {
    resolutionStrategy {
      force "androidx.activity:activity:1.10.1"
      force "androidx.activity:activity-ktx:1.10.1"
    }
  }
}
`;

const withAndroidXActivityFix = (config) =>
  withProjectBuildGradle(config, (config) => {
    if (
      !config.modResults.contents.includes(
        'force "androidx.activity:activity:1.10.1"'
      )
    ) {
      config.modResults.contents += ACTIVITY_FIX_BLOCK;
    }
    return config;
  });

module.exports = withAndroidXActivityFix;
