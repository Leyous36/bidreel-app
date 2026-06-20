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
  p.investment.breakdown.forEach((b) =>
    lines.push(`• ${b.item}: $${b.amount.toLocaleString()}`),
  );
  lines.push(`Total: $${p.investment.total.toLocaleString()}`);
  lines.push(`Payment terms: ${p.investment.paymentTerms}`);
  lines.push("");
  lines.push("WHY US");
  lines.push(p.whyUs);
  return lines.join("\n");
}
