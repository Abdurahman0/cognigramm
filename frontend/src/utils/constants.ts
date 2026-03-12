export const STORAGE_KEYS = {
  accessToken: "messenger_access_token",
  refreshToken: "messenger_refresh_token",
  theme: "messenger_theme"
} as const;

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || "ws://localhost:8001";
export const USE_LOCAL_MEDIA_UPLOAD = process.env.NEXT_PUBLIC_USE_LOCAL_MEDIA_UPLOAD !== "false";

export const WS_RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000, 12000];
export const MESSAGE_PAGE_LIMIT = 50;
