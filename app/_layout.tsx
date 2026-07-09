import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, View } from "react-native";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { initAnalytics } from "@/lib/analytics";
import { addNotificationTapListener } from "@/lib/notifications";
import { injectWebStyles } from "@/lib/web-styles";
import { CommandPalette } from "@/components/CommandPalette";
import { Colors, Fonts, Type } from "@/constants/Colors";

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
    <>
      <Stack
        screenOptions={{
          // Web screens carry their own titles/back links; native keeps headers.
          headerShown: Platform.OS !== "web",
          headerStyle: { backgroundColor: Colors.bg },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontFamily: Fonts.semibold, fontSize: Type.heading },
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
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    initAnalytics();
    injectWebStyles();
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;
  }

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}
