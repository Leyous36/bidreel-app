import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "@/components/ui";
import { Colors, Fonts, Radius, Spacing, Type } from "@/constants/Colors";

/**
 * Inline "couldn't load" banner with a Retry action. Shown when a data fetch
 * fails so the screen doesn't silently render as if there were simply no data.
 */
export function ErrorBanner({
  message = "Couldn't load. Check your connection.",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
      <Button title="Retry" variant="secondary" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 40,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  text: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.red,
  },
});
