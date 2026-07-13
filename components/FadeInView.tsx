import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";

/**
 * Fades + slides its children up on mount. Give staggered `delay` values to
 * neighbouring elements for a cascading entrance. Works on native and web
 * (touch-friendly motion — no hover required).
 */
export function FadeInView({
  children,
  delay = 0,
  distance = 12,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 340,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 340,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
