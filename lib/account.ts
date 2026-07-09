import { supabase } from "./supabase";

/**
 * Permanently deletes the signed-in user's account and all their data
 * via the `delete-account` Edge Function, then clears the local session.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-account", {
    body: {},
  });
  if (error) throw new Error(error.message || "Account deletion failed");
  await supabase.auth.signOut();
}

export interface ConnectResult {
  url?: string;
  connected?: boolean;
}

/**
 * Starts (or resumes) Stripe Connect onboarding so the producer can collect
 * deposits to their own account. Returns a hosted onboarding URL, or
 * { connected: true } if payouts are already set up.
 */
export async function connectStripe(): Promise<ConnectResult> {
  const { data, error } = await supabase.functions.invoke<ConnectResult>(
    "stripe-connect",
    { body: {} },
  );
  if (error) throw new Error(error.message || "Couldn't start Stripe setup");
  if ((data as unknown as { error?: string })?.error) {
    throw new Error((data as unknown as { error?: string }).error);
  }
  return data ?? {};
}
