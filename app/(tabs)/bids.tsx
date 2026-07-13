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
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { Bid, BidStatus, proposalValue } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ShareButton } from "@/components/ShareButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  Screen,
  PageHeader,
  Button,
  Row,
  EmptyState,
  LoadingState,
  useInteractive,
  focusRing,
} from "@/components/ui";
import { Colors, Radius, Spacing, Type } from "@/constants/Colors";
import { getTemplate } from "@/lib/templates";

// Ordered to the real proposal lifecycle. Viewed/Accepted are the states the
// trackable link produces — the highest-value ones to filter to for follow-up.
const FILTERS: { key: BidStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "viewed", label: "Viewed" },
  { key: "accepted", label: "Accepted" },
  { key: "pending", label: "Awaiting deposit" },
  { key: "won", label: "Won" },
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
        active && styles.chipActive,
        (hovered || pressed) && !active && { backgroundColor: Colors.surfaceHover },
        focusRing(focused),
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
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
  const [loading, setLoading] = useState(true);
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
    setLoading(false);
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

  const clearFilters = () => {
    setFilter("all");
    setSearch("");
  };

  // Distinguish loading, no-data, and no-match — one generic message can't
  // serve all three (and "New bid" is a non-sequitur when a filter excludes rows).
  const emptyComponent = loading ? (
    <LoadingState />
  ) : bids.length === 0 ? (
    <EmptyState
      message="No proposals yet — generate your first client-ready proposal."
      actionLabel="New proposal"
      onAction={() => router.push("/(tabs)/create")}
    />
  ) : (
    <EmptyState
      message="No proposals match your filters."
      actionLabel="Clear filters"
      onAction={clearFilters}
    />
  );

  return (
    <Screen>
      <PageHeader
        title="Proposals"
        action={
          <Button
            title="New proposal"
            onPress={() => router.push("/(tabs)/create")}
          />
        }
      />
      <View
        style={[styles.searchWrap, searchFocused && { borderColor: Colors.accent }]}
      >
        <Ionicons name="search" size={16} color={Colors.textMuted} />
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
        ListEmptyComponent={emptyComponent}
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontWeight: "400",
    fontSize: Type.body,
    paddingVertical: 10,
  },
  filters: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    fontWeight: "600",
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textSecondary,
  },
  chipTextActive: { color: "#1A1405" },
  list: {
    padding: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  bidRow: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  rowMain: { flex: 1, gap: Spacing.xs },
  rowEnd: { alignItems: "flex-end", gap: 6 },
  client: {
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text,
  },
  meta: {
    fontWeight: "400",
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  amount: {
    fontWeight: "700",
    fontSize: Type.body,
    lineHeight: Math.round(Type.body * 1.4),
    color: Colors.text,
    textAlign: "right",
  },
});
