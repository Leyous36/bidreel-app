/**
 * RevenueCat integration — Phase 4 (not yet enabled).
 * Safe no-ops so the production bundle never resolves the native
 * react-native-purchases module. Tier comes from the Supabase profile.
 */
import { SubscriptionTier } from "./types";

export async function initPurchases(_userId: string): Promise<void> {
  return;
}

export async function getEntitlementTier(): Promise<SubscriptionTier | null> {
  return null;
}

export async function restorePurchases(): Promise<void> {
  return;
}
