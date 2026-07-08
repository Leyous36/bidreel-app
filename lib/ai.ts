import { supabase } from "./supabase";
import { Proposal } from "./types";

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

export interface ShareResult {
  url: string;
  token: string;
  status: string;
}

/**
 * Creates (or reuses) a public share link for a proposal via the
 * `share-proposal` Edge Function. Returns the client-facing URL.
 */
export async function shareProposal(bidId: string): Promise<ShareResult> {
  const { data, error } = await supabase.functions.invoke<ShareResult>(
    "share-proposal",
    { body: { bidId } },
  );
  if (error) throw new Error(error.message || "Couldn't create share link");
  if (!data?.url) {
    throw new Error(
      (data as unknown as { error?: string })?.error ?? "No link returned",
    );
  }
  return data;
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

export interface GenerateParams {
  template: string;
  clientName: string;
  brief?: string;
  budget?: string;
  timeline?: string;
  producerName?: string;
  companyName?: string;
}

/**
 * Calls the `generate-proposal` Supabase Edge Function, which holds the
 * Anthropic API key server-side. Never call Anthropic directly from the app.
 */
export async function generateProposal(
  params: GenerateParams,
): Promise<Proposal> {
  const { data, error } = await supabase.functions.invoke<Proposal>(
    "generate-proposal",
    { body: params },
  );

  if (error) {
    throw new Error(error.message || "Proposal generation failed");
  }
  if (!data || (data as unknown as { error?: string }).error) {
    throw new Error(
      (data as unknown as { error?: string })?.error ??
        "Proposal generation returned no data",
    );
  }
  return data;
}

/**
 * Drafts a short follow-up message for a proposal awaiting a response, via the
 * `generate-followup` Edge Function (holds the Anthropic key server-side).
 */
export async function generateFollowup(params: {
  clientName: string;
  subject: string;
  companyName?: string | null;
  producerName?: string | null;
  status: string;
  daysSince: number;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{
    message?: string;
    error?: string;
  }>("generate-followup", { body: params });
  if (error) throw new Error(error.message || "Could not draft a follow-up.");
  if (data?.error) throw new Error(data.error);
  return data?.message ?? "";
}

/** Format a proposal as plain text for copy/paste into email. */
export function proposalToText(
  p: Proposal,
  clientName: string,
  companyName?: string | null,
): string {
  const lines: string[] = [];
  lines.push(p.subject.toUpperCase());
  lines.push("");
  lines.push(`Prepared for ${clientName}${companyName ? ` by ${companyName}` : ""}`);
  lines.push("");
  lines.push("OVERVIEW");
  lines.push(p.overview);
  lines.push("");
  lines.push("SCOPE OF WORK");
  p.scope.forEach((s) => lines.push(`• ${s}`));
  lines.push("");
  lines.push("DELIVERABLES");
  p.deliverables.forEach((d) => lines.push(`• ${d}`));
  lines.push("");
  lines.push("TIMELINE");
  p.timeline.forEach((t) =>
    lines.push(`• ${t.phase} (${t.duration}): ${t.details}`),
  );
  lines.push("");
  lines.push("INVESTMENT");
  if (p.tiers && p.tiers.length > 0) {
    p.tiers.forEach((t) => {
      const flag = t.recommended ? "  (Recommended)" : "";
      lines.push(`${t.name.toUpperCase()} — $${t.total.toLocaleString()}${flag}`);
      if (t.tagline) lines.push(t.tagline);
      t.includes.forEach((inc) => lines.push(`• ${inc}`));
      lines.push("");
    });
    if (p.paymentTerms) lines.push(`Payment terms: ${p.paymentTerms}`);
  } else if (p.investment) {
    p.investment.breakdown.forEach((b) =>
      lines.push(`• ${b.item}: $${b.amount.toLocaleString()}`),
    );
    lines.push(`Total: $${p.investment.total.toLocaleString()}`);
    lines.push(`Payment terms: ${p.investment.paymentTerms}`);
  }
  lines.push("");
  lines.push("WHY US");
  lines.push(p.whyUs);
  return lines.join("\n");
}
