import React, { useEffect, useState } from "react";
import {
  Text,
  StyleSheet,
  ScrollView,
  View,
  Platform,
  Pressable,
  Image,
  TextInput,
  TextStyle,
} from "react-native";
import { Lock } from "lucide-react-native";
import { Alert } from "@/lib/dialog";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { restorePurchases } from "@/lib/revenue-cat";
import { deleteAccount, connectStripe } from "@/lib/account";
import { uploadStudioLogo } from "@/lib/branding";
import {
  Button,
  Card,
  Field,
  Hairline,
  PageHeader,
  Row,
  Screen,
  focusRing,
  text,
  useInteractive,
} from "@/components/ui";
import { Colors, Fonts, Radius, Spacing, Type } from "@/constants/Colors";

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

/** "#1A73E8", "1a73e8", or "#F5B" → normalized "#RRGGBB"; null if not a hex color. */
function parseHex(input: string): string | null {
  let s = input.trim();
  if (!s.startsWith("#")) s = `#${s}`;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    s = `#${s
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : null;
}

function Swatch({
  color,
  selected,
  onPress,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { hovered, focused, handlers } = useInteractive();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Brand color ${color}`}
      onPress={onPress}
      {...handlers}
      style={({ pressed }) => [
        styles.swatch,
        { backgroundColor: color },
        selected
          ? { borderColor: Colors.text }
          : hovered && { borderColor: Colors.borderStrong },
        focusRing(focused),
        pressed && { opacity: 0.8 },
      ]}
    />
  );
}

/** Locked custom-color row shown on the free plan; opens the paywall. */
function CustomColorUpsell({ onPress }: { onPress: () => void }) {
  const { hovered, focused, handlers } = useInteractive();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Custom brand color — included with Pro"
      onPress={onPress}
      {...handlers}
      style={[
        styles.customRow,
        styles.upsellRow,
        hovered && { backgroundColor: Colors.surfaceHover },
        focusRing(focused),
      ]}
    >
      <Lock size={16} color={Colors.textMuted} strokeWidth={1.75} />
      <Text style={text.muted}>Custom color — included with Pro</Text>
    </Pressable>
  );
}

function DepositChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { hovered, focused, handlers } = useInteractive();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      {...handlers}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? styles.chipActive
          : (hovered || pressed) && { backgroundColor: Colors.surfaceHover },
        focusRing(focused),
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [producerName, setProducerName] = useState("");
  const [phone, setPhone] = useState("");
  const [brandColor, setBrandColor] = useState("#F5B82E");
  const [hexDraft, setHexDraft] = useState("");
  const [hexFocused, setHexFocused] = useState(false);
  const [depositPct, setDepositPct] = useState(50);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const router = useRouter();

  // Custom brand color is a paid perk ("Your branding on proposals" — Pro).
  const isPaid = (profile?.subscription_tier ?? "free") !== "free";
  const customSelected = !BRAND_SWATCHES.includes(brandColor);

  function onHexChange(v: string) {
    setHexDraft(v);
    const hex = parseHex(v);
    if (hex) setBrandColor(hex);
  }

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
      const savedColor = profile.brand_color ?? "#F5B82E";
      setBrandColor(savedColor);
      setHexDraft(BRAND_SWATCHES.includes(savedColor) ? "" : savedColor);
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
      <PageHeader title="Settings" />
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

        <Text style={styles.sectionTitle}>Proposal branding</Text>
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
          <View style={styles.logoActions}>
            <Text style={text.label}>Studio logo</Text>
            <View style={styles.btnRow}>
              <Button
                title={logoUrl ? "Change logo" : "Upload logo"}
                variant="secondary"
                onPress={pickLogo}
                loading={uploadingLogo}
              />
            </View>
          </View>
        </View>

        <Text style={text.label}>Brand color</Text>
        <View style={styles.swatchRow}>
          {BRAND_SWATCHES.map((c) => (
            <Swatch
              key={c}
              color={c}
              selected={brandColor === c}
              onPress={() => {
                setBrandColor(c);
                setHexDraft("");
              }}
            />
          ))}
        </View>
        {isPaid ? (
          <View style={styles.customRow}>
            <View
              style={[
                styles.swatch,
                { backgroundColor: customSelected ? brandColor : Colors.surface },
                customSelected && { borderColor: Colors.text },
              ]}
            />
            <TextInput
              value={hexDraft}
              onChangeText={onHexChange}
              onFocus={() => setHexFocused(true)}
              onBlur={() => {
                setHexFocused(false);
                const hex = parseHex(hexDraft);
                if (hex) setHexDraft(hex);
              }}
              placeholder="#1A73E8"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={7}
              accessibilityLabel="Custom brand color hex code"
              style={[
                styles.hexInput,
                hexFocused && { borderColor: Colors.accent },
                hexDraft.length > 0 &&
                  !parseHex(hexDraft) &&
                  !hexFocused && { borderColor: Colors.red },
                Platform.OS === "web" &&
                  ({ outlineStyle: "none" } as unknown as TextStyle),
              ]}
            />
            <Text style={text.muted}>Any hex color — matches your brand exactly</Text>
          </View>
        ) : (
          <CustomColorUpsell onPress={() => router.push("/paywall?reason=branding")} />
        )}

        <Text style={text.label}>Default deposit</Text>
        <View style={styles.chipRow}>
          {DEPOSIT_OPTIONS.map((n) => (
            <DepositChip
              key={n}
              label={n === 0 ? "None" : `${n}%`}
              selected={depositPct === n}
              onPress={() => setDepositPct(n)}
            />
          ))}
        </View>

        <View style={styles.btnRow}>
          <Button title="Save Profile" onPress={handleSave} loading={busy} />
        </View>

        <Text style={styles.sectionTitle}>Payouts</Text>
        <Card style={styles.sectionCard}>
          {profile?.stripe_account_id ? (
            <>
              <View style={styles.statusRow}>
                <View
                  style={[styles.statusDot, { backgroundColor: Colors.green }]}
                />
                <Text style={styles.statusLabel}>Payouts connected</Text>
              </View>
              <Text style={styles.detailText}>
                Deposits on accepted proposals go straight to your Stripe account.
              </Text>
              <View style={styles.btnRow}>
                <Button
                  title="Manage / update payouts"
                  variant="secondary"
                  onPress={handleConnectPayouts}
                  loading={connectingStripe}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={text.title}>Collect deposits</Text>
              <Text style={styles.detailText}>
                Connect Stripe to let clients pay a booking deposit the moment they
                accept a proposal. Money lands in your account.
              </Text>
              <View style={styles.btnRow}>
                <Button
                  title="Connect payouts"
                  variant="secondary"
                  onPress={handleConnectPayouts}
                  loading={connectingStripe}
                />
              </View>
            </>
          )}
        </Card>

        <Text style={styles.sectionTitle}>Subscription</Text>
        <Card style={styles.sectionCard}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    tier === "free" ? Colors.status.draft : Colors.green,
                },
              ]}
            />
            <Text style={styles.statusLabel}>
              {tier === "free"
                ? "Free Plan"
                : tier === "pro"
                  ? "BidReel Pro"
                  : "BidReel Studio"}
            </Text>
          </View>
          <Text style={styles.detailText}>
            {tier === "free"
              ? "3 proposals/month · 2 templates · BidReel branding"
              : tier === "pro"
                ? "Unlimited proposals · All templates · Your branding"
                : "Everything in Pro · Client portal · Up to 5 team members"}
          </Text>
          <View style={styles.btnRow}>
            {tier === "free" && (
              <Button
                title="Upgrade"
                variant="secondary"
                onPress={() => router.push("/paywall")}
              />
            )}
            <Button
              title="Restore Purchases"
              variant="ghost"
              onPress={async () => {
                await restorePurchases();
                await refreshProfile();
                Alert.alert("Done", "Purchases restored (if any were found).");
              }}
            />
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.group}>
          <Row style={styles.groupRow}>
            <Text style={text.label}>Email</Text>
            <Text style={styles.emailValue} numberOfLines={1}>
              {profile?.email ?? session?.user.email}
            </Text>
          </Row>
          <Hairline style={styles.groupDivider} />
          <Row onPress={signOut}>
            <Text style={text.ui}>Sign Out</Text>
          </Row>
          <Hairline style={styles.groupDivider} />
          <Row
            onPress={() => {
              if (!deleting) confirmDeleteAccount();
            }}
          >
            <Text style={[text.ui, { color: Colors.red }]}>
              {deleting ? "Deleting account…" : "Delete Account"}
            </Text>
          </Row>
        </View>
        <Text style={text.muted}>
          Permanently deletes your account and all proposals. This can&apos;t be undone.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  sectionCard: { gap: Spacing.sm },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  statusLabel: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.text,
  },
  detailText: {
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textSecondary,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  logoActions: { flex: 1, gap: Spacing.sm },
  logoPreview: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImg: { width: 40, height: 40 },
  logoPlaceholder: {
    fontFamily: Fonts.semibold,
    fontSize: Type.heading,
    lineHeight: Math.round(Type.heading * 1.4),
    color: Colors.textSecondary,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: "transparent",
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 36,
  },
  upsellRow: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    marginHorizontal: -Spacing.sm,
    borderRadius: Radius.md,
  },
  hexInput: {
    width: 104,
    height: 32,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm + 2,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 28,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.accentMuted,
    borderColor: Colors.accent,
  },
  chipText: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    letterSpacing: Type.trackUi,
    color: Colors.textSecondary,
  },
  chipTextActive: { color: Colors.text },
  group: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.xs,
  },
  groupRow: { justifyContent: "space-between" },
  groupDivider: { marginHorizontal: 12 },
  emailValue: {
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textSecondary,
    flexShrink: 1,
  },
});
