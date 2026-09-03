import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

interface LoadingSkeletonProps {
  rows?: number;
  height?: number;
}

export function LoadingSkeleton({ rows = 4, height = 74 }: LoadingSkeletonProps): JSX.Element {
  const { theme } = useAppTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 720,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 720,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });

  return (
    <View style={styles.root}>
      {Array.from({ length: rows }).map((_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.row,
            {
              height,
              opacity,
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.glassSoft
            }
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10
  },
  row: {
    width: "100%"
  }
});
