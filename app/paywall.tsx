import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Platform, Pressable } from "react-native";
import { Alert } from "@/lib/dialog";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import {
  getManagementURL,
  purchaseProduct,
  restorePurchases,
} from "@/lib/revenue-cat";
import { track } from "@/lib/analytics";
import { Button, Card, IconButton, Screen, text, useInteractive, focusRing } from "@/components/ui";
import { Colors, Radius, Spacing, Type } from "@/constants/Colors";
import { FREE_PROPOSALS_PER_MONTH, type SubscriptionTier } from "@/lib/types";

/** Plan ordering, so we can tell an upgrade from a downgrade. */
const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  studio: 2,
};

/** Why the user landed here — so the screen answers their actual question. */
const REASON_COPY: Record<string, string> = {
  limit: `You've used all ${FREE_PROPOSALS_PER_MONTH} free proposals this month. Upgrade for unlimited.`,
  template: "That template is a Pro feature. Upgrade to unlock every template.",
  branding: "Custom brand colors come with Pro — make proposals unmistakably yours.",
};

const TIERS: {
  name: string;
  tier: SubscriptionTier;
  productId: string;
  price: string;
  features: string[];
  highlight: boolean;
}[] = [
  {
    name: "BidReel Pro",
    tier: "pro",
    productId: "bidreel_pro_monthly",
    price: "$29.99/mo",
    features: [
      "Unlimited proposals",
      "All 6+ templates",
      "Advanced AI generation",
      "Open tracking",
      "Basic win analytics",
      "Your branding on proposals",
    ],
    highlight: true,
  },
  {
    name: "BidReel Studio",
    tier: "studio",
    productId: "bidreel_studio_monthly",
    price: "$79.99/mo",
    features: [
      "Everything in Pro",
      "Custom templates",
      "Full analytics dashboard",
      "Client portal + e-sign",
      "Up to 5 team members",
      "Full white-label",
    ],
    highlight: false,
  },
];

function LegalLink({ label, url }: { label: string; url: string }) {
  const { hovered, focused, handlers } = useInteractive();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => Linking.openURL(url)}
      {...handlers}
      style={focusRing(focused)}
    >
      <Text style={[styles.legalLink, hovered && { color: Colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function PaywallScreen() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [busy, setBusy] = useState<string | null>(null);

  const currentTier = profile?.subscription_tier ?? "free";
  const onFreePlan = currentTier === "free";
  const contextLine =
    (reason && REASON_COPY[reason]) ||
    (onFreePlan
      ? `You're on the free plan: ${FREE_PROPOSALS_PER_MONTH} proposals a month, 2 templates.`
      : null);

  useEffect(() => {
    track("paywall_viewed", { reason: reason ?? "none" });
  }, [reason]);

  // The DB tier is written ONLY server-side (rc-webhook on RevenueCat events;
  // clients are blocked from that column since migration 0007). Refreshing the
  // profile is enough for instant UX: auth-context merges the live RevenueCat
  // entitlement on top of the DB value.
  async function handlePurchase(productId: string) {
    try {
      setBusy(productId);
      const tier = await purchaseProduct(productId);
      await refreshProfile();
      track("purchase_completed", { product: productId, tier });
      Alert.alert(
        "You're in",
        // Trials only apply to first-time subscribers; existing subscribers
        // are charged on plan change, so don't promise a trial they won't get.
        onFreePlan
          ? "Your 7-day free trial has started. Enjoy BidReel."
          : "Your plan has been updated. Enjoy BidReel.",
      );
      router.back();
    } catch (e: unknown) {
      // RevenueCat sets userCancelled on the error when the buyer backs out.
      if (e && typeof e === "object" && (e as { userCancelled?: boolean }).userCancelled) {
        return;
      }
      Alert.alert(
        "Purchase failed",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  // Existing subscribers change plans differently per platform: StoreKit
  // handles up/downgrades natively inside purchase, but Web Billing does them
  // through RevenueCat's customer portal (which follows the subscription
  // change paths and lets Stripe handle proration) — calling purchase() there
  // would just throw ProductAlreadyPurchased.
  async function changePlan(productId: string) {
    if (Platform.OS !== "web") {
      return handlePurchase(productId);
    }
    try {
      setBusy(productId);
      const url = await getManagementURL();
      if (!url) {
        throw new Error(
          "Couldn't open the billing portal. If you subscribed on your phone, change plans there instead.",
        );
      }
      window.open(url, "_blank", "noopener");
      Alert.alert(
        "Finish in the billing portal",
        "Pick your new plan in the tab that just opened. Your account updates automatically within a minute of the change.",
      );
    } catch (e: unknown) {
      Alert.alert(
        "Couldn't change plan",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  // A downgrade removes features the user is paying for, so confirm before
  // starting it — on native it fires a real store transaction immediately.
  function handlePlanChange(productId: string, downgradeTo?: string) {
    if (!downgradeTo) return changePlan(productId);
    track("downgrade_started", { product: productId });
    Alert.alert(
      `Move to ${downgradeTo}?`,
      `You'll keep your current features until the end of this billing period, then switch to ${downgradeTo}. Nothing is lost — your proposals stay exactly as they are.`,
      [
        { text: "Keep current plan", style: "cancel" },
        {
          text: `Move to ${downgradeTo}`,
          onPress: () => changePlan(productId),
        },
      ],
    );
  }

  async function handleRestore() {
    try {
      setBusy("restore");
      const tier = await restorePurchases();
      if (tier && tier !== "free") {
        await refreshProfile();
        Alert.alert("Restored", "Your subscription has been restored.");
        router.back();
      } else {
        Alert.alert(
          "Nothing to restore",
          "No active BidReel subscription was found for this Apple ID.",
        );
      }
    } catch (e: unknown) {
      Alert.alert(
        "Restore failed",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      {Platform.OS === "web" && (
        <View style={styles.topRow}>
          <IconButton label="Close" onPress={() => router.back()}>
            <Ionicons name="close" size={18} color={Colors.textSecondary} />
          </IconButton>
          <Text style={text.heading}>{onFreePlan ? "Upgrade" : "Change plan"}</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.container}>
        {contextLine ? <Text style={text.body}>{contextLine}</Text> : null}
        <Text style={text.muted}>
          {onFreePlan
            ? "7-day free trial · cancel anytime"
            : "Plan changes happen in the secure billing portal — downgrades apply at your next renewal."}
        </Text>

        {TIERS.map((tier) => {
          const isCurrent = currentTier === tier.tier;
          const shortName = tier.name.replace("BidReel ", "");
          const isDowngrade = TIER_RANK[tier.tier] < TIER_RANK[currentTier];
          return (
            <Card key={tier.name} style={styles.card}>
              <View style={styles.planHead}>
                <View style={styles.nameRow}>
                  <Text style={text.title}>{tier.name}</Text>
                  {tier.highlight && (
                    <View style={styles.recommendedPill}>
                      <Text style={styles.recommendedText}>Recommended</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.price}>{tier.price}</Text>
              </View>
              <View style={styles.featureList}>
                {tier.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="checkmark" size={16} color={Colors.textSecondary} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
              {isCurrent ? (
                <View style={styles.currentPlan}>
                  <Ionicons name="checkmark" size={16} color={Colors.text} />
                  <Text style={text.ui}>Current plan</Text>
                </View>
              ) : (
                <Button
                  title={
                    onFreePlan
                      ? `Start ${shortName} Trial`
                      : isDowngrade
                        ? `Downgrade to ${shortName}`
                        : `Upgrade to ${shortName}`
                  }
                  onPress={() =>
                    onFreePlan
                      ? handlePurchase(tier.productId)
                      : handlePlanChange(
                          tier.productId,
                          isDowngrade ? shortName : undefined,
                        )
                  }
                  loading={busy === tier.productId}
                  disabled={busy !== null}
                  // A downgrade is never the recommended action — keep it
                  // available but visually secondary to the current plan.
                  variant={
                    isDowngrade ? "secondary" : tier.highlight ? "primary" : "secondary"
                  }
                />
              )}
            </Card>
          );
        })}

        <View style={styles.restoreWrap}>
          <Button
            title="Restore Purchases"
            onPress={handleRestore}
            variant="ghost"
            loading={busy === "restore"}
            disabled={busy !== null}
          />
        </View>

        {/* Apple Guideline 3.1.2: auto-renewing subscriptions must link the
            Terms of Use (EULA) and Privacy Policy on the purchase screen. */}
        <View style={styles.legalRow}>
          <LegalLink label="Terms of Use" url="https://bidreel.io/terms.html" />
          <Text style={styles.legalDot}>·</Text>
          <LegalLink label="Privacy Policy" url="https://bidreel.io/privacy.html" />
        </View>
        <Text style={text.muted}>
          {Platform.OS === "web"
            ? "Subscriptions renew automatically. Cancel anytime from your account."
            : "Subscriptions renew automatically until cancelled in your App Store settings."}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  container: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  card: { gap: Spacing.md },
  planHead: { gap: Spacing.xs },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  recommendedPill: {
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm - 2,
    paddingVertical: Spacing.xxs,
  },
  recommendedText: {
    fontWeight: "600",
    fontSize: 12,
    lineHeight: Math.round(12 * 1.4),
    letterSpacing: Type.trackUi,
    color: Colors.text,
  },
  currentPlan: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 32,
  },
  price: {
    fontWeight: "700",
    fontSize: Type.heading,
    lineHeight: Math.round(Type.heading * 1.4),
    letterSpacing: Type.trackHeading,
    color: Colors.text,
  },
  featureList: { gap: Spacing.sm },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  featureText: {
    fontWeight: "400",
    fontSize: Type.body,
    lineHeight: Math.round(Type.body * 1.4),
    color: Colors.textSecondary,
  },
  restoreWrap: { alignSelf: "flex-start" },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  legalLink: {
    fontWeight: "400",
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textSecondary,
    textDecorationLine: "underline",
    paddingVertical: Spacing.xs,
  },
  legalDot: {
    fontWeight: "400",
    fontSize: Type.ui,
    color: Colors.textMuted,
  },
});
