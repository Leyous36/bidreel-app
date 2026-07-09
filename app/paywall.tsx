import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Platform, Pressable } from "react-native";
import { Alert } from "@/lib/dialog";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { Check, X } from "lucide-react-native";
import { useAuth } from "@/lib/auth-context";
import { purchaseProduct, restorePurchases } from "@/lib/revenue-cat";
import { track } from "@/lib/analytics";
import { Button, Card, IconButton, Screen, text, useInteractive, focusRing } from "@/components/ui";
import { Colors, Fonts, Spacing, Type } from "@/constants/Colors";
import type { SubscriptionTier } from "@/lib/types";

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
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    track("paywall_viewed");
  }, []);

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
      Alert.alert("You're in", "Your subscription is active. Enjoy BidReel.");
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
            <X size={16} color={Colors.textSecondary} strokeWidth={1.75} />
          </IconButton>
          <Text style={text.heading}>Upgrade</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={text.muted}>7-day free trial · cancel anytime</Text>

        {TIERS.map((tier) => {
          const isCurrent = profile?.subscription_tier === tier.tier;
          return (
            <Card key={tier.name} style={styles.card}>
              <View style={styles.planHead}>
                <View style={styles.nameRow}>
                  <Text style={text.title}>{tier.name}</Text>
                  {tier.highlight && <Text style={text.muted}>Recommended</Text>}
                </View>
                <Text style={styles.price}>{tier.price}</Text>
              </View>
              <View style={styles.featureList}>
                {tier.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Check size={16} color={Colors.textSecondary} strokeWidth={1.75} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
              {isCurrent ? (
                <Text style={text.muted}>Current plan</Text>
              ) : (
                <Button
                  title={`Start ${tier.name.replace("BidReel ", "")} Trial`}
                  onPress={() => handlePurchase(tier.productId)}
                  loading={busy === tier.productId}
                  disabled={busy !== null}
                  variant={tier.highlight ? "primary" : "secondary"}
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
          Subscriptions renew automatically until cancelled in your App Store
          settings.
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
    alignItems: "baseline",
    gap: Spacing.sm,
  },
  price: {
    fontFamily: Fonts.semibold,
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
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textSecondary,
    textDecorationLine: "underline",
    paddingVertical: Spacing.xs,
  },
  legalDot: {
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    color: Colors.textMuted,
  },
});
