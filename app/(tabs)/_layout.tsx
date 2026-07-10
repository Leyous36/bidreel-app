import React from "react";
import { Platform, useWindowDimensions, View } from "react-native";
import { Tabs } from "expo-router";
import {
  BarChart3,
  FileText,
  LayoutGrid,
  Plus,
  Settings,
} from "lucide-react-native";
import { Sidebar } from "@/components/Sidebar";
import { Colors, Fonts, Type } from "@/constants/Colors";

const ICON_PROPS = { size: 16, strokeWidth: 1.75 };

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
        headerTitleStyle: { fontFamily: Fonts.semibold, fontSize: Type.heading },
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
        tabBarLabelStyle: { fontFamily: Fonts.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: Colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <LayoutGrid {...ICON_PROPS} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "New Proposal",
          tabBarIcon: ({ color }) => <Plus {...ICON_PROPS} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bids"
        options={{
          title: "Proposals",
          tabBarIcon: ({ color }) => <FileText {...ICON_PROPS} color={color} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ color }) => <BarChart3 {...ICON_PROPS} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Settings {...ICON_PROPS} color={color} />,
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
