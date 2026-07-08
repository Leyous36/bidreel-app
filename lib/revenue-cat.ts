/**
 * RevenueCat integration (native — iOS/Android).
 *
 * react-native-purchases is a native module: it works in dev/production builds
 * but NOT in Expo Go. It's loaded lazily so a missing module degrades to no-ops
 * instead of crashing. The web build uses revenue-cat.web.ts instead of this file.
 *
 * Setup:
 *   npx expo install react-native-purchases
 *   set EXPO_PUBLIC_REVENUECAT_IOS_KEY (RevenueCat → API keys → Apple, appl_...)
 *   entitlement identifiers in RevenueCat must be "pro" and "studio"
 */
import { Platform } from "react-native";
import { SubscriptionTier } from "./types";

const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";
const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

export const ENTITLEMENTS = { pro: "pro", studio: "studio" } as const;

function getPurchases(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-purchases").default;
  } catch {
    return null;
  }
}

function tierFromInfo(info: any): SubscriptionTier {
  const active = info?.entitlements?.active ?? {};
  if (active[ENTITLEMENTS.studio]) return "studio";
  if (active[ENTITLEMENTS.pro]) return "pro";
  return "free";
}

/** Configure RevenueCat for the signed-in user. Safe to call on every launch. */
export async function initPurchases(userId: string): Promise<void> {
  const key = Platform.OS === "android" ? androidKey : iosKey;
  if (!key) return;
  const P = getPurchases();
  if (!P) return;
  try {
    P.configure({ apiKey: key, appUserID: userId });
  } catch (e) {
    console.warn("RevenueCat init failed", e);
  }
}

/** Current entitlement tier from RevenueCat, or null if unavailable. */
export async function getEntitlementTier(): Promise<SubscriptionTier | null> {
  const P = getPurchases();
  if (!P) return null;
  try {
    return tierFromInfo(await P.getCustomerInfo());
  } catch {
    return null;
  }
}

/** Packages from the current RevenueCat offering. */
export async function getOfferingPackages(): Promise<any[]> {
  const P = getPurchases();
  if (!P) return [];
  try {
    const offerings = await P.getOfferings();
    return offerings?.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

/** Purchase the package whose store product id matches productId. */
export async function purchaseProduct(
  productId: string,
): Promise<SubscriptionTier> {
  const P = getPurchases();
  if (!P) throw new Error("In-app purchases aren't available in this build.");
  const packages = await getOfferingPackages();
  const pkg = packages.find((p: any) => p?.product?.identifier === productId);
  if (!pkg) throw new Error("That plan isn't available right now.");
  const { customerInfo } = await P.purchasePackage(pkg);
  return tierFromInfo(customerInfo);
}

/** Restore prior purchases for this Apple ID. */
export async function restorePurchases(): Promise<SubscriptionTier | null> {
  const P = getPurchases();
  if (!P) return null;
  try {
    return tierFromInfo(await P.restorePurchases());
  } catch (e) {
    console.warn("Restore failed", e);
    return null;
  }
}
