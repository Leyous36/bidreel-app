import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing } from "@/constants/Colors";

interface Props {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint?: string;
  /** Small top-right trend badge, e.g. "+3 this wk". Hidden when null. */
  delta?: string | null;
  deltaPositive?: boolean;
  /** Muted line under the value. */
  footnote?: string;
  /** Bottom visual — a Sparkline, meter, or bars. */
  children?: React.ReactNode;
}

/**
 * Enhanced KPI card: icon + label, optional trend delta, big value, an optional
 * footnote, and a bottom visual slot. Replaces the old flat MetricCard on the
 * dashboard.
 */
export function StatCard({
  label,
  value,
  icon,
  tint = Colors.accent,
  delta,
  deltaPositive = true,
  footnote,
  children,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.labelWrap}>
          <View style={[styles.iconWrap, { backgroundColor: tint + "22" }]}>
            <Ionicons name={icon} size={15} color={tint} />
          </View>
          <Text style={styles.label}>{label}</Text>
        </View>
        {delta ? (
          <Text
            style={[
              styles.delta,
              { color: deltaPositive ? Colors.green : Colors.textSecondary },
            ]}
          >
            {delta}
          </Text>
        ) : null}
      </View>

      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {footnote ? <Text style={styles.foot}>{footnote}</Text> : null}
      {children ? <View style={{ marginTop: 10 }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  labelWrap: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { color: Colors.textSecondary, fontSize: 12.5, flexShrink: 1 },
  delta: { fontSize: 11.5, fontWeight: "700" },
  value: { color: Colors.text, fontSize: 24, fontWeight: "800" },
  foot: { color: Colors.textMuted, fontSize: 11.5, marginTop: 4 },
});
