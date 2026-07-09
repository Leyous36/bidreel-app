import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { focusRing, useInteractive } from "@/components/ui";
import { Colors, Fonts, Radius, Spacing, Type } from "@/constants/Colors";

interface Props {
  label: string;
  value: string;
  /** Accepted for caller compatibility; decorative icon badges are gone. */
  icon?: string;
  /** Accepted for caller compatibility; cards are grayscale now. */
  tint?: string;
  /** Small top-right trend text, e.g. "+3 this wk". Hidden when null. */
  delta?: string | null;
  deltaPositive?: boolean;
  /** Muted line under the value. */
  footnote?: string;
  /** Bottom visual — a Sparkline, meter, or bars. */
  children?: React.ReactNode;
  onPress?: () => void;
}

/**
 * KPI card: 13px medium grayscale label, optional trend delta, 16px semibold
 * value (weight, not size, does the hierarchy), optional footnote, and a
 * bottom visual slot. Flat surface — no border, no shadow; hover lightens the
 * background when pressable.
 */
export function StatCard({
  label,
  value,
  delta,
  deltaPositive = true,
  footnote,
  children,
  onPress,
}: Props) {
  const { hovered, focused, handlers } = useInteractive();

  const body = (
    <>
      <View style={styles.head}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
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

      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      {footnote ? <Text style={styles.foot}>{footnote}</Text> : null}
      {children ? <View style={{ marginTop: Spacing.sm }}>{children}</View> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.card}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      {...handlers}
      style={({ pressed }) => [
        styles.card,
        (hovered || pressed) && { backgroundColor: Colors.surfaceHover },
        focusRing(focused),
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    letterSpacing: Type.trackUi,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  delta: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
  },
  value: {
    fontFamily: Fonts.semibold,
    fontSize: Type.heading,
    lineHeight: Math.round(Type.heading * 1.4),
    letterSpacing: Type.trackHeading,
    color: Colors.text,
  },
  foot: {
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
});
