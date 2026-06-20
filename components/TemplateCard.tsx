import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing } from "@/constants/Colors";
import { Template } from "@/lib/types";

interface Props {
  template: Template;
  locked: boolean;
  onPress: () => void;
}

export function TemplateCard({ template, locked, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name={template.icon as keyof typeof Ionicons.glyphMap}
          size={22}
          color={locked ? Colors.textMuted : Colors.accent}
        />
      </View>
      <View style={styles.titleRow}>
        <Text style={[styles.name, locked && { color: Colors.textMuted }]}>
          {template.name}
        </Text>
        {locked && (
          <Ionicons name="lock-closed" size={14} color={Colors.textMuted} />
        )}
      </View>
      <Text style={styles.desc} numberOfLines={3}>
        {template.description}
      </Text>
      <Text style={styles.rate}>Avg: {template.avgRate}</Text>
    </Pressable>
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
    gap: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: Colors.text, fontSize: 15, fontWeight: "700", flexShrink: 1 },
  desc: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  rate: { color: Colors.accent, fontSize: 12, fontWeight: "600" },
});
