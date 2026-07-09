/**
 * Shared UI primitives — the Linear-language kit.
 *
 * Rules encoded here so screens don't re-derive them:
 * - Buttons: 32px tall, 6px radius, 13px/500 labels. Secondary gets a subtle
 *   1px border; primary is the only accent-filled element on a screen.
 * - Rows: 40px tall, hover lightens the background ~4%, no borders.
 * - Every interactive element: hover state + visible keyboard focus ring.
 * - Empty states: one sentence, one action.
 * - Progressive disclosure: secondary actions live behind an OverflowMenu.
 */
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { MoreHorizontal } from "lucide-react-native";
import {
  Colors,
  Fonts,
  Radius,
  Shadow,
  Spacing,
  Type,
} from "@/constants/Colors";

/* ------------------------------------------------------------------ */
/* Interaction helpers                                                 */
/* ------------------------------------------------------------------ */

export interface InteractiveState {
  hovered: boolean;
  focused: boolean;
  handlers: Partial<PressableProps>;
}

/** Hover + keyboard-focus tracking (web); inert on native. */
export function useInteractive(): InteractiveState {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const handlers: Partial<PressableProps> =
    Platform.OS === "web"
      ? ({
          onHoverIn: () => setHovered(true),
          onHoverOut: () => setHovered(false),
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
        } as Partial<PressableProps>)
      : {};
  return { hovered, focused, handlers };
}

/** Visible keyboard focus ring (web only — outline props are a no-op on native). */
export function focusRing(focused: boolean): ViewStyle {
  if (!focused || Platform.OS !== "web") return {};
  return {
    outlineWidth: 2,
    outlineColor: Colors.accent,
    outlineStyle: "solid",
    outlineOffset: 1,
  } as ViewStyle;
}

/* ------------------------------------------------------------------ */
/* Text styles — weight does the hierarchy work, not size              */
/* ------------------------------------------------------------------ */

export const text = StyleSheet.create({
  heading: {
    fontFamily: Fonts.semibold,
    fontSize: Type.heading,
    lineHeight: Math.round(Type.heading * 1.4),
    letterSpacing: Type.trackHeading,
    color: Colors.text,
  },
  title: {
    fontFamily: Fonts.semibold,
    fontSize: Type.bodyLg,
    lineHeight: Math.round(Type.bodyLg * 1.4),
    letterSpacing: Type.trackUi,
    color: Colors.text,
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textSecondary,
  },
  body: {
    fontFamily: Fonts.regular,
    fontSize: Type.body,
    lineHeight: Math.round(Type.body * 1.4),
    color: Colors.text,
  },
  bodyLg: {
    fontFamily: Fonts.regular,
    fontSize: Type.bodyLg,
    lineHeight: Math.round(Type.bodyLg * 1.4),
    color: Colors.text,
  },
  muted: {
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textMuted,
  },
  ui: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.text,
  },
});

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.screen}>
      <View style={styles.screenInner}>{children}</View>
    </View>
  );
}

/**
 * In-content page title. Rendered on web only — native screens keep their
 * navigation headers, web hides them (the sidebar carries context).
 */
export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  if (Platform.OS !== "web") return null;
  return (
    <View style={styles.pageHeader}>
      <Text style={text.heading}>{title}</Text>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

/** Raised region. Separation comes from the background shift, not a border. */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** The rare explicit divider: 1px at 8% white. */
export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.hairline, style]} />;
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
}: ButtonProps) {
  const { hovered, focused, handlers } = useInteractive();

  const base: ViewStyle =
    variant === "primary"
      ? { backgroundColor: hovered ? Colors.accentHover : Colors.accent }
      : variant === "ghost"
        ? { backgroundColor: hovered ? Colors.surfaceHover : "transparent" }
        : {
            backgroundColor: hovered ? Colors.surfaceHover : Colors.surface,
            borderWidth: 1,
            borderColor: Colors.border,
          };
  const labelColor =
    variant === "primary"
      ? "#FFFFFF"
      : variant === "danger"
        ? Colors.red
        : hovered
          ? Colors.text
          : Colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      {...handlers}
      style={({ pressed }) => [
        styles.button,
        base,
        focusRing(focused),
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        <>
          {icon}
          <Text style={[styles.buttonText, { color: labelColor }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Icon-only 28px ghost button (toolbar actions, "···" triggers). */
export const IconButton = React.forwardRef<View, {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  disabled?: boolean;
}>(function IconButton({ children, onPress, label, disabled }, ref) {
  const { hovered, focused, handlers } = useInteractive();
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      {...handlers}
      style={({ pressed }) => [
        styles.iconButton,
        hovered && { backgroundColor: Colors.surfaceHover },
        focusRing(focused),
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {children}
    </Pressable>
  );
});

/* ------------------------------------------------------------------ */
/* Forms                                                               */
/* ------------------------------------------------------------------ */

interface FieldProps extends TextInputProps {
  label: string;
}

export function Field({ label, ...inputProps }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={text.label}>{label}</Text>
      <TextInput
        placeholderTextColor={Colors.textMuted}
        {...inputProps}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        style={[
          styles.input,
          inputProps.multiline && styles.inputMultiline,
          focused && styles.inputFocused,
          Platform.OS === "web" &&
            ({ outlineStyle: "none" } as unknown as TextStyle),
          inputProps.style,
        ]}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Rows & lists                                                        */
/* ------------------------------------------------------------------ */

interface RowProps {
  children: React.ReactNode;
  onPress?: () => void;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * 40px interactive list row. Hover lightens the background; no borders.
 *
 * A row navigates but often *contains* its own action buttons (share, copy),
 * so it must NOT render as a `<button>` — nested `<button>`s are invalid HTML
 * and break hydration on web. We render a focusable generic element with a
 * `link` role (rows open a detail view) and keep Enter/Space activation.
 */
export function Row({ children, onPress, active, style }: RowProps) {
  const { hovered, focused, handlers } = useInteractive();
  if (!onPress) {
    return <View style={[styles.row, style]}>{children}</View>;
  }
  const webA11y =
    Platform.OS === "web"
      ? ({
          accessibilityRole: "link",
          // RNW renders role="link" as a focusable <span>, not <button>, so a
          // nested action button inside stays valid. Wire keyboard activation.
          onKeyDown: (e: { key?: string; preventDefault?: () => void }) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault?.();
              onPress();
            }
          },
        } as object)
      : { accessibilityRole: "button" as const };
  return (
    <Pressable
      {...webA11y}
      focusable
      onPress={onPress}
      {...handlers}
      style={({ pressed }) => [
        styles.row,
        active && { backgroundColor: Colors.accentMuted },
        (hovered || pressed) && !active && { backgroundColor: Colors.surfaceHover },
        focusRing(focused),
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

/** One sentence and one action. Never illustrations. */
export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={[text.body, { color: Colors.textSecondary }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Overflow menu — progressive disclosure behind "···"                 */
/* ------------------------------------------------------------------ */

export interface MenuItem {
  label: string;
  onPress: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
}

export function OverflowMenu({ items }: { items: MenuItem[] }) {
  const anchor = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const openMenu = useCallback(() => {
    anchor.current?.measureInWindow((x, y, w, h) => {
      setPos({ top: y + h + 4, right: Math.max(Spacing.sm, windowWidth() - x - w) });
      setOpen(true);
    });
  }, []);

  return (
    <>
      <IconButton ref={anchor} label="More actions" onPress={openMenu}>
        <MoreHorizontal size={16} color={Colors.textSecondary} strokeWidth={1.75} />
      </IconButton>
      <Modal transparent visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: pos.top, right: pos.right }]}>
            {items.map((item) => (
              <MenuRow key={item.label} item={item} close={() => setOpen(false)} />
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function MenuRow({ item, close }: { item: MenuItem; close: () => void }) {
  const { hovered, focused, handlers } = useInteractive();
  return (
    <Pressable
      accessibilityRole="menuitem"
      onPress={() => {
        close();
        item.onPress();
      }}
      {...handlers}
      style={({ pressed }) => [
        styles.menuRow,
        (hovered || pressed) && { backgroundColor: Colors.surfaceHover },
        focusRing(focused),
      ]}
    >
      {item.icon}
      <Text style={[text.ui, item.danger && { color: Colors.red }]}>{item.label}</Text>
    </Pressable>
  );
}

function windowWidth(): number {
  if (Platform.OS === "web" && typeof window !== "undefined") return window.innerWidth;
  return Dimensions.get("window").width;
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  screenInner: {
    flex: 1,
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  hairline: { height: 1, backgroundColor: Colors.border },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm - 2,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
  },
  buttonText: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    letterSpacing: Type.trackUi,
  },
  iconButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },
  fieldWrap: { gap: 6 },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: Type.body,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: "top" },
  inputFocused: { borderColor: Colors.accent },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
  },
  empty: {
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  menuBackdrop: { flex: 1 },
  menu: {
    position: "absolute",
    minWidth: 180,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.xs,
    ...Shadow.overlay,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 36,
    paddingHorizontal: 12,
    marginHorizontal: Spacing.xs,
    borderRadius: Radius.sm,
  },
});
