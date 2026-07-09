import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, Fonts, Radius, Spacing, Type } from "@/constants/Colors";
import { BidStatus, STATUS_LABELS } from "@/lib/types";

/** 8px status-hue dot + grayscale label. No pill fills, no colored text. */
export function StatusBadge({ status }: { status: BidStatus }) {
  const color = Colors.status[status] ?? Colors.textMuted;
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.label}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    alignSelf: "flex-start",
  },
  dot: { width: 8, height: 8, borderRadius: Radius.pill },
  label: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textSecondary,
  },
});
