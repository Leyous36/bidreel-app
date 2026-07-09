import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Alert } from "@/lib/dialog";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button, Field, Screen, text } from "@/components/ui";
import { Colors, Spacing } from "@/constants/Colors";

export default function OnboardingScreen() {
  const { session, refreshProfile } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [producerName, setProducerName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

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
    router.replace("/(tabs)");
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.panel}>
            <View style={styles.header}>
              <Text style={text.heading}>Set up your studio</Text>
              <Text style={[text.body, styles.subtitle]}>
                This goes on every proposal you generate — make it count.
              </Text>
            </View>
            <View style={styles.form}>
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
                label="Phone (optional)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="(937) 555-0100"
              />
              <Button
                title="Start Bidding"
                onPress={handleSave}
                loading={busy}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  panel: {
    width: "100%",
    maxWidth: 360,
    gap: Spacing.lg,
  },
  header: { gap: Spacing.xs },
  subtitle: { color: Colors.textSecondary },
  form: { gap: Spacing.md },
});
