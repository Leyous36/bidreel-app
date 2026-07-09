import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Lock } from "lucide-react-native";
import { Colors, Fonts, Radius, Spacing, Type } from "@/constants/Colors";
import { focusRing, useInteractive } from "@/components/ui";
import { Template } from "@/lib/types";

interface Props {
  template: Template;
  locked: boolean;
  onPress: () => void;
  selected?: boolean;
}

export function TemplateCard({ template, locked, onPress, selected }: Props) {
  const { hovered, focused, handlers } = useInteractive();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      {...handlers}
      style={({ pressed }) => [
        styles.card,
        selected && { backgroundColor: Colors.accentMuted },
        (hovered || pressed) &&
          !selected && { backgroundColor: Colors.surfaceHover },
        focusRing(focused),
      ]}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.name, locked && { color: Colors.textMuted }]}>
          {template.name}
        </Text>
        {locked && <Lock size={16} color={Colors.textMuted} strokeWidth={1.75} />}
      </View>
      <Text style={styles.desc} numberOfLines={3}>
        {template.description}
      </Text>
      <Text style={styles.meta}>Avg: {template.avgRate}</Text>
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
    gap: Spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  name: {
    fontFamily: Fonts.medium,
    fontSize: Type.body,
    lineHeight: Math.round(Type.body * 1.4),
    letterSpacing: Type.trackUi,
    color: Colors.text,
    flexShrink: 1,
  },
  desc: {
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textSecondary,
  },
  meta: {
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textMuted,
  },
});
