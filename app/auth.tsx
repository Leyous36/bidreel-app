import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button, Field, Screen } from "@/components/ui";
import { Colors, Spacing } from "@/constants/Colors";

export default function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (!isSupabaseConfigured) {
      Alert.alert(
        "Setup needed",
        "Add your Supabase URL and anon key to the .env file first (see README).",
      );
      return;
    }
    if (!email || !password) {
      Alert.alert("Missing info", "Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        router.replace("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={styles.logo}>
          Bid<Text style={{ color: Colors.accent }}>Reel</Text>
        </Text>
        <Text style={styles.tagline}>
          Win more video production work.
        </Text>

        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@studio.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          <Button
            title={mode === "signin" ? "Sign In" : "Create Account"}
            onPress={handleSubmit}
            loading={busy}
          />
          <Pressable
            onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            <Text style={styles.switchText}>
              {mode === "signin"
                ? "New here? Create an account"
                : "Already have an account? Sign in"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  logo: {
    color: Colors.text,
    fontSize: 40,
    fontWeight: "900",
    textAlign: "center",
  },
  tagline: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  form: { gap: Spacing.md },
  switchText: {
    color: Colors.blue,
    textAlign: "center",
    fontSize: 14,
    paddingVertical: Spacing.sm,
  },
});
