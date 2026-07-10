/**
 * Web sidebar navigation (wide viewports). 232px, collapsible to icon rail.
 * Nav rows are 36px with hover lightening and accent-tinted active state —
 * the sidebar itself sits one surface step above the app background.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import {
  BarChart3,
  FileText,
  LayoutGrid,
  PanelLeft,
  Plus,
  Search,
  Settings,
} from "lucide-react-native";
import { focusRing, useInteractive } from "@/components/ui";
import { openCommandPalette } from "@/lib/web-styles";
import { Colors, Fonts, Radius, Spacing, Type } from "@/constants/Colors";

const NAV = [
  { path: "/", label: "Dashboard", Icon: LayoutGrid },
  { path: "/bids", label: "Proposals", Icon: FileText },
  { path: "/insights", label: "Insights", Icon: BarChart3 },
  { path: "/settings", label: "Settings", Icon: Settings },
] as const;

const COLLAPSE_KEY = "bidreel.sidebar.collapsed";

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((v) => {
      if (Platform.OS === "web" && typeof localStorage !== "undefined") {
        localStorage.setItem(COLLAPSE_KEY, v ? "0" : "1");
      }
      return !v;
    });
  }, []);

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      <View style={styles.top}>
        {!collapsed && <Text style={styles.wordmark}>BidReel</Text>}
        <SidebarRow
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          collapsed
          onPress={toggle}
        >
          <PanelLeft size={16} color={Colors.textSecondary} strokeWidth={1.75} />
        </SidebarRow>
      </View>

      <NewBidButton collapsed={collapsed} onPress={() => router.push("/create")} />

      <SidebarRow
        label="Search"
        hint="⌘K"
        collapsed={collapsed}
        onPress={openCommandPalette}
      >
        <Search size={16} color={Colors.textSecondary} strokeWidth={1.75} />
      </SidebarRow>

      <View style={styles.nav}>
        {NAV.map(({ path, label, Icon }) => {
          const active = pathname === path;
          return (
            <SidebarRow
              key={path}
              label={label}
              collapsed={collapsed}
              active={active}
              onPress={() => router.push(path as never)}
            >
              <Icon
                size={16}
                color={active ? Colors.text : Colors.textSecondary}
                strokeWidth={1.75}
              />
            </SidebarRow>
          );
        })}
      </View>
    </View>
  );
}

function SidebarRow({
  children,
  label,
  hint,
  collapsed,
  active,
  onPress,
}: {
  children: React.ReactNode;
  label: string;
  hint?: string;
  collapsed?: boolean;
  active?: boolean;
  onPress: () => void;
}) {
  const { hovered, focused, handlers } = useInteractive();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      {...handlers}
      style={[
        styles.navRow,
        collapsed && styles.navRowCollapsed,
        active && { backgroundColor: Colors.accentMuted },
        hovered && !active && { backgroundColor: Colors.surfaceHover },
        focusRing(focused),
      ]}
    >
      {children}
      {!collapsed && (
        <Text style={[styles.navLabel, active && { color: Colors.text }]}>
          {label}
        </Text>
      )}
      {!collapsed && hint ? <Text style={styles.navHint}>{hint}</Text> : null}
    </Pressable>
  );
}

function NewBidButton({
  collapsed,
  onPress,
}: {
  collapsed: boolean;
  onPress: () => void;
}) {
  const { hovered, focused, handlers } = useInteractive();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New proposal"
      onPress={onPress}
      {...handlers}
      style={[
        styles.newBid,
        collapsed && styles.navRowCollapsed,
        { backgroundColor: hovered ? Colors.accentHover : Colors.accent },
        focusRing(focused),
      ]}
    >
      <Plus size={16} color="#FFFFFF" strokeWidth={1.75} />
      {!collapsed && <Text style={styles.newBidLabel}>New proposal</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 232,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  sidebarCollapsed: { width: 56 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    paddingLeft: Spacing.xs,
  },
  wordmark: {
    fontFamily: Fonts.semibold,
    fontSize: Type.ui,
    letterSpacing: Type.trackUi,
    color: Colors.text,
    paddingLeft: Spacing.sm,
  },
  nav: { marginTop: Spacing.md, gap: 2 },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm + 2,
    height: 36,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.md,
  },
  navRowCollapsed: { justifyContent: "center", paddingHorizontal: 0 },
  navLabel: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    letterSpacing: Type.trackUi,
    color: Colors.textSecondary,
  },
  navHint: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  newBid: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm + 2,
    height: 32,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },
  newBidLabel: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    letterSpacing: Type.trackUi,
    color: "#FFFFFF",
  },
});
