import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Bid } from "@/lib/types";
import { StatCard } from "@/components/StatCard";
import { Sparkline } from "@/components/Sparkline";
import { FadeInView } from "@/components/FadeInView";
import { StatusBadge } from "@/components/StatusBadge";
import { Screen } from "@/components/ui";
import { Colors, Radius, Spacing } from "@/constants/Colors";

type Range = "month" | "all";

const WEEK = 7 * 24 * 60 * 60 * 1000;

// On web, animate transform/background smoothly on hover; ignored on native.
const webTransition =
  Platform.OS === "web"
    ? ({
        transitionDuration: "150ms",
        transitionProperty: "transform, background-color, border-color",
      } as any)
    : null;

function amountOf(b: Bid): number {
  return b.proposal?.investment?.total ?? b.budget ?? 0;
}

/** Cumulative weekly buckets for a mini trend line (oldest → newest). */
function weeklyCumulative(
  items: Bid[],
  valueFn: (b: Bid) => number,
  weeks = 6,
): number[] {
  const now = Date.now();
  const buckets = new Array(weeks).fill(0);
  for (const b of items) {
    const age = now - new Date(b.created_at).getTime();
    const idx = Math.floor(age / WEEK);
    if (idx >= 0 && idx < weeks) buckets[weeks - 1 - idx] += valueFn(b);
  }
  let run = 0;
  return buckets.map((v) => (run += v));
}

function shortMoney(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `$${n}`;
}

function initials(name: string): string {
  const parts = (name || "").trim().split(/\s+/);
  const s = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return s.toUpperCase() || "?";
}

const NUDGE_SUB: Record<string, string> = {
  accepted: "Send the payment link to lock it in",
  opened: "They're interested — reply while it's warm",
  sent: "Nudge them with a friendly follow-up",
};

export default function DashboardScreen() {
  const { session, profile } = useAuth();
  const [bids, setBids] = useState<Bid[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<Range>("month");
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

  // Metrics respect the This month / All time toggle; the trend sparklines and
  // deltas always use the full history so the lines have shape.
  const scoped = useMemo(() => {
    if (range === "all") return bids;
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    return bids.filter((b) => new Date(b.created_at).getTime() >= start);
  }, [bids, range]);

  const won = scoped.filter((b) => b.status === "won");
  const decided = scoped.filter((b) => b.status === "won" || b.status === "lost");
  const winPct =
    decided.length > 0 ? Math.round((won.length / decided.length) * 100) : 0;
  const revenueWon = won.reduce((s, b) => s + amountOf(b), 0);
  const openBids = scoped.filter((b) =>
    ["sent", "viewed", "pending", "accepted"].includes(b.status),
  );
  const pipeline = openBids.reduce((s, b) => s + amountOf(b), 0);

  // Honest deltas from the last 7 days (hidden when zero).
  const weekAgo = Date.now() - WEEK;
  const newThisWeek = bids.filter(
    (b) => new Date(b.created_at).getTime() >= weekAgo,
  ).length;
  const revThisWeek = bids
    .filter((b) => b.status === "won" && new Date(b.created_at).getTime() >= weekAgo)
    .reduce((s, b) => s + amountOf(b), 0);

  const bidsSeries = weeklyCumulative(bids, () => 1);
  const revSeries = weeklyCumulative(bids, (b) =>
    b.status === "won" ? amountOf(b) : 0,
  );

  // Pipeline-by-stage segments (only non-empty ones render).
  const stages = [
    { key: "won", label: "Won", color: Colors.status.won, n: scoped.filter((b) => b.status === "won").length },
    { key: "sent", label: "Sent", color: Colors.status.sent, n: scoped.filter((b) => ["sent", "viewed"].includes(b.status)).length },
    { key: "draft", label: "Draft", color: Colors.status.draft, n: scoped.filter((b) => b.status === "draft").length },
    { key: "pending", label: "Pending", color: Colors.status.pending, n: scoped.filter((b) => ["accepted", "pending"].includes(b.status)).length },
    { key: "lost", label: "Lost", color: Colors.status.lost, n: scoped.filter((b) => b.status === "lost").length },
  ].filter((s) => s.n > 0);
  const stageTotal = stages.reduce((s, x) => s + x.n, 0);

  const nudges = [
    {
      key: "accepted",
      icon: "checkmark-circle" as const,
      color: Colors.green,
      items: bids.filter(
        (b) => b.accepted_at && b.deposit_status !== "paid" && b.status !== "lost",
      ),
      label: (n: number) => `${n} accepted · deposit pending`,
    },
    {
      key: "opened",
      icon: "eye" as const,
      color: Colors.blue,
      items: bids.filter(
        (b) =>
          b.first_viewed_at &&
          !b.accepted_at &&
          b.status !== "won" &&
          b.status !== "lost",
      ),
      label: (n: number) => `${n} opened · awaiting reply`,
    },
    {
      key: "sent",
      icon: "paper-plane" as const,
      color: Colors.blue,
      items: bids.filter(
        (b) => b.share_token && !b.first_viewed_at && b.status === "sent",
      ),
      label: (n: number) => `${n} sent · not opened yet`,
    },
  ].filter((n) => n.items.length > 0);

  const today = new Date()
    .toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();

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
          <FadeInView style={styles.header}>
            <View style={styles.topRow}>
              <Text style={styles.date}>{today}</Text>
              <View style={styles.seg}>
                {(["month", "all"] as const).map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setRange(r)}
                    style={[styles.segBtn, range === r && styles.segBtnOn]}
                  >
                    <Text style={[styles.segTxt, range === r && styles.segTxtOn]}>
                      {r === "month" ? "This month" : "All time"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={styles.greeting}>
              {profile?.company_name ?? "Your studio"}
            </Text>

            <View style={styles.metrics}>
              <StatCard
                label="Total bids"
                value={String(scoped.length)}
                icon="documents"
                tint={Colors.blue}
                delta={newThisWeek > 0 ? `+${newThisWeek} this wk` : null}
              >
                <Sparkline data={bidsSeries} color={Colors.blue} />
              </StatCard>

              <StatCard
                label="Win rate"
                value={decided.length > 0 ? `${winPct}%` : "—"}
                icon="trophy"
                tint={Colors.green}
                footnote={
                  decided.length > 0
                    ? `${won.length} of ${decided.length} decided`
                    : "No decisions yet"
                }
              >
                <View style={styles.meterTrack}>
                  <View
                    style={[
                      styles.meterFill,
                      { width: `${winPct}%`, backgroundColor: Colors.green },
                    ]}
                  />
                </View>
              </StatCard>

              <StatCard
                label="Revenue won"
                value={`$${revenueWon.toLocaleString()}`}
                icon="cash"
                tint={Colors.accent}
                delta={revThisWeek > 0 ? `+${shortMoney(revThisWeek)}` : null}
              >
                <Sparkline data={revSeries} color={Colors.accent} />
              </StatCard>

              <StatCard
                label="Pipeline"
                value={`$${pipeline.toLocaleString()}`}
                icon="trending-up"
                tint={Colors.purple}
                footnote={`${openBids.length} open`}
              >
                <Sparkline
                  data={
                    openBids.length
                      ? openBids.slice(0, 7).map(amountOf).reverse()
                      : [0]
                  }
                  color={Colors.purple}
                />
              </StatCard>
            </View>

            {stageTotal > 0 && (
              <View style={styles.panel}>
                <View style={styles.panelHead}>
                  <Text style={styles.panelLabel}>Pipeline by stage</Text>
                  <Text style={styles.panelMuted}>
                    {stageTotal} bid{stageTotal === 1 ? "" : "s"}
                  </Text>
                </View>
                <View style={styles.stageBar}>
                  {stages.map((s) => (
                    <View
                      key={s.key}
                      style={{ flex: s.n, backgroundColor: s.color }}
                    />
                  ))}
                </View>
                <View style={styles.legend}>
                  {stages.map((s) => (
                    <View key={s.key} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                      <Text style={styles.legendTxt}>
                        {s.label} {s.n}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {nudges.length > 0 && (
              <View style={styles.nudges}>
                <Text style={styles.sectionTitle}>Needs attention</Text>
                {nudges.map((n) => (
                  <Pressable
                    key={n.key}
                    style={({ hovered, pressed }: any) => [
                      styles.nudgeRow,
                      webTransition,
                      {
                        backgroundColor: n.color + "14",
                        borderColor: n.color + "40",
                      },
                      hovered && {
                        transform: [{ translateX: 4 }],
                        backgroundColor: n.color + "22",
                      },
                      pressed && { transform: [{ scale: 0.99 }] },
                    ]}
                    onPress={() => router.push(`/bid/${n.items[0].id}`)}
                  >
                    <View
                      style={[styles.nudgeIcon, { backgroundColor: n.color + "26" }]}
                    >
                      <Ionicons name={n.icon} size={17} color={n.color} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.nudgeText}>{n.label(n.items.length)}</Text>
                      <Text style={styles.nudgeSub}>{NUDGE_SUB[n.key]}</Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={Colors.textMuted}
                    />
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.recentHead}>
              <Text style={styles.sectionTitle}>Recent bids</Text>
              <Pressable onPress={() => router.push("/bids")}>
                <Text style={styles.viewAll}>View all</Text>
              </Pressable>
            </View>
          </FadeInView>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No bids yet</Text>
            <Text style={styles.emptyText}>
              Tap New Bid to generate your first proposal in under 60 seconds.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const tint = Colors.status[item.status] ?? Colors.textMuted;
          return (
            <FadeInView delay={Math.min(index, 6) * 55}>
            <Pressable
              style={({ hovered, pressed }: any) => [
                styles.bidRow,
                webTransition,
                hovered && styles.bidRowHover,
                pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] },
              ]}
              onPress={() => router.push(`/bid/${item.id}`)}
            >
              <View style={[styles.avatar, { backgroundColor: tint + "22" }]}>
                <Text style={[styles.avatarTxt, { color: tint }]}>
                  {initials(item.client_name)}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.bidClient}>{item.client_name}</Text>
                <Text style={styles.bidDate}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={styles.bidAmount}>
                  ${amountOf(item).toLocaleString()}
                </Text>
                <StatusBadge status={item.status} />
              </View>
            </Pressable>
            </FadeInView>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.md, gap: Spacing.sm },
  header: { gap: Spacing.md, marginBottom: Spacing.sm },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  date: { color: Colors.textMuted, fontSize: 12, letterSpacing: 0.5 },
  seg: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: 3,
  },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  segBtnOn: { backgroundColor: Colors.accent },
  segTxt: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  segTxtOn: { color: "#1A1405" },
  greeting: { color: Colors.text, fontSize: 24, fontWeight: "800", marginTop: -4 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },

  meterTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
    overflow: "hidden",
    marginTop: 4,
  },
  meterFill: { height: 6, borderRadius: 3 },

  panel: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 11,
  },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelLabel: { color: Colors.textSecondary, fontSize: 12.5 },
  panelMuted: { color: Colors.textMuted, fontSize: 12.5 },
  stageBar: {
    flexDirection: "row",
    height: 9,
    borderRadius: 5,
    overflow: "hidden",
    gap: 3,
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 2 },
  legendTxt: { color: Colors.textSecondary, fontSize: 11.5 },

  nudges: { gap: Spacing.sm },
  nudgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 13,
  },
  nudgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  nudgeText: { color: Colors.text, fontSize: 14, fontWeight: "700" },
  nudgeSub: { color: Colors.textSecondary, fontSize: 11.5 },

  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  recentHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewAll: { color: Colors.accent, fontSize: 13, fontWeight: "600" },

  bidRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  bidRowHover: {
    transform: [{ translateX: 4 }],
    backgroundColor: Colors.surfaceRaised,
    borderColor: Colors.border,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { fontSize: 13, fontWeight: "700" },
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
