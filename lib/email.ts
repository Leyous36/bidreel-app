import { supabase } from "./supabase";
import { Proposal } from "./types";

/**
 * Emails a proposal to a client via the `send-proposal-email` Edge Function,
 * which holds the Resend API key server-side.
 */
export async function sendProposalEmail(params: {
  bidId: string;
  to: string;
  proposal: Proposal;
  clientName: string;
  companyName?: string | null;
  replyTo?: string | null;
  subject?: string;
  proposalUrl?: string;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke("send-proposal-email", {
    body: params,
  });
  if (error) {
    // The real reason (ownership failure, daily cap) is in the response body.
    let message = error.message || "Failed to send email";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.clone === "function") {
      try {
        const body = await ctx.clone().json();
        if (body?.error) message = body.error;
      } catch {
        // keep generic message
      }
    }
    throw new Error(message);
  }
  const errMsg = (data as { error?: string } | null)?.error;
  if (errMsg) throw new Error(errMsg);
}
