import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { Bid, BidStatus } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Screen } from "@/components/ui";
import { Colors, Radius, Spacing } from "@/constants/Colors";
import { getTemplate } from "@/lib/templates";

const FILTERS: Array<{ key: BidStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "won", label: "Won" },
  { key: "pending", label: "Pending" },
  { key: "sent", label: "Sent" },
  { key: "draft", label: "Drafts" },
  { key: "lost", label: "Lost" },
];

export default function BidsScreen() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [filter, setFilter] = useState<BidStatus | "all">("all");
  const [search, setSearch] = useState("");
  const router = useRouter();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("bids")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setBids(data as Bid[]);
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
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by client name"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === f.key && styles.filterTextActive,
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={visible}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No bids match.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
            onPress={() => router.push(`/bid/${item.id}`)}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.client}>{item.client_name}</Text>
              <Text style={styles.meta}>
                {getTemplate(item.template_id)?.name ?? item.template_id} ·{" "}
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Text style={styles.amount}>
                $
                {(
                  item.proposal?.investment?.total ??
                  item.budget ??
                  0
                ).toLocaleString()}
              </Text>
              <StatusBadge status={item.status} />
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    margin: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  searchInput: { flex: 1, color: Colors.text, paddingVertical: 10, fontSize: 15 },
  filters: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  filterTextActive: { color: "#1A1405" },
  list: { padding: Spacing.md, gap: Spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  client: { color: Colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: Colors.textMuted, fontSize: 12 },
  amount: { color: Colors.text, fontSize: 15, fontWeight: "700" },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: "center",
    padding: Spacing.xl,
  },
});
