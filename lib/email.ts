import { supabase } from "./supabase";
import { Proposal } from "./types";

/**
 * Emails a proposal to a client via the `send-proposal-email` Edge Function,
 * which holds the Resend API key server-side.
 */
export async function sendProposalEmail(params: {
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
  if (error) throw new Error(error.message || "Failed to send email");
  const errMsg = (data as { error?: string } | null)?.error;
  if (errMsg) throw new Error(errMsg);
}
