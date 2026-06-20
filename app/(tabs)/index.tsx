import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Bid } from "@/lib/types";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Screen } from "@/components/ui";
import { Colors, Radius, Spacing } from "@/constants/Colors";

export default function DashboardScreen() {
  const { session, profile } = useAuth();
  const [bids, setBids] = useState<Bid[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from("bids")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setBids(data as Bid[]);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const total = bids.length;
  const won = bids.filter((b) => b.status === "won");
  const decided = bids.filter((b) => b.status === "won" || b.status === "lost");
  const winRate =
    decided.length > 0
      ? Math.round((won.length / decided.length) * 100) + "%"
      : "—";
  const revenueWon = won.reduce(
    (sum, b) => sum + (b.proposal?.investment?.total ?? b.budget ?? 0),
    0,
  );
  const pipeline = bids
    .filter((b) => ["sent", "viewed", "pending"].includes(b.status))
    .reduce(
      (sum, b) => sum + (b.proposal?.investment?.total ?? b.budget ?? 0),
      0,
    );

  return (
    <Screen>
      <FlatList
        data={bids.slice(0, 10)}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={Colors.accent}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.greeting}>
              {profile?.company_name ?? "Your studio"}
            </Text>
            <View style={styles.metrics}>
              <MetricCard label="Total Bids" value={String(total)} icon="documents" tint={Colors.blue} />
              <MetricCard label="Win Rate" value={winRate} icon="trophy" tint={Colors.green} />
              <MetricCard
                label="Revenue Won"
                value={`$${revenueWon.toLocaleString()}`}
                icon="cash"
                tint={Colors.accent}
              />
              <MetricCard
                label="Pipeline"
                value={`$${pipeline.toLocaleString()}`}
                icon="trending-up"
                tint={Colors.purple}
              />
            </View>
            <Text style={styles.sectionTitle}>Recent Bids</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No bids yet</Text>
            <Text style={styles.emptyText}>
              Tap New Bid to generate your first proposal in under 60 seconds.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.bidRow, pressed && { opacity: 0.8 }]}
            onPress={() => router.push(`/bid/${item.id}`)}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.bidClient}>{item.client_name}</Text>
              <Text style={styles.bidDate}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Text style={styles.bidAmount}>
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
  list: { padding: Spacing.md, gap: Spacing.sm },
  header: { gap: Spacing.md, marginBottom: Spacing.sm },
  greeting: { color: Colors.text, fontSize: 24, fontWeight: "800" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: Spacing.sm,
  },
  bidRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  bidClient: { color: Colors.text, fontSize: 16, fontWeight: "700" },
  bidDate: { color: Colors.textMuted, fontSize: 12 },
  bidAmount: { color: Colors.text, fontSize: 15, fontWeight: "700" },
  empty: { alignItems: "center", padding: Spacing.xl, gap: 8 },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: "700" },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
