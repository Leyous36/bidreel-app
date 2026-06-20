export type BidStatus = "draft" | "sent" | "viewed" | "pending" | "won" | "lost";

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

export interface Proposal {
  subject: string;
  overview: string;
  scope: string[];
  deliverables: string[];
  timeline: TimelinePhase[];
  investment: {
    total: number;
    breakdown: InvestmentLine[];
    paymentTerms: string;
  };
  whyUs: string;
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
  pending: "Pending",
  won: "Won",
  lost: "Lost",
};
