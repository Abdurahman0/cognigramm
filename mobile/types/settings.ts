import type { ThemeMode } from "@/types/common";

export interface NotificationSettings {
  pushEnabled: boolean;
  emailDigest: boolean;
  mentionsOnly: boolean;
  urgentOnly: boolean;
  callAlerts: boolean;
  announcementAlerts: boolean;
}

export interface AppSettingsState {
  themeMode: ThemeMode;
  notifications: NotificationSettings;
  compactMode: boolean;
}
