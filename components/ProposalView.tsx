import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, Radius, Spacing } from "@/constants/Colors";
import { Proposal } from "@/lib/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// --- Defensive helpers -------------------------------------------------------
// Stored proposals are AI-generated and can vary in shape (missing fields, or
// alternate field names like lineItems/detail/depositTerms). These normalizers
// make the view render gracefully instead of crashing on a shape mismatch.
const asText = (v: unknown): string =>
  Array.isArray(v)
    ? v.filter(Boolean).map(String).join("\n\n")
    : v == null
      ? ""
      : String(v);

const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : []);

const num = (v: unknown): number => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
};

const money = (v: unknown): string => `$${num(v).toLocaleString()}`;

export function ProposalView({ proposal }: { proposal: Proposal }) {
  // Treat as loose at runtime — the DB row may not match the strict type.
  const p = (proposal ?? {}) as any;

  const subject = asText(p.subject ?? p.title);
  const overview = asText(p.overview);
  const whyUs = asText(p.whyUs ?? p.why_us);
  const scope = asArray(p.scope);
  const deliverables = asArray(p.deliverables);
  const timeline = asArray(p.timeline);

  const inv = (p.investment ?? {}) as any;
  const breakdown = asArray(inv.breakdown ?? inv.lineItems ?? inv.line_items);
  const total = num(inv.total);
  const paymentTerms = asText(inv.paymentTerms ?? inv.depositTerms ?? inv.terms);
  const hasInvestment = breakdown.length > 0 || total > 0;

  return (
    <View style={styles.container}>
      {subject ? <Text style={styles.subject}>{subject}</Text> : null}

      {overview ? (
        <Section title="Overview">
          <Text style={styles.body}>{overview}</Text>
        </Section>
      ) : null}

      {scope.length > 0 ? (
        <Section title="Scope of Work">
          {scope.map((s, i) => (
            <Text key={i} style={styles.bullet}>
              •  {asText(s)}
            </Text>
          ))}
        </Section>
      ) : null}

      {deliverables.length > 0 ? (
        <Section title="Deliverables">
          {deliverables.map((d, i) => (
            <Text key={i} style={styles.bullet}>
              •  {asText(d)}
            </Text>
          ))}
        </Section>
      ) : null}

      {timeline.length > 0 ? (
        <Section title="Timeline">
          {timeline.map((t, i) => {
            const phase = asText(t?.phase);
            const duration = asText(t?.duration);
            const details = asText(t?.details ?? t?.detail ?? t?.description);
            return (
              <View key={i} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelinePhase}>
                    {phase}
                    {duration ? (
                      <Text style={styles.timelineDuration}> ({duration})</Text>
                    ) : null}
                  </Text>
                  {details ? <Text style={styles.body}>{details}</Text> : null}
                </View>
              </View>
            );
          })}
        </Section>
      ) : null}

      {hasInvestment ? (
        <Section title="Investment">
          <View style={styles.investmentCard}>
            {breakdown.map((b, i) => (
              <View key={i} style={styles.investmentRow}>
                <Text style={styles.investmentItem}>{asText(b?.item ?? b?.label)}</Text>
                <Text style={styles.investmentAmount}>{money(b?.amount)}</Text>
              </View>
            ))}
            <View style={[styles.investmentRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>{money(total)}</Text>
            </View>
            {paymentTerms ? (
              <Text style={styles.paymentTerms}>{paymentTerms}</Text>
            ) : null}
          </View>
        </Section>
      ) : null}

      {whyUs ? (
        <Section title="Why Us">
          <Text style={styles.body}>{whyUs}</Text>
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  subject: { color: Colors.text, fontSize: 22, fontWeight: "800", lineHeight: 28 },
  section: { gap: Spacing.sm },
  sectionTitle: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  body: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22 },
  bullet: { color: Colors.textSecondary, fontSize: 15, lineHeight: 24 },
  timelineRow: { flexDirection: "row", gap: 10, marginBottom: Spacing.sm },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginTop: 7,
  },
  timelinePhase: { color: Colors.text, fontSize: 15, fontWeight: "700" },
  timelineDuration: { color: Colors.textMuted, fontWeight: "400" },
  investmentCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 10,
  },
  investmentRow: { flexDirection: "row", justifyContent: "space-between" },
  investmentItem: { color: Colors.textSecondary, fontSize: 14, flex: 1 },
  investmentAmount: { color: Colors.text, fontSize: 14, fontWeight: "600" },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  totalLabel: { color: Colors.text, fontSize: 16, fontWeight: "800" },
  totalAmount: { color: Colors.accent, fontSize: 16, fontWeight: "800" },
  paymentTerms: { color: Colors.textMuted, fontSize: 12, fontStyle: "italic" },
});
