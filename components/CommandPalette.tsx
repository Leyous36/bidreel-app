/**
 * Cmd+K command palette — primary navigation/actions on web.
 * Opens with Cmd/Ctrl+K or the sidebar search row; closes with Escape.
 * Arrow keys + Enter to run; also searches recent bids by client name.
 * Renders nothing on native.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowUpRight,
  BarChart3,
  FileText,
  LayoutGrid,
  Plus,
  Settings,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { STATUS_LABELS, BidStatus } from "@/lib/types";
import {
  Colors,
  Fonts,
  Radius,
  Shadow,
  Spacing,
  Type,
} from "@/constants/Colors";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

const ICON = { size: 16, strokeWidth: 1.75, color: Colors.textSecondary };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [bids, setBids] = useState<
    { id: string; client_name: string; status: BidStatus }[]
  >([]);
  const inputRef = useRef<TextInput>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelected(0);
  }, []);

  // Global shortcuts + the sidebar's "Search" row.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        close();
      }
    };
    const onOpenEvent = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("bidreel:palette", onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("bidreel:palette", onOpenEvent);
    };
  }, [close]);

  // Recent bids for entity search, fetched when the palette opens.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    supabase
      .from("bids")
      .select("id, client_name, status")
      .order("created_at", { ascending: false })
      .limit(25)
      .then(({ data }) => {
        if (data) setBids(data as typeof bids);
      });
  }, [open]);

  const go = useCallback(
    (path: string) => {
      close();
      router.push(path as never);
    },
    [close, router],
  );

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = [
      {
        id: "new-bid",
        label: "New proposal",
        hint: "Create",
        icon: <Plus {...ICON} />,
        run: () => go("/(tabs)/create"),
      },
      {
        id: "dashboard",
        label: "Go to Dashboard",
        icon: <LayoutGrid {...ICON} />,
        run: () => go("/(tabs)"),
      },
      {
        id: "bids",
        label: "Go to Proposals",
        icon: <FileText {...ICON} />,
        run: () => go("/(tabs)/bids"),
      },
      {
        id: "insights",
        label: "Go to Insights",
        icon: <BarChart3 {...ICON} />,
        run: () => go("/(tabs)/insights"),
      },
      {
        id: "settings",
        label: "Go to Settings",
        icon: <Settings {...ICON} />,
        run: () => go("/(tabs)/settings"),
      },
    ];
    const bidCommands: Command[] = bids.map((b) => ({
      id: `bid-${b.id}`,
      label: b.client_name,
      hint: STATUS_LABELS[b.status],
      icon: <ArrowUpRight {...ICON} />,
      run: () => go(`/bid/${b.id}`),
    }));
    const q = query.trim().toLowerCase();
    const all = [...nav, ...bidCommands];
    if (!q) return [...nav, ...bidCommands.slice(0, 5)];
    return all.filter((c) => c.label.toLowerCase().includes(q));
  }, [bids, query, go]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  if (Platform.OS !== "web" || !open) return null;

  const onSubmit = () => commands[selected]?.run();

  return (
    <View style={styles.backdropWrap} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.panel}>
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Type a command or search proposals"
          placeholderTextColor={Colors.textMuted}
          style={[styles.input, { outlineStyle: "none" } as object]}
          onSubmitEditing={onSubmit}
          onKeyPress={(e) => {
            const key = (e.nativeEvent as { key: string }).key;
            if (key === "ArrowDown") {
              setSelected((s) => Math.min(s + 1, commands.length - 1));
            } else if (key === "ArrowUp") {
              setSelected((s) => Math.max(s - 1, 0));
            }
          }}
        />
        <View style={styles.hairline} />
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {commands.length === 0 ? (
            <Text style={styles.emptyText}>No matches.</Text>
          ) : (
            commands.map((c, i) => (
              <PaletteRow
                key={c.id}
                command={c}
                active={i === selected}
                onHover={() => setSelected(i)}
              />
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function PaletteRow({
  command,
  active,
  onHover,
}: {
  command: Command;
  active: boolean;
  onHover: () => void;
}) {
  const hoverProps =
    Platform.OS === "web" ? ({ onHoverIn: onHover } as object) : {};
  return (
    <Pressable
      accessibilityRole="button"
      onPress={command.run}
      {...hoverProps}
      style={[styles.row, active && { backgroundColor: Colors.surfaceHover }]}
    >
      {command.icon}
      <Text style={styles.rowLabel} numberOfLines={1}>
        {command.label}
      </Text>
      {command.hint ? <Text style={styles.rowHint}>{command.hint}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdropWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  panel: {
    marginTop: 120,
    width: "100%",
    maxWidth: 560,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    ...Shadow.overlay,
  },
  input: {
    height: 44,
    paddingHorizontal: Spacing.md,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: Type.bodyLg,
  },
  hairline: { height: 1, backgroundColor: Colors.border },
  list: { maxHeight: 320, paddingVertical: Spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm + 2,
    minHeight: 38,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.xs,
    borderRadius: Radius.md,
  },
  rowLabel: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: Type.body,
    color: Colors.text,
  },
  rowHint: {
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    color: Colors.textMuted,
  },
  emptyText: {
    fontFamily: Fonts.regular,
    fontSize: Type.body,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },
});
