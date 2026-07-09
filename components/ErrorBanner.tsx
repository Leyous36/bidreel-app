import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing } from "@/constants/Colors";

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
      <Ionicons name="cloud-offline-outline" size={16} color={Colors.red} />
      <Text style={styles.text}>{message}</Text>
      <Pressable onPress={onRetry} hitSlop={8}>
        <Text style={styles.retry}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.red + "1A",
    borderWidth: 1,
    borderColor: Colors.red + "55",
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  text: { flex: 1, color: Colors.text, fontSize: 13 },
  retry: { color: Colors.red, fontSize: 13, fontWeight: "700" },
});
