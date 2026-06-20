/**
 * RevenueCat integration — Phase 4.
 *
 * react-native-purchases is a NATIVE module: it does not run in Expo Go.
 * To keep the app fully runnable in Expo Go during Phases 1–3, this module
 * is a safe wrapper that reports tier from the Supabase profile until
 * RevenueCat keys are configured and you move to a dev build:
 *
 *   npx expo install react-native-purchases @revenuecat/react-native-purchases-ui
 *   eas build --profile development
 *
 * Then flip USE_REVENUECAT to true and the dynamic import below activates.
 */
import { Platform } from "react-native";
import { SubscriptionTier } from "./types";

const USE_REVENUECAT = false;

const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";
const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

export async function initPurchases(userId: string): Promise<void> {
  if (!USE_REVENUECAT) return;
  const key = Platform.OS === "ios" ? iosKey : androidKey;
  if (!key) return;
  try {
    // Dynamic require so Expo Go never tries to load the native module.
    const Purchases = require("react-native-purchases").default;
    Purchases.configure({ apiKey: key, appUserID: userId });
  } catch (e) {
    console.warn("RevenueCat unavailable:", e);
  }
}

/** Returns the entitlement tier from RevenueCat, or null if not active. */
export async function getEntitlementTier(): Promise<SubscriptionTier | null> {
  if (!USE_REVENUECAT) return null;
  try {
    const Purchases = require("react-native-purchases").default;
    const { customerInfo } = await Purchases.getCustomerInfo();
    if (customerInfo.entitlements.active["studio"]) return "studio";
    if (customerInfo.entitlements.active["pro"]) return "pro";
    return "free";
  } catch {
    return null;
  }
}

export async function restorePurchases(): Promise<void> {
  if (!USE_REVENUECAT) return;
  try {
    const Purchases = require("react-native-purchases").default;
    await Purchases.restorePurchases();
  } catch (e) {
    console.warn("Restore failed:", e);
  }
}
