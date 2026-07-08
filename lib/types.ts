export type BidStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "pending"
  | "won"
  | "lost";

export type DepositStatus = "none" | "requested" | "paid" | "refunded";

export type SubscriptionTier = "free" | "pro" | "studio";

export interface Profile {
  id: string;
  company_name: string | null;
  producer_name: string | null;
  email: string | null;
  phone: string | null;
  subscription_tier: SubscriptionTier;
  proposals_this_month: number;
  created_at: string;
  // Studio branding for the public proposal page (Phase 2).
  logo_url?: string | null;
  brand_color?: string | null;
  default_deposit_pct?: number | null;
  stripe_account_id?: string | null;
}

export interface TimelinePhase {
  phase: string;
  duration: string;
  details: string;
}

export interface InvestmentLine {
  item: string;
  amount: number;
}

export interface PricingTier {
  name: string; // "Essential" | "Professional" | "Premium"
  tagline: string; // one short positioning line
  total: number;
  includes: string[]; // what this tier gets — concrete bullets
  recommended?: boolean; // true on the Professional tier
}

export interface Proposal {
  subject: string;
  overview: string;
  scope: string[];
  deliverables: string[];
  timeline: TimelinePhase[];
  // New three-tier pricing. paymentTerms applies across all tiers.
  tiers?: PricingTier[];
  paymentTerms?: string;
  // Legacy single-investment shape — kept optional so proposals generated
  // before the tier upgrade still render and total correctly.
  investment?: {
    total: number;
    breakdown: InvestmentLine[];
    paymentTerms: string;
  };
  whyUs: string;
}

/**
 * Headline dollar value of a proposal, used for dashboards and the bids list.
 * Prefers the recommended tier, falls back to the first tier, then to the
 * legacy single investment total.
 */
export function proposalValue(p?: Proposal | null): number {
  if (!p) return 0;
  if (p.tiers && p.tiers.length > 0) {
    const rec = p.tiers.find((t) => t.recommended) ?? p.tiers[0];
    return rec?.total ?? 0;
  }
  return p.investment?.total ?? 0;
}

export interface Bid {
  id: string;
  user_id: string;
  client_name: string;
  template_id: string;
  project_brief: string | null;
  budget: number | null;
  timeline: string | null;
  status: BidStatus;
  proposal: Proposal | null;
  created_at: string;
  updated_at: string;
  // Trackable-link fields (Phase 2). Optional — older rows may not have them.
  share_token?: string | null;
  shared_at?: string | null;
  first_viewed_at?: string | null;
  accepted_at?: string | null;
  accepted_by_name?: string | null;
  deposit_status?: DepositStatus | null;
  deposit_amount_cents?: number | null;
  currency?: string | null;
}

export type BidEventType =
  | "shared"
  | "viewed"
  | "accepted"
  | "deposit_requested"
  | "deposit_paid";

export interface BidEvent {
  id: string;
  bid_id: string;
  type: BidEventType;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Payment {
  id: string;
  bid_id: string;
  user_id: string;
  provider: string;
  provider_session_id: string | null;
  provider_payment_id: string | null;
  amount_cents: number;
  currency: string;
  status: "created" | "paid" | "failed" | "refunded";
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string; // Ionicons name
  avgRate: string;
  freeTier: boolean;
}

export const FREE_PROPOSALS_PER_MONTH = 3;

export const STATUS_LABELS: Record<BidStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  pending: "Pending",
  won: "Won",
  lost: "Lost",
};
