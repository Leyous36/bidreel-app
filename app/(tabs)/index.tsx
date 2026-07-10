import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  ChevronRight,
  CircleCheck,
  Clock,
  Eye,
  Send,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Bid, proposalValue } from "@/lib/types";
import { StatCard } from "@/components/StatCard";
import { Sparkline } from "@/components/Sparkline";
import { FadeInView } from "@/components/FadeInView";
import { StatusBadge } from "@/components/StatusBadge";
import { ShareButton } from "@/components/ShareButton";
import {
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  Row,
  Screen,
  focusRing,
  text,
  useInteractive,
} from "@/components/ui";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Colors, Fonts, Radius, Spacing, Type } from "@/constants/Colors";

type Range = "month" | "all";

const WEEK = 7 * 24 * 60 * 60 * 1000;

function amountOf(b: Bid): number {
  return proposalValue(b.proposal) || b.budget || 0;
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

const NUDGE_SUB: Record<string, string> = {
  accepted: "Send the payment link to lock it in",
  opened: "They're interested — reply while it's warm",
  sent: "Nudge them with a friendly follow-up",
  stale: "Open the bid and tap Draft Follow-up — AI writes the nudge",
};

/** Proposals with no movement in this many days count as "gone quiet". */
const COLD_DAYS = 3;

function SegmentButton({
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
      style={[
        styles.segBtn,
        hovered && !active && { backgroundColor: Colors.surfaceHover },
        active && styles.segBtnOn,
        focusRing(focused),
      ]}
    >
      <Text style={[styles.segTxt, active && styles.segTxtOn]}>{label}</Text>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const { session, profile } = useAuth();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [range, setRange] = useState<Range>("month");
  const router = useRouter();

  const load = useCallback(async () => {
    if (!session) return;
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
      icon: CircleCheck,
      items: bids.filter(
        (b) => b.accepted_at && b.deposit_status !== "paid" && b.status !== "lost",
      ),
      label: (n: number) => `${n} accepted · deposit pending`,
    },
    {
      key: "opened",
      icon: Eye,
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
      icon: Send,
      items: bids.filter(
        (b) => b.share_token && !b.first_viewed_at && b.status === "sent",
      ),
      label: (n: number) => `${n} sent · not opened yet`,
    },
    {
      key: "stale",
      icon: Clock,
      items: bids
        .filter(
          (b) =>
            ["sent", "viewed", "pending"].includes(b.status) &&
            Date.now() - new Date(b.updated_at).getTime() >
              COLD_DAYS * 86400000,
        )
        .sort(
          (a, b) =>
            new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
        ),
      label: (n: number) =>
        `${n} gone quiet · ${COLD_DAYS}+ days without movement`,
    },
  ].filter((n) => n.items.length > 0);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Brand-new accounts get one clear sentence and one action — not a wall of
  // zero KPIs pointing at controls that live elsewhere.
  const firstRun = !loading && bids.length === 0;

  return (
    <Screen>
      <PageHeader title="Dashboard" />
      {loadError ? <ErrorBanner onRetry={load} /> : null}
      <FlatList
        data={bids.slice(0, 10)}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={Colors.textSecondary}
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
              <View style={{ gap: Spacing.xxs }}>
                <Text style={text.heading}>
                  {profile?.company_name ?? "Your studio"}
                </Text>
                <Text style={text.muted}>{today}</Text>
              </View>
              {!firstRun && (
                <View style={styles.seg}>
                  {(["month", "all"] as const).map((r) => (
                    <SegmentButton
                      key={r}
                      label={r === "month" ? "This month" : "All time"}
                      active={range === r}
                      onPress={() => setRange(r)}
                    />
                  ))}
                </View>
              )}
            </View>

            {!firstRun && (
            <View style={styles.metrics}>
              <StatCard
                label="Total bids"
                value={String(scoped.length)}
                delta={newThisWeek > 0 ? `+${newThisWeek} this wk` : null}
              >
                <View style={styles.trend}>
                  <Sparkline data={bidsSeries} />
                  <Text style={styles.trendCaption}>Last 6 weeks</Text>
                </View>
              </StatCard>

              <StatCard
                label="Win rate"
                value={decided.length > 0 ? `${winPct}%` : "—"}
                footnote={
                  decided.length > 0
                    ? `${won.length} of ${decided.length} decided`
                    : "No decisions yet"
                }
              >
                <View style={styles.meterTrack}>
                  <View style={[styles.meterFill, { width: `${winPct}%` }]} />
                </View>
              </StatCard>

              <StatCard
                label="Revenue won"
                value={`$${revenueWon.toLocaleString()}`}
                delta={revThisWeek > 0 ? `+${shortMoney(revThisWeek)}` : null}
              >
                <View style={styles.trend}>
                  <Sparkline data={revSeries} />
                  <Text style={styles.trendCaption}>Last 6 weeks</Text>
                </View>
              </StatCard>

              <StatCard
                label="Pipeline"
                value={`$${pipeline.toLocaleString()}`}
                footnote={`${openBids.length} open`}
              />
            </View>
            )}

            {stageTotal > 0 && (
              <Card style={styles.panel}>
                <View style={styles.panelHead}>
                  <Text style={text.label}>Pipeline by stage</Text>
                  <Text style={text.muted}>
                    {stageTotal} bid{stageTotal === 1 ? "" : "s"}
                  </Text>
                </View>
                <View style={styles.legend}>
                  {stages.map((s) => (
                    <View key={s.key} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                      <Text style={text.label}>
                        {s.label} {s.n}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            )}

            {nudges.length > 0 && (
              <View style={styles.section}>
                <Text style={text.label}>Needs attention</Text>
                <View>
                  {nudges.map((n) => {
                    const Icon = n.icon;
                    return (
                      <Row
                        key={n.key}
                        onPress={() => router.push(`/bid/${n.items[0].id}`)}
                        style={styles.nudgeRow}
                      >
                        <Icon
                          size={16}
                          color={Colors.textSecondary}
                          strokeWidth={1.75}
                        />
                        <View style={{ flex: 1, gap: Spacing.xxs }}>
                          <Text style={text.ui}>{n.label(n.items.length)}</Text>
                          <Text style={text.muted}>{NUDGE_SUB[n.key]}</Text>
                        </View>
                        <ChevronRight
                          size={16}
                          color={Colors.textMuted}
                          strokeWidth={1.75}
                        />
                      </Row>
                    );
                  })}
                </View>
              </View>
            )}

            {!firstRun && (
              <View style={styles.recentHead}>
                <Text style={text.label}>Recent bids</Text>
                <Button
                  title="View all"
                  variant="ghost"
                  onPress={() => router.push("/bids")}
                />
              </View>
            )}
          </FadeInView>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState />
          ) : (
            <EmptyState
              message="Generate your first client-ready proposal in under 60 seconds."
              actionLabel="New bid"
              onAction={() => router.push("/(tabs)/create")}
            />
          )
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * 55}>
            <Row
              onPress={() => router.push(`/bid/${item.id}`)}
              style={styles.bidRow}
            >
              <Text style={[text.ui, styles.bidClient]} numberOfLines={1}>
                {item.client_name}
              </Text>
              <Text style={text.muted}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
              <View style={{ flex: 1 }} />
              <Text style={text.ui}>${amountOf(item).toLocaleString()}</Text>
              <StatusBadge status={item.status} />
              <ShareButton
                bid={item}
                onShared={(patch) =>
                  setBids((prev) =>
                    prev.map((b) => (b.id === item.id ? { ...b, ...patch } : b)),
                  )
                }
              />
            </Row>
          </FadeInView>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  header: { gap: Spacing.lg, marginBottom: Spacing.xs },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  seg: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.xxs,
    gap: Spacing.xxs,
  },
  segBtn: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  segBtnOn: { backgroundColor: Colors.accentMuted },
  segTxt: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    letterSpacing: Type.trackUi,
    color: Colors.textSecondary,
  },
  segTxtOn: { color: Colors.text },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },

  trend: { gap: Spacing.xs },
  trendCaption: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    lineHeight: Math.round(11 * 1.4),
    color: Colors.textMuted,
  },

  meterTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    overflow: "hidden",
    marginTop: Spacing.xs,
  },
  meterFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },

  panel: { gap: Spacing.md },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  legendDot: { width: 8, height: 8, borderRadius: Radius.pill },

  section: { gap: Spacing.sm },
  nudgeRow: { paddingVertical: Spacing.sm, marginHorizontal: -12 },

  recentHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 28,
  },

  bidRow: { marginHorizontal: -12 },
  bidClient: { flexShrink: 1 },
});
