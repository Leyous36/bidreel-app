/** Small shared UI primitives. */
import React from "react";
import {
  Pressable,
  Text,
  TextInput,
  TextInputProps,
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { Colors, Radius, Spacing } from "@/constants/Colors";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: ButtonProps) {
  const bg =
    variant === "primary"
      ? Colors.accent
      : variant === "danger"
        ? Colors.red
        : Colors.surfaceRaised;
  const fg = variant === "primary" ? "#1A1405" : Colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
}

export function Field({ label, ...inputProps }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={Colors.textMuted}
        style={[styles.input, inputProps.multiline && styles.inputMultiline]}
        {...inputProps}
      />
    </View>
  );
}

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  button: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "700" },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 100, textAlignVertical: "top" },
});
