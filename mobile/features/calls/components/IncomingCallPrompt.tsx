import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";

import { CALL_FEATURE_FLAGS, CALL_ROUTE_CONFIG, CALL_TIMEOUTS_MS } from "@/features/calls/config/callConfig";
import { useCallsStore } from "@/store/callsStore";
import { useChatStore } from "@/store/chatStore";

export function IncomingCallPrompt(): null {
  const router = useRouter();
  const pathname = usePathname();
  const promptLockRef = useRef("");
  const activeRouteLockRef = useRef("");
  const autoDeclineLockRef = useRef("");
  const currentCall = useCallsStore((state) => state.currentCall);
  const incomingFromUserId = useCallsStore((state) => state.incomingFromUserId);
  const rejectCall = useCallsStore((state) => state.rejectCall);
  const users = useChatStore((state) => state.users);

  useEffect(() => {
    if (!CALL_FEATURE_FLAGS.incomingCallPromptEnabled) {
      return;
    }
    if (!currentCall || currentCall.status !== "ringing" || currentCall.direction !== "incoming") {
      return;
    }
    if (promptLockRef.current === currentCall.id) {
      return;
    }
    if (pathname?.includes("/calls/")) {
      return;
    }
    promptLockRef.current = currentCall.id;

    const callerId = incomingFromUserId || currentCall.initiatorId;
    const caller = users.find((user) => user.id === callerId)?.fullName ?? `User ${callerId}`;

    const openCallScreen = (autoAccept: boolean) => {
      router.push({
        pathname: CALL_ROUTE_CONFIG.detailsPathname as never,
        params: autoAccept
          ? ({ callId: currentCall.id, autoAccept: "1" } as never)
          : ({ callId: currentCall.id } as never)
      });
    };

    const onAccept = () => {
      openCallScreen(true);
    };

    const onDecline = () => {
      rejectCall(currentCall.id);
    };

    if (Platform.OS === "web") {
      openCallScreen(false);
      return;
    }

    Alert.alert("Incoming call", `${caller} is calling`, [
      { text: "Decline", style: "destructive", onPress: onDecline },
      { text: "Accept", onPress: onAccept }
    ]);
  }, [
    currentCall,
    incomingFromUserId,
    pathname,
    rejectCall,
    router,
    users
  ]);

  useEffect(() => {
    if (!currentCall || currentCall.status !== "ringing" || currentCall.direction !== "incoming") {
      autoDeclineLockRef.current = "";
      return;
    }
    if (autoDeclineLockRef.current === currentCall.id) {
      return;
    }
    autoDeclineLockRef.current = currentCall.id;

    const timer = setTimeout(() => {
      const latest = useCallsStore.getState().currentCall;
      if (
        latest &&
        latest.id === currentCall.id &&
        latest.status === "ringing" &&
        latest.direction === "incoming"
      ) {
        rejectCall(currentCall.id);
      }
    }, CALL_TIMEOUTS_MS.incomingAutoDecline);

    return () => {
      clearTimeout(timer);
    };
  }, [currentCall, rejectCall]);

  useEffect(() => {
    if (!CALL_FEATURE_FLAGS.autoNavigateIncomingCallInForeground) {
      return;
    }
    if (Platform.OS === "web") {
      return;
    }
    const shouldOpenActiveCall =
      currentCall &&
      (currentCall.status === "connecting" || currentCall.status === "connected");
    if (!shouldOpenActiveCall) {
      if (
        !currentCall ||
        currentCall.status === "ended" ||
        currentCall.status === "declined" ||
        currentCall.status === "failed" ||
        currentCall.status === "missed"
      ) {
        activeRouteLockRef.current = "";
      }
      return;
    }
    if (pathname?.includes("/calls/")) {
      return;
    }
    if (activeRouteLockRef.current === currentCall.id) {
      return;
    }

    activeRouteLockRef.current = currentCall.id;
    router.push({
      pathname: CALL_ROUTE_CONFIG.detailsPathname as never,
      params: { callId: currentCall.id } as never
    });
  }, [currentCall, pathname, router]);

  return null;
}
