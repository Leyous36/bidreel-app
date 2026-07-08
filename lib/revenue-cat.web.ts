/**
 * RevenueCat — web stub. react-native-purchases is native-only, so the web app
 * (app.bidreel.io) uses these no-ops. Metro automatically picks this file for web.
 * Subscriptions are managed in the mobile app.
 */
import { SubscriptionTier } from "./types";

export const ENTITLEMENTS = { pro: "pro", studio: "studio" } as const;

export async function initPurchases(_userId: string): Promise<void> {}

export async function getEntitlementTier(): Promise<SubscriptionTier | null> {
  return null;
}

export async function getOfferingPackages(): Promise<any[]> {
  return [];
}

export async function purchaseProduct(
  _productId: string,
): Promise<SubscriptionTier> {
  throw new Error("Subscriptions are managed in the BidReel mobile app.");
}

export async function restorePurchases(): Promise<SubscriptionTier | null> {
  return null;
}
