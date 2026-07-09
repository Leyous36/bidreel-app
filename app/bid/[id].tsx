import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  Modal,
  TextInput,
} from "react-native";
import { Alert } from "@/lib/dialog";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { proposalToText, shareProposal, generateFollowup } from "@/lib/ai";
import { exportProposalPdf } from "@/lib/pdf";
import { sendProposalEmail } from "@/lib/email";
import { track } from "@/lib/analytics";
import { Bid, BidEvent, BidStatus, STATUS_LABELS } from "@/lib/types";
import { ProposalView } from "@/components/ProposalView";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { Screen } from "@/components/ui";
import { Colors, Radius, Spacing } from "@/constants/Colors";

const STATUS_OPTIONS: BidStatus[] = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "pending",
  "won",
  "lost",
];

// Keep in sync with the edge functions' PUBLIC_PROPOSAL_BASE. share-proposal
// returns the canonical URL directly; this is only used to rebuild the link
// for copy/email when we already hold the token.
const PUBLIC_BASE =
  process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? "https://bidreel.io/p/";

export default function BidDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const [bid, setBid] = useState<Bid | null>(null);
  const [events, setEvents] = useState<BidEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [followupVisible, setFollowupVisible] = useState(false);
  const [followupText, setFollowupText] = useState("");
  const [draftingFollowup, setDraftingFollowup] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [emailVisible, setEmailVisible] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    const [{ data, error }, { data: ev }] = await Promise.all([
      supabase.from("bids").select("*").eq("id", id).single(),
      supabase
        .from("bid_events")
        .select("*")
        .eq("bid_id", id)
        .order("created_at", { ascending: true }),
    ]);
    if (data) {
      setBid(data as Bid);
      setLoadError(false);
    } else {
      // No row (bad id / deleted / RLS) or a network error — show a real
      // message instead of spinning forever.
      setLoadError(true);
      if (error) console.warn("bid load failed:", error.message);
    }
    if (ev) setEvents(ev as BidEvent[]);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function setStatus(status: BidStatus) {
    if (!bid) return;
    const prev = bid.status;
    Haptics.selectionAsync();
    setBid({ ...bid, status });
    const { error } = await supabase
      .from("bids")
      .update({ status })
      .eq("id", bid.id);
    if (error) {
      // Roll the optimistic change back so the UI doesn't lie about a save
      // that didn't happen.
      setBid((b) => (b ? { ...b, status: prev } : b));
      Alert.alert("Couldn't update status", "Check your connection and retry.");
    }
  }

  async function shareLink() {
    if (!bid) return;
    setSharing(true);
    try {
      const { url, status } = await shareProposal(bid.id);
      const token = url.split("/").pop() ?? null;
      setBid((b) =>
        b
          ? {
              ...b,
              share_token: token,
              shared_at: new Date().toISOString(),
              status: status as BidStatus,
            }
          : b,
      );
      await Clipboard.setStringAsync(url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      track("proposal_shared");
      await Share.share({ message: url, url });
    } catch (e) {
      Alert.alert(
        "Couldn't create link",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    } finally {
      setSharing(false);
    }
  }

  async function copyLink() {
    if (!bid?.share_token) return;
    const url = `${PUBLIC_BASE}${bid.share_token}`;
    await Clipboard.setStringAsync(url);
    Haptics.selectionAsync();
    Alert.alert("Link copied", url);
  }

  async function copyProposal() {
    if (!bid?.proposal) return;
    const isFree = (profile?.subscription_tier ?? "free") === "free";
    let text = proposalToText(
      bid.proposal,
      bid.client_name,
      profile?.company_name,
    );
    if (isFree) {
      text += "\n\n—\nCreated with BidReel · bidreel.io";
    }
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    track("proposal_copied");
    Alert.alert("Copied", "Proposal copied — paste it into an email or doc.");
  }

  async function exportPdf() {
    if (!bid?.proposal) return;
    try {
      setExporting(true);
      await exportProposalPdf(bid.proposal, bid.client_name, profile);
      track("proposal_pdf_exported");
    } catch (e: unknown) {
      Alert.alert(
        "Export failed",
        e instanceof Error ? e.message : "Could not create the PDF.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function sendEmail() {
    if (!bid?.proposal) return;
    const email = clientEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      Alert.alert("Check the email", "Enter a valid client email address.");
      return;
    }
    try {
      setSendingEmail(true);
      await sendProposalEmail({
        bidId: bid.id,
        to: email,
        proposal: bid.proposal,
        clientName: bid.client_name,
        companyName: profile?.company_name,
        replyTo: session?.user?.email,
        subject: bid.proposal.subject,
        proposalUrl: bid.share_token
          ? `${PUBLIC_BASE}${bid.share_token}`
          : undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEmailVisible(false);
      setClientEmail("");
      track("proposal_emailed");
      if (bid.status === "draft") setStatus("sent");
      Alert.alert("Sent", `Proposal emailed to ${email}.`);
    } catch (e: unknown) {
      Alert.alert(
        "Couldn't send",
        e instanceof Error ? e.message : "Something went wrong — try again.",
      );
    } finally {
      setSendingEmail(false);
    }
  }

  async function draftFollowup() {
    if (!bid) return;
    try {
      setDraftingFollowup(true);
      setFollowupText("");
      setFollowupVisible(true);
      const daysSince = Math.max(
        1,
        Math.floor((Date.now() - new Date(bid.updated_at).getTime()) / 86400000),
      );
      const msg = await generateFollowup({
        clientName: bid.client_name,
        subject: bid.proposal?.subject ?? "your video project",
        companyName: profile?.company_name,
        producerName: profile?.producer_name,
        status: bid.status,
        daysSince,
      });
      setFollowupText(msg);
    } catch (e: unknown) {
      setFollowupVisible(false);
      Alert.alert(
        "Couldn't draft",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    } finally {
      setDraftingFollowup(false);
    }
  }

  async function copyFollowup() {
    if (!followupText) return;
    await Clipboard.setStringAsync(followupText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied", "Follow-up copied — paste it into your email or text.");
  }

  async function deleteBid() {
    if (!bid) return;
    Alert.alert("Delete bid?", `This removes the ${bid.client_name} proposal.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("bids")
            .delete()
            .eq("id", bid.id);
          if (error) {
            Alert.alert(
              "Couldn't delete",
              "Something went wrong — try again in a moment.",
            );
            return;
          }
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </Screen>
    );
  }

  if (!bid) {
    return (
      <Screen>
        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={40}
            color={Colors.textMuted}
          />
          <Text style={styles.errorTitle}>Couldn&apos;t load this proposal</Text>
          <Text style={styles.errorBody}>
            {loadError
              ? "It may have been deleted, or your connection dropped."
              : "Something went wrong."}
          </Text>
          <View style={styles.errorButtons}>
            <Pressable
              style={styles.errorRetry}
              onPress={() => {
                setLoading(true);
                load();
              }}
            >
              <Text style={styles.errorRetryText}>Retry</Text>
            </Pressable>
            <Pressable style={styles.errorBack} onPress={() => router.back()}>
              <Text style={styles.errorBackText}>Go back</Text>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setStatus(s)}
              style={[
                styles.statusChip,
                bid.status === s && {
                  backgroundColor: Colors.status[s] + "33",
                  borderColor: Colors.status[s],
                },
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  bid.status === s && { color: Colors.status[s] },
                ]}
              >
                {STATUS_LABELS[s]}
              </Text>
            </Pressable>
          ))}
        </View>

        {bid.proposal ? (
          <ProposalView proposal={bid.proposal} />
        ) : (
          <Text style={styles.noProposal}>
            No proposal was generated for this bid.
          </Text>
        )}

        {bid.share_token ? (
          <Pressable style={styles.linkBanner} onPress={copyLink}>
            <Ionicons
              name={
                bid.deposit_status === "paid"
                  ? "cash"
                  : bid.accepted_at
                    ? "checkmark-circle"
                    : "link"
              }
              size={16}
              color={
                bid.deposit_status === "paid" || bid.accepted_at
                  ? Colors.green
                  : Colors.accent
              }
            />
            <Text style={styles.linkText} numberOfLines={1}>
              {bid.deposit_status === "paid"
                ? "Deposit paid · booked · "
                : bid.accepted_at
                  ? `Accepted${bid.accepted_by_name ? " by " + bid.accepted_by_name : ""} · `
                  : bid.first_viewed_at
                    ? "Opened by client · "
                    : "Link active · "}
              bidreel.io/p/{String(bid.share_token).slice(0, 8)}…
            </Text>
            <Text style={styles.linkCopy}>Copy</Text>
          </Pressable>
        ) : null}

        <View style={styles.actionsCol}>
          <Pressable
            style={[styles.actionButton, sharing && { opacity: 0.7 }]}
            onPress={shareLink}
            disabled={sharing}
          >
            {sharing ? (
              <ActivityIndicator color="#1A1405" />
            ) : (
              <>
                <Ionicons name="share-outline" size={18} color="#1A1405" />
                <Text style={styles.actionButtonText}>
                  {bid.share_token ? "Share Link" : "Share Proposal"}
                </Text>
              </>
            )}
          </Pressable>

          {["sent", "viewed", "pending"].includes(bid.status) ? (
            <Pressable
              style={styles.followupButton}
              onPress={draftFollowup}
              disabled={draftingFollowup}
            >
              <Ionicons name="sparkles" size={18} color={Colors.accent} />
              <Text style={styles.followupButtonText}>Draft Follow-up</Text>
            </Pressable>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => setEmailVisible(true)}
            >
              <Ionicons name="mail" size={18} color={Colors.text} />
              <Text style={styles.secondaryButtonText}>Email to Client</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={exportPdf}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator color={Colors.text} size="small" />
              ) : (
                <>
                  <Ionicons name="document-text" size={18} color={Colors.text} />
                  <Text style={styles.secondaryButtonText}>Export PDF</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={copyProposal}>
              <Ionicons name="copy" size={18} color={Colors.text} />
              <Text style={styles.secondaryButtonText}>Copy Text</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={deleteBid}>
              <Ionicons name="trash" size={18} color={Colors.red} />
            </Pressable>
          </View>
        </View>

        {bid.share_token ? <ActivityTimeline events={events} /> : null}
      </ScrollView>

      <Modal
        visible={emailVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Email to client</Text>
            <Text style={styles.modalSub}>
              Send the {bid.client_name} proposal straight to their inbox.
              Replies come back to you.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="client@email.com"
              placeholderTextColor={Colors.textMuted}
              value={clientEmail}
              onChangeText={setClientEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoFocus
              editable={!sendingEmail}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setEmailVisible(false)}
                disabled={sendingEmail}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalSend}
                onPress={sendEmail}
                disabled={sendingEmail}
              >
                {sendingEmail ? (
                  <ActivityIndicator color="#1A1405" size="small" />
                ) : (
                  <Text style={styles.modalSendText}>Send</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={followupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFollowupVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Follow-up draft</Text>
            {draftingFollowup ? (
              <View style={styles.followupLoading}>
                <ActivityIndicator color={Colors.accent} />
                <Text style={styles.modalSub}>Writing a follow-up…</Text>
              </View>
            ) : (
              <ScrollView style={styles.followupScroll}>
                <Text style={styles.followupText}>{followupText}</Text>
              </ScrollView>
            )}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setFollowupVisible(false)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </Pressable>
              <Pressable
                style={styles.modalSend}
                onPress={copyFollowup}
                disabled={draftingFollowup || !followupText}
              >
                <Text style={styles.modalSendText}>Copy</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: Spacing.lg,
  },
  errorTitle: { color: Colors.text, fontSize: 17, fontWeight: "700" },
  errorBody: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  errorButtons: { flexDirection: "row", gap: Spacing.sm, marginTop: 6 },
  errorRetry: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  errorRetryText: { color: "#1A1405", fontSize: 15, fontWeight: "700" },
  errorBack: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  errorBackText: { color: Colors.text, fontSize: 15, fontWeight: "600" },
  container: { padding: Spacing.md, gap: Spacing.lg, paddingBottom: 48 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  statusChipText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  noProposal: { color: Colors.textSecondary, textAlign: "center" },
  linkBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  linkText: { flex: 1, color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  linkCopy: { color: Colors.accent, fontSize: 13, fontWeight: "700" },
  actionsCol: { gap: Spacing.sm },
  actions: { flexDirection: "row", gap: Spacing.sm },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: Colors.text, fontSize: 15, fontWeight: "700" },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: { color: "#1A1405", fontSize: 16, fontWeight: "700" },
  deleteButton: {
    width: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.red,
    alignItems: "center",
    justifyContent: "center",
  },
  followupButton: {
    flexDirection: "row",
    gap: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accent + "66",
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  followupButtonText: { color: Colors.accent, fontSize: 15, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#000A",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  modalTitle: { color: Colors.text, fontSize: 17, fontWeight: "800" },
  modalSub: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  modalInput: {
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
  },
  modalActions: { flexDirection: "row", gap: Spacing.sm, marginTop: 4 },
  modalCancel: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: { color: Colors.textSecondary, fontSize: 15, fontWeight: "600" },
  modalSend: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSendText: { color: "#1A1405", fontSize: 15, fontWeight: "700" },
  followupLoading: { alignItems: "center", gap: 10, paddingVertical: 28 },
  followupScroll: { maxHeight: 300, marginVertical: 4 },
  followupText: { color: Colors.text, fontSize: 14, lineHeight: 21 },
});
