import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card, Hairline } from "@/components/ui";
import { Colors, Fonts, Radius, Spacing, Type } from "@/constants/Colors";
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
    <Card style={[styles.tierCard, recommended && styles.tierCardRecommended]}>
      <View style={styles.tierHeader}>
        <Text style={styles.tierName}>{tier.name}</Text>
        {recommended && <Text style={styles.recLabel}>Recommended</Text>}
      </View>
      <Text style={styles.tierTotal}>
        ${Number(tier.total ?? 0).toLocaleString()}
      </Text>
      {!!tier.tagline && <Text style={styles.tierTagline}>{tier.tagline}</Text>}
      <Hairline style={styles.tierDivider} />
      {(tier.includes ?? []).map((inc, i) => (
        <Text key={i} style={styles.tierInclude}>
          •  {inc}
        </Text>
      ))}
    </Card>
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
          <Card style={styles.investmentCard}>
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
          </Card>
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
  subject: {
    fontFamily: Fonts.semibold,
    fontSize: Type.heading,
    lineHeight: Math.round(Type.heading * 1.4),
    letterSpacing: Type.trackHeading,
    color: Colors.text,
  },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: Fonts.semibold,
    fontSize: Type.heading,
    lineHeight: Math.round(Type.heading * 1.4),
    letterSpacing: Type.trackHeading,
    color: Colors.text,
  },
  body: {
    fontFamily: Fonts.regular,
    fontSize: Type.bodyLg,
    lineHeight: Math.round(Type.bodyLg * 1.5),
    color: Colors.textSecondary,
  },
  bullet: {
    fontFamily: Fonts.regular,
    fontSize: Type.bodyLg,
    lineHeight: Math.round(Type.bodyLg * 1.5),
    color: Colors.textSecondary,
  },
  timelineRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.textMuted,
    marginTop: 7,
  },
  timelinePhase: {
    fontFamily: Fonts.semibold,
    fontSize: Type.bodyLg,
    lineHeight: Math.round(Type.bodyLg * 1.5),
    color: Colors.text,
  },
  timelineDuration: { fontFamily: Fonts.regular, color: Colors.textMuted },

  // --- Tiered pricing ---
  tierStack: { gap: Spacing.md },
  tierCard: { gap: Spacing.xs },
  tierCardRecommended: { backgroundColor: Colors.surfaceRaised },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  tierName: {
    fontFamily: Fonts.semibold,
    fontSize: Type.bodyLg,
    lineHeight: Math.round(Type.bodyLg * 1.4),
    letterSpacing: Type.trackUi,
    color: Colors.text,
  },
  recLabel: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    letterSpacing: Type.trackUi,
    color: Colors.textSecondary,
  },
  tierTotal: {
    fontFamily: Fonts.semibold,
    fontSize: Type.heading,
    lineHeight: Math.round(Type.heading * 1.4),
    letterSpacing: Type.trackHeading,
    color: Colors.text,
    marginTop: Spacing.xxs,
  },
  tierTagline: {
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textMuted,
  },
  tierDivider: { marginVertical: Spacing.sm },
  tierInclude: {
    fontFamily: Fonts.regular,
    fontSize: Type.body,
    lineHeight: Math.round(Type.body * 1.5),
    color: Colors.textSecondary,
  },

  // --- Legacy single investment (old saved proposals) ---
  investmentCard: { gap: Spacing.sm },
  investmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  investmentItem: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: Type.body,
    lineHeight: Math.round(Type.body * 1.4),
    color: Colors.textSecondary,
  },
  investmentAmount: {
    fontFamily: Fonts.medium,
    fontSize: Type.body,
    lineHeight: Math.round(Type.body * 1.4),
    color: Colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  totalLabel: {
    fontFamily: Fonts.semibold,
    fontSize: Type.bodyLg,
    lineHeight: Math.round(Type.bodyLg * 1.4),
    color: Colors.text,
  },
  totalAmount: {
    fontFamily: Fonts.semibold,
    fontSize: Type.bodyLg,
    lineHeight: Math.round(Type.bodyLg * 1.4),
    color: Colors.text,
  },
  paymentTerms: {
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textMuted,
  },
});
