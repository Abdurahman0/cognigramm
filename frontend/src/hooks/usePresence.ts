"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { presenceApi } from "@/services/api";
import { queryKeys } from "@/services/query/queryKeys";
import { usePresenceStore } from "@/store/presenceStore";

export function usePresencePolling(): void {
  const setOnlineUsers = usePresenceStore((state) => state.setOnlineUsers);
  const { data } = useQuery({
    queryKey: queryKeys.onlineUsers,
    queryFn: () => presenceApi.getOnlineUsers(10000),
    refetchInterval: 30000
  });

  useEffect(() => {
    if (data) {
      setOnlineUsers(data);
    }
  }, [data, setOnlineUsers]);
}
