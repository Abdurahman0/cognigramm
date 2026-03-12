"use client";

import { PropsWithChildren, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { queryClient } from "@/services/query/queryClient";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";

export function AppProviders({ children }: PropsWithChildren): JSX.Element {
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydrateTheme = useUIStore((state) => state.hydrateTheme);

  useEffect(() => {
    hydrate();
    hydrateTheme();
  }, [hydrate, hydrateTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
