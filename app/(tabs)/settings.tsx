import React, { useEffect, useState } from "react";
import {
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  View,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { restorePurchases } from "@/lib/revenue-cat";
import { deleteAccount, connectStripe } from "@/lib/ai";
import { uploadStudioLogo } from "@/lib/branding";
import { Button, Field, Screen } from "@/components/ui";
import { Colors, Radius, Spacing } from "@/constants/Colors";

const BRAND_SWATCHES = [
  "#F5B82E",
  "#4D8DF7",
  "#3DBE7B",
  "#8E6FF7",
  "#E5564F",
  "#36C5D6",
  "#FF7A1A",
  "#F4F6FA",
];
const DEPOSIT_OPTIONS = [0, 25, 50, 75];

export default function SettingsScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [producerName, setProducerName] = useState("");
  const [phone, setPhone] = useState("");
  const [brandColor, setBrandColor] = useState("#F5B82E");
  const [depositPct, setDepositPct] = useState(50);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const router = useRouter();

  async function pickLogo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Allow photo access so you can add your studio logo.",
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    const asset = res.assets?.[0];
    if (res.canceled || !asset?.base64 || !session) return;
    setUploadingLogo(true);
    try {
      const url = await uploadStudioLogo(session.user.id, asset.base64);
      setLogoUrl(url);
      await refreshProfile();
    } catch (e) {
      Alert.alert(
        "Upload failed",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleConnectPayouts() {
    setConnectingStripe(true);
    try {
      const { url, connected } = await connectStripe();
      if (connected) {
        await refreshProfile();
        Alert.alert("All set", "Your payouts are already connected.");
      } else if (url) {
        await Linking.openURL(url);
      }
    } catch (e) {
      Alert.alert(
        "Couldn't start setup",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    } finally {
      setConnectingStripe(false);
    }
  }

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
      setBrandColor(profile.brand_color ?? "#F5B82E");
      setDepositPct(profile.default_deposit_pct ?? 50);
      setLogoUrl(profile.logo_url ?? null);
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
        brand_color: brandColor,
        default_deposit_pct: depositPct,
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
        <Text style={styles.subLabel}>Proposal branding</Text>
        <View style={styles.logoRow}>
          <View style={styles.logoPreview}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logoImg} />
            ) : (
              <Text style={styles.logoPlaceholder}>
                {(companyName || "S").slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Studio logo</Text>
            <Pressable
              style={styles.logoBtn}
              onPress={pickLogo}
              disabled={uploadingLogo}
            >
              {uploadingLogo ? (
                <ActivityIndicator color={Colors.accent} />
              ) : (
                <Text style={styles.logoBtnText}>
                  {logoUrl ? "Change logo" : "Upload logo"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Brand color</Text>
        <View style={styles.swatchRow}>
          {BRAND_SWATCHES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setBrandColor(c)}
              style={[
                styles.swatch,
                { backgroundColor: c },
                brandColor === c && styles.swatchActive,
              ]}
            />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Default deposit</Text>
        <View style={styles.chipRow}>
          {DEPOSIT_OPTIONS.map((n) => (
            <Pressable
              key={n}
              onPress={() => setDepositPct(n)}
              style={[styles.chip, depositPct === n && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  depositPct === n && styles.chipTextActive,
                ]}
              >
                {n === 0 ? "None" : `${n}%`}
              </Text>
            </Pressable>
          ))}
        </View>

        <Button title="Save Profile" onPress={handleSave} loading={busy} />

        <Text style={styles.sectionTitle}>Payouts</Text>
        <View style={styles.planCard}>
          {profile?.stripe_account_id ? (
            <>
              <Text style={styles.payoutsOn}>✓ Payouts connected</Text>
              <Text style={styles.planDetail}>
                Deposits on accepted proposals go straight to your Stripe account.
              </Text>
              <Pressable onPress={handleConnectPayouts} disabled={connectingStripe}>
                <Text style={styles.restoreText}>
                  {connectingStripe ? "Opening…" : "Manage / update payouts"}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.planName}>Collect deposits</Text>
              <Text style={styles.planDetail}>
                Connect Stripe to let clients pay a booking deposit the moment they
                accept a proposal. Money lands in your account.
              </Text>
              <Button
                title="Connect payouts"
                onPress={handleConnectPayouts}
                loading={connectingStripe}
              />
            </>
          )}
        </View>

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
  subLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: Spacing.sm,
  },
  fieldLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  logoPreview: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImg: { width: 64, height: 64 },
  logoPlaceholder: { color: Colors.accent, fontSize: 26, fontWeight: "800" },
  logoBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  logoBtnText: { color: Colors.text, fontSize: 14, fontWeight: "700" },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: "transparent" },
  swatchActive: { borderColor: Colors.text },
  chipRow: { flexDirection: "row", gap: Spacing.sm },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.accent + "22", borderColor: Colors.accent },
  chipText: { color: Colors.textMuted, fontSize: 14, fontWeight: "700" },
  chipTextActive: { color: Colors.accent },
  planName: { color: Colors.accent, fontSize: 18, fontWeight: "800" },
  payoutsOn: { color: Colors.green, fontSize: 18, fontWeight: "800" },
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
