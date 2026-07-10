/**
 * RevenueCat Web Billing — the web app's subscription rail (app.bidreel.io).
 *
 * Uses @revenuecat/purchases-js so the browser can sell the SAME "pro"/"studio"
 * subscriptions the phone apps do, through the SAME RevenueCat entitlements and
 * the SAME rc-webhook that already writes profiles.subscription_tier. That keeps
 * entitlements unified across web and mobile with no extra backend. Metro picks
 * this file over revenue-cat.ts on the web build.
 *
 * One-time setup (RevenueCat dashboard):
 *   1. Enable Web Billing and connect a Stripe account.
 *   2. Create web products for the "pro" and "studio" entitlements whose product
 *      identifiers match the paywall's productIds — bidreel_pro_monthly and
 *      bidreel_studio_monthly — and attach them to the current Offering.
 *   3. Copy the Web Billing PUBLIC API key and set it as
 *      EXPO_PUBLIC_REVENUECAT_WEB_KEY in .env before the web export.
 *
 * Until that key is set every call no-ops and purchaseProduct explains the app
 * is mobile-only — the same safe behavior as before Web Billing existed.
 */
import { Purchases, type Package } from "@revenuecat/purchases-js";
import { SubscriptionTier } from "./types";

export const ENTITLEMENTS = { pro: "pro", studio: "studio" } as const;

const webKey = process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY ?? "";

/** The configured singleton, or null if Web Billing isn't set up yet. */
function instance(): Purchases | null {
  if (!webKey) return null;
  try {
    return Purchases.isConfigured() ? Purchases.getSharedInstance() : null;
  } catch {
    return null;
  }
}

function tierFromActive(active: Record<string, unknown>): SubscriptionTier {
  if (active[ENTITLEMENTS.studio]) return "studio";
  if (active[ENTITLEMENTS.pro]) return "pro";
  return "free";
}

/** Configure RevenueCat Web Billing for the signed-in user (safe to re-call). */
export async function initPurchases(userId: string): Promise<void> {
  if (!webKey) return;
  try {
    if (!Purchases.isConfigured()) {
      Purchases.configure({ apiKey: webKey, appUserId: userId });
    }
  } catch (e) {
    console.warn("RevenueCat web init failed", e);
  }
}

/** Current entitlement tier from RevenueCat, or null if unavailable. */
export async function getEntitlementTier(): Promise<SubscriptionTier | null> {
  const p = instance();
  if (!p) return null;
  try {
    const info = await p.getCustomerInfo();
    return tierFromActive(info.entitlements.active);
  } catch {
    return null;
  }
}

/** Packages from the current Web Billing offering. */
export async function getOfferingPackages(): Promise<Package[]> {
  const p = instance();
  if (!p) return [];
  try {
    const offerings = await p.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

/** Purchase the package whose web product id matches productId. */
export async function purchaseProduct(
  productId: string,
): Promise<SubscriptionTier> {
  const p = instance();
  if (!p) {
    throw new Error(
      "Web checkout isn't available yet — subscribe in the BidReel mobile app.",
    );
  }
  const packages = await getOfferingPackages();
  const pkg = packages.find(
    (x) =>
      x.webBillingProduct?.identifier === productId ||
      x.rcBillingProduct?.identifier === productId ||
      x.identifier === productId,
  );
  if (!pkg) throw new Error("That plan isn't available right now.");
  const { customerInfo } = await p.purchase({ rcPackage: pkg });
  return tierFromActive(customerInfo.entitlements.active);
}

/**
 * On web the RevenueCat app user id IS the Supabase user, so entitlements are
 * already tied to the account — "restore" is just a fresh entitlement read.
 */
export async function restorePurchases(): Promise<SubscriptionTier | null> {
  return getEntitlementTier();
}

/**
 * RevenueCat Web Billing customer portal (cancel / switch plans — plan
 * changes follow the subscription change paths configured in the dashboard).
 * Null when there's no active web subscription.
 */
export async function getManagementURL(): Promise<string | null> {
  const p = instance();
  if (!p) return null;
  try {
    return (await p.getCustomerInfo()).managementURL ?? null;
  } catch {
    return null;
  }
}
