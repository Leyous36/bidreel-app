import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { purchaseProduct, restorePurchases } from "@/lib/revenue-cat";
import { track } from "@/lib/analytics";
import { SubscriptionTier } from "@/lib/types";
import { Button, Screen } from "@/components/ui";
import { Colors, Radius, Spacing } from "@/constants/Colors";

const TIERS = [
  {
    name: "BidReel Pro",
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

export default function PaywallScreen() {
  const { session, refreshProfile } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    track("paywall_viewed");
  }, []);

  async function applyTier(tier: SubscriptionTier) {
    if (session && tier && tier !== "free") {
      await supabase
        .from("profiles")
        .update({ subscription_tier: tier })
        .eq("id", session.user.id);
    }
    await refreshProfile();
  }

  async function handlePurchase(productId: string) {
    try {
      setBusy(productId);
      const tier = await purchaseProduct(productId);
      await applyTier(tier);
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
        await applyTier(tier);
        Alert.alert("Restored", "Your subscription has been restored.");
        router.back();
      } else {
        Alert.alert(
          "Nothing to restore",
          "No active BidReel subscription was found for this Apple ID.",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Stop leaving money on the table</Text>
        <Text style={styles.subtitle}>7-day free trial · cancel anytime</Text>

        {TIERS.map((tier) => (
          <View
            key={tier.name}
            style={[styles.card, tier.highlight && styles.cardHighlight]}
          >
            {tier.highlight && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>MOST POPULAR</Text>
              </View>
            )}
            <Text style={styles.tierName}>{tier.name}</Text>
            <Text style={styles.tierPrice}>{tier.price}</Text>
            <View style={{ gap: 8 }}>
              {tier.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.green} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
            <Button
              title={`Start ${tier.name.replace("BidReel ", "")} Trial`}
              onPress={() => handlePurchase(tier.productId)}
              loading={busy === tier.productId}
              disabled={busy !== null}
              variant={tier.highlight ? "primary" : "secondary"}
            />
          </View>
        ))}

        <Pressable onPress={handleRestore} disabled={busy !== null}>
          <Text style={styles.restoreText}>
            {busy === "restore" ? "Restoring…" : "Restore Purchases"}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 48 },
  title: { color: Colors.text, fontSize: 26, fontWeight: "800" },
  subtitle: { color: Colors.textSecondary, fontSize: 14, marginTop: -8 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardHighlight: { borderColor: Colors.accent, borderWidth: 2 },
  popularBadge: {
    alignSelf: "flex-start",
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  popularText: { color: "#1A1405", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  tierName: { color: Colors.text, fontSize: 20, fontWeight: "800" },
  tierPrice: { color: Colors.accent, fontSize: 28, fontWeight: "900", marginTop: -8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { color: Colors.textSecondary, fontSize: 14 },
  restoreText: {
    color: Colors.blue,
    textAlign: "center",
    fontSize: 14,
    paddingVertical: Spacing.sm,
  },
});
