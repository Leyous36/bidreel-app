import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BidEvent } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { Colors, Radius, Spacing } from "@/constants/Colors";
import { Card, EmptyState, Row, text } from "@/components/ui";

type TimelineRow = {
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
      <Text style={[text.label, styles.sectionTitle]}>Activity</Text>
      {rows.length === 0 ? (
        <EmptyState message="No activity yet — share the proposal to start tracking." />
      ) : (
        <Card style={styles.card}>
          {rows.map((r, i) => (
            <Row key={i}>
              <View style={[styles.dot, { backgroundColor: r.color }]} />
              <Text style={[text.body, styles.title]} numberOfLines={1}>
                {r.title}
              </Text>
              <Text style={text.muted}>{timeAgo(r.time)}</Text>
            </Row>
          ))}
        </Card>
      )}
    </View>
  );
}

function buildRows(events: BidEvent[]): TimelineRow[] {
  const byTime = [...events].sort(
    (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
  );
  const first = (t: string) => byTime.find((e) => e.type === t);
  const last = (t: string) =>
    [...byTime].reverse().find((e) => e.type === t);

  const rows: TimelineRow[] = [];

  const shared = first("shared");
  if (shared) {
    rows.push({
      color: Colors.status.sent,
      title: "Proposal shared",
      time: shared.created_at,
    });
  }

  const views = byTime.filter((e) => e.type === "viewed");
  if (views.length) {
    rows.push({
      color: Colors.status.viewed,
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
      color: Colors.status.accepted,
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
      color: Colors.green,
      title: cents
        ? `Deposit paid · $${Math.round(cents / 100).toLocaleString()}`
        : "Deposit paid",
      time: paid.created_at,
    });
  } else if (requested) {
    rows.push({
      color: Colors.status.pending,
      title: "Checkout started",
      time: requested.created_at,
    });
  }

  return rows;
}

const styles = StyleSheet.create({
  sectionTitle: { marginBottom: Spacing.sm },
  card: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  title: { flex: 1 },
});
