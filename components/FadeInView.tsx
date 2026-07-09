import React, { useEffect, useRef } from "react";
import { Animated, Easing, ViewStyle } from "react-native";
import { Motion } from "@/constants/Colors";

/**
 * Fades its children in on mount — 120ms ease-out, no translation.
 * (Motion rules: 100–150ms ease-out only; nothing slides in.)
 * `delay` and `distance` are kept for call-site compatibility; distance is
 * intentionally ignored.
 */
export function FadeInView({
  children,
  delay = 0,
  distance: _distance,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: Motion.fast,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [delay, opacity]);

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}
