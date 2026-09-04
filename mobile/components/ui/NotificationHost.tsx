import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/AppText";
import { GlassView } from "@/components/ui/GlassView";
import type { IconName } from "@/components/ui/IconButton";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useNotificationStore, type AppNotification, type NotificationTone } from "@/store/notificationStore";
import { motion } from "@/theme";

const TONE_ICON: Record<NotificationTone, IconName> = {
  success: "check-circle",
  error: "alert-triangle",
  info: "info"
};

/** How long a card sits before it retracts on its own. */
const VISIBLE_MS = 4200;
/** Distance the card travels from above the screen on the way in. */
const ENTRY_RISE = 120;
/** Swiping past this many points upward lets go of the card. */
const DISMISS_DISTANCE = 44;
/** Or flicking upward faster than this, however short the swipe. */
const DISMISS_VELOCITY = 0.5;

interface NotificationCardProps {
  item: AppNotification;
  /** Depth in the stack: 0 is the newest card, which sits in front. */
  depth: number;
}

/**
 * A single notification.
 *
 * It drops in from above the screen on a spring, overshooting slightly so it lands
 * like a card rather than sliding to a stop. Swiping up hands it to the finger: it
 * tracks the drag, thins and shrinks as it climbs, and either flies out the top or
 * springs back down when released. Pulling down instead is rubber-banded, so the card
 * resists rather than following past its resting place.
 */
function NotificationCard({ item, depth }: NotificationCardProps): JSX.Element {
  const { theme } = useAppTheme();
  const dismiss = useNotificationStore((state) => state.dismiss);
  const remove = useNotificationStore((state) => state.remove);

  /** 0 = off-screen above, 1 = resting. Drag pushes it back below 1. */
  const progress = useRef(new Animated.Value(0)).current;
  /** Extra pull applied by a finger, in points. Negative is upward. */
  const drag = useRef(new Animated.Value(0)).current;
  const dragValue = useRef(0);
  const settled = useRef(false);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(item.id);
  idRef.current = item.id;
  const removeRef = useRef(remove);
  removeRef.current = remove;
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  useEffect(() => {
    const id = drag.addListener(({ value }) => {
      dragValue.current = value;
    });
    return () => {
      drag.removeListener(id);
    };
  }, [drag]);

  const exit = useCallback(
    (velocity: number) => {
      if (settled.current) {
        return;
      }
      settled.current = true;
      Animated.parallel([
        Animated.spring(drag, {
          toValue: -(ENTRY_RISE + 40),
          velocity,
          damping: 30,
          stiffness: 320,
          mass: 0.8,
          useNativeDriver: true
        }),
        Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true })
      ]).start(() => {
        removeRef.current(idRef.current);
      });
    },
    [drag, progress]
  );

  /** Restarts the countdown, so time a card spends under a finger does not count. */
  const scheduleHide = useRef(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    hideTimer.current = setTimeout(() => {
      dismissRef.current(idRef.current);
    }, VISIBLE_MS);
  }).current;

  const holdOpen = useRef(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }).current;

  // Drop in, then retract on its own unless a finger or an explicit dismiss gets there first.
  useEffect(() => {
    Animated.spring(progress, {
      toValue: 1,
      damping: motion.notification.damping,
      stiffness: motion.notification.stiffness,
      mass: motion.notification.mass,
      useNativeDriver: true
    }).start();

    scheduleHide();
    return () => {
      holdOpen();
    };
  }, [holdOpen, progress, scheduleHide]);

  useEffect(() => {
    if (item.exiting) {
      exit(0);
    }
  }, [exit, item.exiting]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 3,
        // A card must not time out while it is being held.
        onPanResponderGrant: () => {
          holdOpen();
        },
        onPanResponderMove: (_event, gesture) => {
          // Upward is the dismiss direction and tracks one-to-one; downward is
          // rubber-banded so the card resists being pulled past its resting place.
          drag.setValue(gesture.dy < 0 ? gesture.dy : Math.sqrt(gesture.dy) * 3);
        },
        onPanResponderRelease: (_event, gesture) => {
          const flung = gesture.vy <= -DISMISS_VELOCITY;
          if (dragValue.current <= -DISMISS_DISTANCE || flung) {
            exit(gesture.vy);
            return;
          }
          scheduleHide();
          Animated.spring(drag, {
            toValue: 0,
            damping: motion.press.damping,
            stiffness: motion.press.stiffness,
            mass: motion.press.mass,
            useNativeDriver: true
          }).start();
        },
        onPanResponderTerminate: () => {
          scheduleHide();
          Animated.spring(drag, { toValue: 0, damping: 24, stiffness: 320, mass: 0.7, useNativeDriver: true }).start();
        }
      }),
    [drag, exit, holdOpen, scheduleHide]
  );

  const accent =
    item.tone === "success"
      ? theme.colors.success
      : item.tone === "error"
      ? theme.colors.danger
      : theme.colors.accent;

  const enterTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-ENTRY_RISE, 0]
  });
  const translateY = Animated.add(enterTranslate, drag);
  // Cards behind the newest one sink back, so a burst reads as a stack.
  const depthScale = 1 - Math.min(depth, 2) * 0.04;
  const scale = Animated.multiply(
    progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, depthScale] }),
    drag.interpolate({
      inputRange: [-DISMISS_DISTANCE * 2, 0],
      outputRange: [0.9, 1],
      extrapolate: "clamp"
    })
  );
  const opacity = Animated.multiply(
    progress,
    drag.interpolate({
      inputRange: [-DISMISS_DISTANCE * 1.6, -DISMISS_DISTANCE * 0.4, 0],
      outputRange: [0, 0.85, 1],
      extrapolate: "clamp"
    })
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      {...(Platform.OS === "web" ? { dataSet: { grab: "true" } } : null)}
      style={[styles.cardWrap, { opacity, transform: [{ translateY }, { scale }] }]}
    >
      <GlassView
        material="regular"
        radius={theme.radius.xl}
        highlight
        elevation="floating"
        style={styles.card}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>
          <Feather name={TONE_ICON[item.tone]} size={16} color={accent} />
        </View>
        <View style={styles.copy}>
          <AppText variant="subheadEmphasized" numberOfLines={1}>
            {item.title}
          </AppText>
          {item.message ? (
            <AppText variant="footnote" tone="secondary" numberOfLines={2}>
              {item.message}
            </AppText>
          ) : null}
        </View>
      </GlassView>
    </Animated.View>
  );
}

/**
 * Renders the notification stack above everything else. Newest first, so a fresh card
 * lands in front and older ones settle behind it.
 */
export function NotificationHost(): JSX.Element | null {
  const items = useNotificationStore((state) => state.items);
  const insets = useSafeAreaInsets();

  if (items.length === 0) {
    return null;
  }

  const ordered = [...items].reverse();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: Math.max(insets.top, 12) + 12 }]}
    >
      {ordered.map((item, index) => (
        <NotificationCard key={item.id} item={item} depth={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: "center",
    gap: 8,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    ...(Platform.OS === "web" ? { zIndex: 60 } : null)
  },
  cardWrap: {
    alignSelf: "center",
    maxWidth: 460,
    width: "92%"
  },
  card: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  copy: {
    flex: 1,
    gap: 2
  }
});
