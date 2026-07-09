import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  Pressable,
  TextInput,
  TextStyle,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Search } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Bid, BidStatus, proposalValue } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ShareButton } from "@/components/ShareButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  Screen,
  PageHeader,
  Row,
  EmptyState,
  useInteractive,
  focusRing,
} from "@/components/ui";
import { Colors, Fonts, Radius, Spacing, Type } from "@/constants/Colors";
import { getTemplate } from "@/lib/templates";

const FILTERS: { key: BidStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "won", label: "Won" },
  { key: "pending", label: "Pending" },
  { key: "sent", label: "Sent" },
  { key: "draft", label: "Drafts" },
  { key: "lost", label: "Lost" },
];

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { hovered, focused, handlers } = useInteractive();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      {...handlers}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: Colors.accentMuted },
        (hovered || pressed) && !active && { backgroundColor: Colors.surfaceHover },
        focusRing(focused),
      ]}
    >
      <Text style={[styles.chipText, active && { color: Colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function BidsScreen() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [filter, setFilter] = useState<BidStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("bids")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(true);
    } else {
      setBids(data as Bid[]);
      setLoadError(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const visible = bids.filter((b) => {
    if (filter !== "all" && b.status !== filter) return false;
    if (search && !b.client_name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <Screen>
      <PageHeader title="Bids" />
      <View
        style={[styles.searchWrap, searchFocused && { borderColor: Colors.accent }]}
      >
        <Search size={16} color={Colors.textMuted} strokeWidth={1.75} />
        <TextInput
          style={[
            styles.searchInput,
            Platform.OS === "web" &&
              ({ outlineStyle: "none" } as unknown as TextStyle),
          ]}
          placeholder="Search by client name"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </View>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              active={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>
      {loadError ? <ErrorBanner onRetry={load} /> : null}
      <FlatList
        data={visible}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            message="No bids match."
            actionLabel="New bid"
            onAction={() => router.push("/(tabs)/create")}
          />
        }
        renderItem={({ item }) => (
          <Row style={styles.bidRow} onPress={() => router.push(`/bid/${item.id}`)}>
            <View style={styles.rowMain}>
              <Text style={styles.client}>{item.client_name}</Text>
              <Text style={styles.meta}>
                {getTemplate(item.template_id)?.name ?? item.template_id} ·{" "}
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.rowEnd}>
              <Text style={styles.amount}>
                $
                {(
                  proposalValue(item.proposal) ||
                  item.budget ||
                  0
                ).toLocaleString()}
              </Text>
              <StatusBadge status={item.status} />
            </View>
            <ShareButton
              bid={item}
              onShared={(patch) =>
                setBids((prev) =>
                  prev.map((b) => (b.id === item.id ? { ...b, ...patch } : b)),
                )
              }
            />
          </Row>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    height: 36,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: Type.body,
    paddingVertical: 0,
  },
  filters: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  chip: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    letterSpacing: Type.trackUi,
    color: Colors.textSecondary,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  bidRow: { paddingVertical: Spacing.sm },
  rowMain: { flex: 1, gap: Spacing.xxs },
  rowEnd: { alignItems: "flex-end", gap: Spacing.xs },
  client: {
    fontFamily: Fonts.medium,
    fontSize: Type.body,
    lineHeight: Math.round(Type.body * 1.4),
    color: Colors.text,
  },
  meta: {
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textMuted,
  },
  amount: {
    fontFamily: Fonts.medium,
    fontSize: Type.body,
    lineHeight: Math.round(Type.body * 1.4),
    color: Colors.text,
    textAlign: "right",
  },
});
