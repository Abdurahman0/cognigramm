"use client";

import { ProtectedRoute } from "@/components/common/ProtectedRoute";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function ChatRouteLayout({ children }: { children: React.ReactNode }): JSX.Element {
  useWebSocket();

  return <ProtectedRoute>{children}</ProtectedRoute>;
}
