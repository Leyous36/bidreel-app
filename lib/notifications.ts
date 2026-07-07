// BidReel — push notification registration.
// Asks permission, gets the device's Expo push token, and saves it to the
// producer's profile so the Edge Functions can notify them when a proposal is
// opened, accepted, or paid. Everything here is best-effort and non-fatal.
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Show a banner + play a sound when a notification arrives in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let lastRegisteredFor: string | null = null;

export async function registerForPushNotificationsAsync(
  userId: string,
): Promise<void> {
  // Avoid re-running for the same user within a session.
  if (lastRegisteredFor === userId) return;

  try {
    // Push tokens only work on physical devices.
    if (!Device.isDevice) return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Proposal activity",
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: "#F5B82E",
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
      .data;
    if (!token) return;

    await supabase.from("profiles").update({ push_token: token }).eq("id", userId);
    lastRegisteredFor = userId;
  } catch {
    // Non-fatal: push is a nice-to-have, never block the app on it.
  }
}

export function clearPushRegistration() {
  lastRegisteredFor = null;
}
