import type { IconName } from "@/components/ui";

export interface WorkspaceNavItem {
  key: "chats" | "contacts" | "calls" | "profile";
  label: string;
  description: string;
  icon: IconName;
  pathname: string;
}

export const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  {
    key: "chats",
    label: "Chats",
    description: "Direct and group conversations",
    icon: "message-square",
    pathname: "/(app)/(tabs)/chats"
  },
  {
    key: "contacts",
    label: "Directory",
    description: "Colleagues by role and department",
    icon: "users",
    pathname: "/(app)/(tabs)/contacts"
  },
  {
    key: "calls",
    label: "Calls",
    description: "History and active sessions",
    icon: "phone-call",
    pathname: "/(app)/(tabs)/calls"
  },
  {
    key: "profile",
    label: "Profile",
    description: "Account and appearance",
    icon: "user",
    pathname: "/(app)/(tabs)/profile"
  }
];

/** Maps a router pathname to the owning workspace tab. */
export const resolveActiveNavKey = (pathname: string): WorkspaceNavItem["key"] => {
  if (pathname.includes("/contacts")) {
    return "contacts";
  }
  if (pathname.includes("/calls")) {
    return "calls";
  }
  if (pathname.includes("/profile") || pathname.includes("/settings")) {
    return "profile";
  }
  return "chats";
};
