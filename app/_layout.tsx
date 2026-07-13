import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, View } from "react-native";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { initAnalytics } from "@/lib/analytics";
import { addNotificationTapListener } from "@/lib/notifications";
import { injectWebStyles } from "@/lib/web-styles";
import { CommandPalette } from "@/components/CommandPalette";
import { Colors, Type } from "@/constants/Colors";

function RootNavigator() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "auth";
    if (!session && !inAuthGroup) {
      router.replace("/auth");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    } else if (
      // Studio branding goes on every proposal, but the email-confirmation
      // signup path never passes through onboarding (signUp returns no
      // session, so auth.tsx can't route there). Gate on profile
      // completeness instead of the signup path: any signed-in user with no
      // studio name gets onboarding first. `profile` must be loaded (non-null)
      // so we don't flash onboarding while the profile is still fetching.
      session &&
      profile &&
      !profile.company_name &&
      segments[0] !== "onboarding"
    ) {
      router.replace("/onboarding");
    }
  }, [session, profile, loading, segments, router]);

  // Tapping a proposal-activity push opens that proposal (only while signed in).
  useEffect(() => {
    if (!session) return;
    return addNotificationTapListener((bidId) => router.push(`/bid/${bidId}`));
  }, [session, router]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          // Web screens carry their own titles/back links; native keeps headers.
          headerShown: Platform.OS !== "web",
          headerStyle: { backgroundColor: Colors.bg },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: "700", fontSize: Type.heading },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="bid/[id]" options={{ title: "Proposal" }} />
        <Stack.Screen
          name="paywall"
          options={{ presentation: "modal", title: "Upgrade" }}
        />
      </Stack>
      {session ? <CommandPalette /> : null}
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    initAnalytics();
    injectWebStyles();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}
