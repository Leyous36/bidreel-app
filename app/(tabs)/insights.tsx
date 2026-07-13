import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Bid, proposalValue } from "@/lib/types";
import { TEMPLATES } from "@/lib/templates";
import { Card, EmptyState, PageHeader, Screen, text } from "@/components/ui";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Colors, Radius, Spacing, Type } from "@/constants/Colors";

const ACTIVE = ["sent", "viewed", "pending", "accepted"];

function amountOf(b: Bid): number {
  return proposalValue(b.proposal) || b.budget || 0;
}

export default function InsightsScreen() {
  const { session } = useAuth();
  const [bids, setBids] = useState<Bid[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase.from("bids").select("*");
    if (error) {
      setLoadError(true);
    } else {
      setBids(data as Bid[]);
      setLoadError(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const won = bids.filter((b) => b.status === "won");
  const lost = bids.filter((b) => b.status === "lost");
  const decided = won.length + lost.length;
  const winRate = decided ? Math.round((won.length / decided) * 100) : null;

  const wonValue = won.reduce((s, b) => s + amountOf(b), 0);
  const avgDeal = won.length ? Math.round(wonValue / won.length) : null;
  const pipeline = bids
    .filter((b) => ACTIVE.includes(b.status))
    .reduce((s, b) => s + amountOf(b), 0);

  const sent = bids.filter((b) => b.status !== "draft");
  // Keep the status fallback in sync with the dashboard's open-pipeline
  // buckets — "pending" (awaiting deposit) implies the client opened it.
  const viewed = bids.filter(
    (b) =>
      !!b.first_viewed_at ||
      ["viewed", "accepted", "pending", "won"].includes(b.status),
  );
  const openRate = sent.length
    ? Math.round((viewed.length / sent.length) * 100)
    : null;
  const acceptRate = viewed.length
    ? Math.round((won.length / viewed.length) * 100)
    : null;

  const depositsCollected =
    bids.reduce(
      (s, b) =>
        s + (b.deposit_status === "paid" ? b.deposit_amount_cents || 0 : 0),
      0,
    ) / 100;

  const byTemplate = TEMPLATES.map((t) => {
    const tb = bids.filter((b) => b.template_id === t.id);
    const tw = tb.filter((b) => b.status === "won").length;
    const tl = tb.filter((b) => b.status === "lost").length;
    const dec = tw + tl;
    return { name: t.name, count: tb.length, won: tw, winRate: dec ? Math.round((tw / dec) * 100) : null };
  })
    .filter((x) => x.count > 0)
    .sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1));

  const funnelMax = Math.max(sent.length, 1);
  const funnel = [
    { label: "Sent", n: sent.length },
    { label: "Opened", n: viewed.length },
    { label: "Won", n: won.length },
  ];

  const stats = [
    { label: "Win rate", value: winRate === null ? "—" : `${winRate}%` },
    {
      label: "Avg deal size",
      value: avgDeal === null ? "—" : `$${avgDeal.toLocaleString()}`,
    },
    { label: "Open rate", value: openRate === null ? "—" : `${openRate}%` },
    {
      label: "Deposits collected",
      value: `$${depositsCollected.toLocaleString()}`,
    },
  ];

  return (
    <Screen>
      {loadError ? <ErrorBanner onRetry={load} /> : null}
      <PageHeader title="Insights" />
      <ScrollView
        contentContainerStyle={styles.container}
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
      >
        <View style={styles.metrics}>
          {stats.map((s) => (
            <Card key={s.label} style={styles.stat}>
              <Text style={text.label}>{s.label}</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {s.value}
              </Text>
            </Card>
          ))}
        </View>

        {bids.length === 0 ? (
          <EmptyState message="Generate and send a few proposals — your win data shows up here." />
        ) : (
          <>
            <Section title="Conversion Funnel">
              <View style={{ gap: 12 }}>
                {funnel.map((f, i) => {
                  const prev = i > 0 ? funnel[i - 1].n : null;
                  const stepRate = prev && prev > 0 ? Math.round((f.n / prev) * 100) : null;
                  return (
                    <View key={f.label} style={{ gap: Spacing.xs }}>
                      <View style={styles.funnelHead}>
                        <Text style={styles.funnelLabel}>{f.label}</Text>
                        <Text style={styles.funnelN}>
                          {f.n}
                          {stepRate !== null ? (
                            <Text style={text.muted}>  {stepRate}%</Text>
                          ) : null}
                        </Text>
                      </View>
                      <View style={styles.track}>
                        <View
                          style={[
                            styles.fill,
                            { width: `${Math.max((f.n / funnelMax) * 100, 2)}%` },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text style={text.muted}>
                {acceptRate === null
                  ? "Of the proposals clients open, the share that turn into wins shows here."
                  : `${acceptRate}% of opened proposals turn into wins.`}
              </Text>
            </Section>

            <Section title="Win Rate by Template">
              {byTemplate.length === 0 ? (
                <Text style={text.muted}>No decided proposals yet.</Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {byTemplate.map((t) => (
                    <View key={t.name} style={{ gap: Spacing.xs }}>
                      <View style={styles.funnelHead}>
                        <Text style={styles.tplName}>{t.name}</Text>
                        <Text style={styles.funnelN}>
                          {t.winRate === null ? "—" : `${t.winRate}%`}
                          <Text style={text.muted}>  ·  {t.count} proposal{t.count === 1 ? "" : "s"}</Text>
                        </Text>
                      </View>
                      <View style={styles.track}>
                        <View
                          style={[
                            styles.fill,
                            { width: `${Math.max(t.winRate ?? 0, 2)}%` },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Section>

            <Section title="Pipeline">
              <View style={styles.pipeRow}>
                <Text style={styles.pipeLabel}>Open pipeline value</Text>
                <Text style={text.title}>${pipeline.toLocaleString()}</Text>
              </View>
              <View style={styles.pipeRow}>
                <Text style={styles.pipeLabel}>Revenue won</Text>
                <Text style={text.title}>${wonValue.toLocaleString()}</Text>
              </View>
            </Section>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={styles.section}>
      <Text style={text.label}>{title}</Text>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  stat: { flex: 1, minWidth: "45%", gap: Spacing.xs },
  statValue: {
    color: Colors.text,
    fontWeight: "700",
    fontSize: Type.heading,
    lineHeight: Math.round(Type.heading * 1.4),
    letterSpacing: Type.trackHeading,
  },
  section: { gap: Spacing.md },
  funnelHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  funnelLabel: {
    color: Colors.text,
    fontWeight: "600",
    fontSize: Type.body,
    lineHeight: Math.round(Type.body * 1.4),
    letterSpacing: Type.trackUi,
  },
  funnelN: {
    color: Colors.text,
    fontWeight: "700",
    fontSize: Type.body,
    lineHeight: Math.round(Type.body * 1.4),
    letterSpacing: Type.trackUi,
  },
  tplName: {
    color: Colors.text,
    fontWeight: "600",
    fontSize: Type.body,
    lineHeight: Math.round(Type.body * 1.4),
    letterSpacing: Type.trackUi,
    flex: 1,
    paddingRight: Spacing.sm,
  },
  track: {
    height: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceRaised,
    overflow: "hidden",
  },
  fill: {
    height: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.textMuted,
  },
  pipeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 24,
  },
  pipeLabel: {
    color: Colors.textSecondary,
    fontWeight: "400",
    fontSize: Type.body,
    lineHeight: Math.round(Type.body * 1.4),
  },
});
