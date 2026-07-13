import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, Radius } from "@/constants/Colors";
import { BidStatus, STATUS_LABELS } from "@/lib/types";

export function StatusBadge({ status }: { status: BidStatus }) {
  const color = Colors.status[status] ?? Colors.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    gap: 6,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 12, fontWeight: "600" },
});
