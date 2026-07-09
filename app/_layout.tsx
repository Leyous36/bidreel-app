import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { initAnalytics } from "@/lib/analytics";
import { addNotificationTapListener } from "@/lib/notifications";
import { Colors } from "@/constants/Colors";

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "auth";
    if (!session && !inAuthGroup) {
      router.replace("/auth");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, loading, segments, router]);

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
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.text,
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
  );
}

export default function RootLayout() {
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}
