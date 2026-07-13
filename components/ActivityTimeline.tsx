import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BidEvent } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { Colors, Radius, Spacing } from "@/constants/Colors";

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  time: string;
};

/**
 * Renders the proposal's tracked events as a compact vertical timeline.
 * Aggregates repeat views into a single "Opened Nx" row.
 */
export function ActivityTimeline({ events }: { events: BidEvent[] }) {
  const rows = buildRows(events);

  return (
    <View>
      <Text style={styles.sectionTitle}>Activity</Text>
      {rows.length === 0 ? (
        <Text style={styles.empty}>
          No activity yet — share the proposal to start tracking.
        </Text>
      ) : (
        <View style={styles.wrap}>
          {rows.map((r, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.rail}>
                <View style={[styles.dot, { borderColor: r.color }]}>
                  <Ionicons name={r.icon} size={12} color={r.color} />
                </View>
                {i < rows.length - 1 && <View style={styles.line} />}
              </View>
              <View style={styles.body}>
                <Text style={styles.title}>{r.title}</Text>
                <Text style={styles.time}>{timeAgo(r.time)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function buildRows(events: BidEvent[]): Row[] {
  const byTime = [...events].sort(
    (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
  );
  const first = (t: string) => byTime.find((e) => e.type === t);
  const last = (t: string) =>
    [...byTime].reverse().find((e) => e.type === t);

  const rows: Row[] = [];

  const shared = first("shared");
  if (shared) {
    rows.push({
      icon: "share-social",
      color: Colors.accent,
      title: "Proposal shared",
      time: shared.created_at,
    });
  }

  const views = byTime.filter((e) => e.type === "viewed");
  if (views.length) {
    rows.push({
      icon: "eye",
      color: Colors.blue,
      title:
        views.length > 1
          ? `Opened by client · ${views.length}×`
          : "Opened by client",
      time: views[views.length - 1].created_at,
    });
  }

  const accepted = first("accepted");
  if (accepted) {
    const name = (accepted.metadata as { name?: string } | null)?.name;
    rows.push({
      icon: "checkmark-circle",
      color: Colors.green,
      title: name ? `Accepted by ${name}` : "Accepted",
      time: accepted.created_at,
    });
  }

  const paid = last("deposit_paid");
  const requested = last("deposit_requested");
  if (paid) {
    const cents = (paid.metadata as { amount_cents?: number } | null)
      ?.amount_cents;
    rows.push({
      icon: "cash",
      color: Colors.green,
      title: cents
        ? `Deposit paid · $${Math.round(cents / 100).toLocaleString()}`
        : "Deposit paid",
      time: paid.created_at,
    });
  } else if (requested) {
    rows.push({
      icon: "card",
      color: Colors.accent,
      title: "Checkout started",
      time: requested.created_at,
    });
  }

  return rows;
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  empty: { color: Colors.textMuted, fontSize: 13 },
  wrap: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  row: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center", width: 26 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  line: { width: 2, flex: 1, backgroundColor: Colors.border, marginVertical: 2 },
  body: { flex: 1, paddingBottom: Spacing.md, paddingTop: 2 },
  title: { color: Colors.text, fontSize: 15, fontWeight: "600" },
  time: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
});
