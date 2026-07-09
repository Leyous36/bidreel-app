import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Alert } from "@/lib/dialog";
import { useRouter } from "expo-router";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button, Field, Screen, text } from "@/components/ui";
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
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // With email confirmation enabled, signUp returns no session — tell
        // the user instead of silently bouncing back to this screen.
        if (!data.session) {
          Alert.alert(
            "Check your email",
            `We sent a confirmation link to ${email}. Tap it, then sign in here.`,
          );
          setMode("signin");
          return;
        }
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

  async function handleForgotPassword() {
    if (!email) {
      Alert.alert(
        "Enter your email",
        "Type your email above, then tap “Forgot password?” again.",
      );
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://bidreel.io/reset-password.html",
      });
      if (error) throw error;
      Alert.alert(
        "Reset link sent",
        `Check ${email} for a link to set a new password, then come back and sign in.`,
      );
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
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={text.heading}>BidReel</Text>
            <Text style={[text.body, styles.tagline]}>
              Win more video production work.
            </Text>
          </View>

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
          </View>

          <View style={styles.secondary}>
            <Button
              title={
                mode === "signin"
                  ? "New here? Create an account"
                  : "Already have an account? Sign in"
              }
              onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
              variant="ghost"
            />
            {mode === "signin" ? (
              <Button
                title="Forgot password?"
                onPress={handleForgotPassword}
                disabled={busy}
                variant="ghost"
              />
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  tagline: { color: Colors.textSecondary },
  form: { gap: Spacing.md },
  secondary: {
    alignItems: "flex-start",
    gap: Spacing.xs,
  },
});
