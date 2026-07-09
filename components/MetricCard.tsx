import React from "react";
import { Text, StyleSheet } from "react-native";
import { Card } from "@/components/ui";
import { Colors, Fonts, Spacing, Type } from "@/constants/Colors";

interface Props {
  label: string;
  value: string;
  /** Accepted for caller compatibility; decorative icon badges are gone. */
  icon?: string;
  /** Accepted for caller compatibility; cards are grayscale now. */
  tint?: string;
}

/** Flat KPI card: 13px medium grayscale label over a 16px semibold value. */
export function MetricCard({ label, value }: Props) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "45%",
    gap: Spacing.xs,
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    letterSpacing: Type.trackUi,
    color: Colors.textSecondary,
  },
  value: {
    fontFamily: Fonts.semibold,
    fontSize: Type.heading,
    lineHeight: Math.round(Type.heading * 1.4),
    letterSpacing: Type.trackHeading,
    color: Colors.text,
  },
});
