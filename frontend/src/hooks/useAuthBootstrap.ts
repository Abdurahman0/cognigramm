"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query/queryKeys";
import { usersApi } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";

export function useAuthBootstrap(redirectUnauthed = false): void {
  const router = useRouter();
  const { isHydrated, isAuthenticated, hydrate, logout } = useAuthStore();
  const { setCurrentUser } = useUserStore();

  useEffect(() => {
    if (!isHydrated) {
      hydrate();
    }
  }, [hydrate, isHydrated]);

  const enabled = isHydrated && isAuthenticated;

  useQuery({
    queryKey: queryKeys.me,
    queryFn: usersApi.me,
    enabled,
    retry: 0
  });

  useEffect(() => {
    if (!enabled) {
      setCurrentUser(null);
      if (redirectUnauthed && isHydrated) {
        router.replace("/auth/login");
      }
      return;
    }
    usersApi
      .me()
      .then((me) => {
        setCurrentUser(me);
      })
      .catch(() => {
        logout();
        setCurrentUser(null);
        if (redirectUnauthed) {
          router.replace("/auth/login");
        }
      });
  }, [enabled, isHydrated, logout, redirectUnauthed, router, setCurrentUser]);
}
