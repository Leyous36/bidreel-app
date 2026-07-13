import React from "react";
import { Platform, useWindowDimensions, View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Sidebar } from "@/components/Sidebar";
import { Colors, Type } from "@/constants/Colors";

export default function TabLayout() {
  const { width } = useWindowDimensions();
  // Wide web gets the sidebar shell; narrow web and native keep bottom tabs.
  const sidebarLayout = Platform.OS === "web" && width >= 900;

  const tabs = (
    <Tabs
      screenOptions={{
        // Web screens render their own PageHeader; native keeps its headers.
        headerShown: Platform.OS !== "web",
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: "700", fontSize: Type.heading },
        headerShadowVisible: false,
        tabBarStyle: sidebarLayout
          ? { display: "none" }
          : {
              backgroundColor: Colors.surface,
              borderTopWidth: 1,
              borderTopColor: Colors.border,
            },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontWeight: "600", fontSize: 11 },
        sceneStyle: { backgroundColor: Colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "New Proposal",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bids"
        options={{
          title: "Proposals",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="documents" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );

  if (!sidebarLayout) return tabs;

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: Colors.bg }}>
      <Sidebar />
      <View style={{ flex: 1 }}>{tabs}</View>
    </View>
  );
}
