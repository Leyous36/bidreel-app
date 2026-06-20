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

export function ProposalView({ proposal }: { proposal: Proposal }) {
  return (
    <View style={styles.container}>
      <Text style={styles.subject}>{proposal.subject}</Text>

      <Section title="Overview">
        <Text style={styles.body}>{proposal.overview}</Text>
      </Section>

      <Section title="Scope of Work">
        {proposal.scope.map((s, i) => (
          <Text key={i} style={styles.bullet}>
            •  {s}
          </Text>
        ))}
      </Section>

      <Section title="Deliverables">
        {proposal.deliverables.map((d, i) => (
          <Text key={i} style={styles.bullet}>
            •  {d}
          </Text>
        ))}
      </Section>

      <Section title="Timeline">
        {proposal.timeline.map((t, i) => (
          <View key={i} style={styles.timelineRow}>
            <View style={styles.timelineDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.timelinePhase}>
                {t.phase}{" "}
                <Text style={styles.timelineDuration}>({t.duration})</Text>
              </Text>
              <Text style={styles.body}>{t.details}</Text>
            </View>
          </View>
        ))}
      </Section>

      <Section title="Investment">
        <View style={styles.investmentCard}>
          {proposal.investment.breakdown.map((b, i) => (
            <View key={i} style={styles.investmentRow}>
              <Text style={styles.investmentItem}>{b.item}</Text>
              <Text style={styles.investmentAmount}>
                ${b.amount.toLocaleString()}
              </Text>
            </View>
          ))}
          <View style={[styles.investmentRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>
              ${proposal.investment.total.toLocaleString()}
            </Text>
          </View>
          <Text style={styles.paymentTerms}>
            {proposal.investment.paymentTerms}
          </Text>
        </View>
      </Section>

      <Section title="Why Us">
        <Text style={styles.body}>{proposal.whyUs}</Text>
      </Section>
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
