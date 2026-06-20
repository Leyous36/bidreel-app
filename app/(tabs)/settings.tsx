import React, { useEffect, useState } from "react";
import {
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  View,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { restorePurchases } from "@/lib/revenue-cat";
import { deleteAccount } from "@/lib/ai";
import { Button, Field, Screen } from "@/components/ui";
import { Colors, Radius, Spacing } from "@/constants/Colors";

export default function SettingsScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [producerName, setProducerName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  function confirmDeleteAccount() {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account and every proposal you've created. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete forever",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              // signOut inside deleteAccount triggers the auth gate back to /auth
            } catch (e) {
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : "Could not delete account.",
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  useEffect(() => {
    if (profile) {
      setCompanyName(profile.company_name ?? "");
      setProducerName(profile.producer_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  async function handleSave() {
    if (!session) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        company_name: companyName || null,
        producer_name: producerName || null,
        phone: phone || null,
      })
      .eq("id", session.user.id);
    setBusy(false);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    await refreshProfile();
    Alert.alert("Saved", "Your studio profile is updated.");
  }

  const tier = profile?.subscription_tier ?? "free";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>Studio Profile</Text>
        <Field
          label="Company / Studio name"
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="AmeriFilms"
        />
        <Field
          label="Your name"
          value={producerName}
          onChangeText={setProducerName}
          placeholder="Souley Oumarou"
        />
        <Field
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="(937) 555-0100"
        />
        <Button title="Save Profile" onPress={handleSave} loading={busy} />

        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.planCard}>
          <Text style={styles.planName}>
            {tier === "free"
              ? "Free Plan"
              : tier === "pro"
                ? "BidReel Pro"
                : "BidReel Studio"}
          </Text>
          <Text style={styles.planDetail}>
            {tier === "free"
              ? "3 proposals/month · 2 templates · BidReel branding"
              : tier === "pro"
                ? "Unlimited proposals · All templates · Your branding"
                : "Everything in Pro · Client portal · Up to 5 team members"}
          </Text>
          {tier === "free" && (
            <Button title="Upgrade" onPress={() => router.push("/paywall")} />
          )}
          <Pressable
            onPress={async () => {
              await restorePurchases();
              await refreshProfile();
              Alert.alert("Done", "Purchases restored (if any were found).");
            }}
          >
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.email}>{profile?.email ?? session?.user.email}</Text>
        <Button title="Sign Out" variant="secondary" onPress={signOut} />

        <Pressable onPress={confirmDeleteAccount} disabled={deleting}>
          <Text style={styles.deleteText}>
            {deleting ? "Deleting account…" : "Delete Account"}
          </Text>
        </Pressable>
        <Text style={styles.deleteHint}>
          Permanently deletes your account and all proposals. This can't be undone.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 48 },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: Spacing.sm,
  },
  planCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  planName: { color: Colors.accent, fontSize: 18, fontWeight: "800" },
  planDetail: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  restoreText: {
    color: Colors.blue,
    fontSize: 13,
    textAlign: "center",
    paddingTop: 4,
  },
  deleteText: {
    color: Colors.red,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    paddingTop: Spacing.sm,
  },
  deleteHint: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
  email: { color: Colors.textMuted, fontSize: 14 },
});
