import { CALL_FEATURE_FLAGS } from "@/features/calls/config/callConfig";

const prefix = "[calls]";

export const callLogger = {
  debug: (...args: unknown[]) => {
    if (!CALL_FEATURE_FLAGS.debugLogsEnabled) {
      return;
    }
    console.log(prefix, ...args);
  },
  warn: (...args: unknown[]) => {
    if (!CALL_FEATURE_FLAGS.debugLogsEnabled) {
      return;
    }
    console.warn(prefix, ...args);
  },
  error: (...args: unknown[]) => {
    if (!CALL_FEATURE_FLAGS.debugLogsEnabled) {
      return;
    }
    console.error(prefix, ...args);
  }
};
