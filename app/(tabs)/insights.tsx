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
import { MetricCard } from "@/components/MetricCard";
import { Screen } from "@/components/ui";
import { Colors, Radius, Spacing } from "@/constants/Colors";

const ACTIVE = ["sent", "viewed", "pending", "accepted"];

function amountOf(b: Bid): number {
  return proposalValue(b.proposal) || b.budget || 0;
}

export default function InsightsScreen() {
  const { session } = useAuth();
  const [bids, setBids] = useState<Bid[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from("bids").select("*");
    if (data) setBids(data as Bid[]);
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
  const viewed = bids.filter(
    (b) =>
      !!b.first_viewed_at ||
      ["viewed", "accepted", "won"].includes(b.status),
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
    { label: "Sent", n: sent.length, tint: Colors.blue },
    { label: "Opened", n: viewed.length, tint: Colors.purple },
    { label: "Won", n: won.length, tint: Colors.green },
  ];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
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
      >
        <Text style={styles.title}>Insights</Text>

        <View style={styles.metrics}>
          <MetricCard label="Win Rate" value={winRate === null ? "—" : `${winRate}%`} icon="trophy" tint={Colors.green} />
          <MetricCard label="Avg Deal Size" value={avgDeal === null ? "—" : `$${avgDeal.toLocaleString()}`} icon="cash" tint={Colors.accent} />
          <MetricCard label="Open Rate" value={openRate === null ? "—" : `${openRate}%`} icon="eye" tint={Colors.blue} />
          <MetricCard label="Deposits Collected" value={`$${depositsCollected.toLocaleString()}`} icon="card" tint={Colors.purple} />
        </View>

        {bids.length === 0 ? (
          <Text style={styles.empty}>
            Generate and send a few proposals — your win data shows up here.
          </Text>
        ) : (
          <>
            <Section title="Conversion Funnel">
              <View style={{ gap: 12 }}>
                {funnel.map((f, i) => {
                  const prev = i > 0 ? funnel[i - 1].n : null;
                  const stepRate = prev && prev > 0 ? Math.round((f.n / prev) * 100) : null;
                  return (
                    <View key={f.label} style={{ gap: 5 }}>
                      <View style={styles.funnelHead}>
                        <Text style={styles.funnelLabel}>{f.label}</Text>
                        <Text style={styles.funnelN}>
                          {f.n}
                          {stepRate !== null ? (
                            <Text style={styles.funnelRate}>  {stepRate}%</Text>
                          ) : null}
                        </Text>
                      </View>
                      <View style={styles.track}>
                        <View
                          style={[
                            styles.fill,
                            { width: `${Math.max((f.n / funnelMax) * 100, 2)}%`, backgroundColor: f.tint },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.note}>
                {acceptRate === null
                  ? "Of the proposals clients open, the share that turn into wins shows here."
                  : `${acceptRate}% of opened proposals turn into wins.`}
              </Text>
            </Section>

            <Section title="Win Rate by Template">
              {byTemplate.length === 0 ? (
                <Text style={styles.note}>No decided bids yet.</Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {byTemplate.map((t) => (
                    <View key={t.name} style={{ gap: 5 }}>
                      <View style={styles.funnelHead}>
                        <Text style={styles.tplName}>{t.name}</Text>
                        <Text style={styles.tplStat}>
                          {t.winRate === null ? "—" : `${t.winRate}%`}
                          <Text style={styles.tplCount}>  ·  {t.count} bid{t.count === 1 ? "" : "s"}</Text>
                        </Text>
                      </View>
                      <View style={styles.track}>
                        <View
                          style={[
                            styles.fill,
                            {
                              width: `${Math.max(t.winRate ?? 0, 2)}%`,
                              backgroundColor: Colors.green,
                            },
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
                <Text style={styles.pipeValue}>${pipeline.toLocaleString()}</Text>
              </View>
              <View style={styles.pipeRow}>
                <Text style={styles.pipeLabel}>Revenue won</Text>
                <Text style={[styles.pipeValue, { color: Colors.green }]}>
                  ${wonValue.toLocaleString()}
                </Text>
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
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 48 },
  title: { color: Colors.text, fontSize: 24, fontWeight: "800" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  empty: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: Spacing.lg,
  },
  section: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  funnelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  funnelLabel: { color: Colors.text, fontSize: 14, fontWeight: "600" },
  funnelN: { color: Colors.text, fontSize: 14, fontWeight: "700" },
  funnelRate: { color: Colors.textMuted, fontSize: 12, fontWeight: "600" },
  tplName: { color: Colors.text, fontSize: 14, fontWeight: "600", flex: 1, paddingRight: 8 },
  tplStat: { color: Colors.green, fontSize: 14, fontWeight: "700" },
  tplCount: { color: Colors.textMuted, fontSize: 12, fontWeight: "500" },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceRaised,
    overflow: "hidden",
  },
  fill: { height: 8, borderRadius: 4 },
  note: { color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
  pipeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pipeLabel: { color: Colors.textSecondary, fontSize: 14 },
  pipeValue: { color: Colors.text, fontSize: 16, fontWeight: "700" },
});
