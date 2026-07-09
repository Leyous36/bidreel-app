import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, Radius, Spacing } from "@/constants/Colors";
import { PricingTier, Proposal } from "@/lib/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function TierCard({ tier }: { tier: PricingTier }) {
  const recommended = !!tier.recommended;
  return (
    <View style={[styles.tierCard, recommended && styles.tierCardRecommended]}>
      <View style={styles.tierHeader}>
        <Text style={styles.tierName}>{tier.name}</Text>
        {recommended && (
          <View style={styles.recBadge}>
            <Text style={styles.recBadgeText}>RECOMMENDED</Text>
          </View>
        )}
      </View>
      <Text style={styles.tierTotal}>
        ${Number(tier.total ?? 0).toLocaleString()}
      </Text>
      {!!tier.tagline && <Text style={styles.tierTagline}>{tier.tagline}</Text>}
      <View style={styles.tierDivider} />
      {(tier.includes ?? []).map((inc, i) => (
        <Text key={i} style={styles.tierInclude}>
          •  {inc}
        </Text>
      ))}
    </View>
  );
}

export function ProposalView({ proposal }: { proposal: Proposal }) {
  const hasTiers = !!proposal.tiers && proposal.tiers.length > 0;
  return (
    <View style={styles.container}>
      <Text style={styles.subject}>{proposal.subject}</Text>

      <Section title="Overview">
        <Text style={styles.body}>{proposal.overview}</Text>
      </Section>

      <Section title="Scope of Work">
        {(proposal.scope ?? []).map((s, i) => (
          <Text key={i} style={styles.bullet}>
            •  {s}
          </Text>
        ))}
      </Section>

      <Section title="Deliverables">
        {(proposal.deliverables ?? []).map((d, i) => (
          <Text key={i} style={styles.bullet}>
            •  {d}
          </Text>
        ))}
      </Section>

      <Section title="Timeline">
        {(proposal.timeline ?? []).map((t, i) => (
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
        {hasTiers ? (
          <View style={styles.tierStack}>
            {proposal.tiers!.map((tier, i) => (
              <TierCard key={i} tier={tier} />
            ))}
            {!!proposal.paymentTerms && (
              <Text style={styles.paymentTerms}>{proposal.paymentTerms}</Text>
            )}
          </View>
        ) : proposal.investment ? (
          <View style={styles.investmentCard}>
            {(proposal.investment.breakdown ?? []).map((b, i) => (
              <View key={i} style={styles.investmentRow}>
                <Text style={styles.investmentItem}>{b.item}</Text>
                <Text style={styles.investmentAmount}>
                  ${Number(b.amount ?? 0).toLocaleString()}
                </Text>
              </View>
            ))}
            <View style={[styles.investmentRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>
                ${Number(proposal.investment.total ?? 0).toLocaleString()}
              </Text>
            </View>
            <Text style={styles.paymentTerms}>
              {proposal.investment.paymentTerms}
            </Text>
          </View>
        ) : null}
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

  // --- Tiered pricing ---
  tierStack: { gap: Spacing.md },
  tierCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 6,
  },
  tierCardRecommended: {
    borderColor: Colors.accent,
    borderWidth: 2,
    backgroundColor: Colors.accent + "12",
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tierName: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  recBadge: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  recBadgeText: {
    color: "#1A1405",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  tierTotal: { color: Colors.accent, fontSize: 26, fontWeight: "800" },
  tierTagline: { color: Colors.textMuted, fontSize: 13, fontStyle: "italic" },
  tierDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 6,
  },
  tierInclude: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },

  // --- Legacy single investment (old saved proposals) ---
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
