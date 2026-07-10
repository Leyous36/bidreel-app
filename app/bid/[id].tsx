import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
  Modal,
  Platform,
} from "react-native";
import { Alert } from "@/lib/dialog";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { ArrowLeft } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { proposalToText, shareProposal, generateFollowup } from "@/lib/ai";
import { exportProposalPdf } from "@/lib/pdf";
import { sendProposalEmail } from "@/lib/email";
import { track } from "@/lib/analytics";
import { Bid, BidEvent, BidStatus } from "@/lib/types";
import { ProposalView } from "@/components/ProposalView";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Screen,
  Button,
  IconButton,
  Field,
  Row,
  EmptyState,
  OverflowMenu,
  MenuItem,
  text,
} from "@/components/ui";
import {
  Colors,
  Fonts,
  Radius,
  Shadow,
  Spacing,
  Type,
} from "@/constants/Colors";

// Sent/Viewed/Accepted/deposit are set automatically by the trackable link —
// letting a human hand-pick them would corrupt the tracking signal. People
// only decide outcomes: won, lost, or back to draft.
const DECIDED: BidStatus[] = ["won", "lost"];

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
  const [sendingFollowup, setSendingFollowup] = useState(false);
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

  // Humans set outcomes (draft/won/lost). "sent" is allowed only because
  // sharing or emailing a draft advances it programmatically — viewed and
  // accepted stay exclusively link/webhook-driven.
  async function setStatus(
    status: Extract<BidStatus, "draft" | "sent" | "won" | "lost">,
  ) {
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
      if (Platform.OS === "web") {
        Alert.alert(
          "Link created & copied",
          "Paste it into an email or text to your client.",
        );
      } else {
        // The native share sheet is the confirmation; a dismissed or absent
        // sheet must not read as a failure — the link is already created + copied.
        try {
          await Share.share({ message: url, url });
        } catch {
          /* user dismissed the share sheet */
        }
      }
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

  async function sendFollowup() {
    if (!bid?.proposal || !followupText.trim()) return;
    const email = clientEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      Alert.alert("Check the email", "Enter a valid client email address.");
      return;
    }
    try {
      setSendingFollowup(true);
      await sendProposalEmail({
        bidId: bid.id,
        to: email,
        proposal: bid.proposal,
        clientName: bid.client_name,
        companyName: profile?.company_name,
        replyTo: session?.user?.email,
        subject: `Following up: ${bid.proposal.subject ?? "your video project"}`,
        proposalUrl: bid.share_token
          ? `${PUBLIC_BASE}${bid.share_token}`
          : undefined,
        followupMessage: followupText.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFollowupVisible(false);
      track("followup_emailed");
      Alert.alert("Sent", `Follow-up emailed to ${email}. Replies come back to you.`);
    } catch (e: unknown) {
      Alert.alert(
        "Couldn't send",
        e instanceof Error ? e.message : "Something went wrong — try again.",
      );
    } finally {
      setSendingFollowup(false);
    }
  }

  async function deleteBid() {
    if (!bid) return;
    Alert.alert(
      "Delete proposal?",
      `This removes the ${bid.client_name} proposal.`,
      [
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

  const topBar =
    Platform.OS === "web" ? (
      <View style={styles.topBar}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={16} color={Colors.textSecondary} strokeWidth={1.75} />
        </IconButton>
        <Text style={text.heading} numberOfLines={1}>
          {bid?.client_name ?? "Proposal"}
        </Text>
      </View>
    ) : null;

  if (loading) {
    return (
      <Screen>
        {topBar}
        <View style={styles.center}>
          <ActivityIndicator color={Colors.textSecondary} size="large" />
        </View>
      </Screen>
    );
  }

  if (!bid) {
    return (
      <Screen>
        {topBar}
        <View style={styles.center}>
          <Text style={text.title}>Couldn&apos;t load this proposal</Text>
          <Text style={styles.errorBody}>
            {loadError
              ? "It may have been deleted, or your connection dropped."
              : "Something went wrong."}
          </Text>
          <View style={styles.errorButtons}>
            <Button
              title="Retry"
              onPress={() => {
                setLoading(true);
                load();
              }}
            />
            <Button title="Go back" variant="ghost" onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    );
  }

  const decided = DECIDED.includes(bid.status);
  const menuItems: MenuItem[] = [
    ...(bid.share_token ? [{ label: "Copy link", onPress: copyLink }] : []),
    { label: "Copy text", onPress: copyProposal },
    { label: "Export PDF", onPress: exportPdf },
    // Once decided, the reverse transitions move here so the default view
    // isn't cluttered with second-guessing controls.
    ...(decided
      ? [
          {
            label: bid.status === "won" ? "Mark as lost" : "Mark as won",
            onPress: () => setStatus(bid.status === "won" ? "lost" : "won"),
          },
          { label: "Revert to draft", onPress: () => setStatus("draft") },
        ]
      : []),
    { label: "Delete", onPress: deleteBid, danger: true },
  ];

  return (
    <Screen>
      {topBar}
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.actionsRow}>
          <Button
            title={bid.share_token ? "Share link" : "Share proposal"}
            onPress={shareLink}
            loading={sharing}
          />
          <Button
            title="Email to client"
            variant="secondary"
            onPress={() => setEmailVisible(true)}
          />
          {["sent", "viewed", "pending"].includes(bid.status) ? (
            <Button
              title="Draft follow-up"
              variant="secondary"
              onPress={draftFollowup}
              disabled={draftingFollowup}
            />
          ) : null}
          <View style={styles.actionsSpacer} />
          {exporting ? <Text style={text.muted}>Exporting PDF…</Text> : null}
          <OverflowMenu items={menuItems} />
        </View>

        <View style={styles.statusRow}>
          <StatusBadge status={bid.status} />
          <Text style={text.muted}>
            {decided
              ? "Tracking has ended for this proposal."
              : "Sent, viewed and accepted update automatically from your link."}
          </Text>
          {!decided && (
            <>
              <View style={styles.actionsSpacer} />
              <Button
                title="Mark won"
                variant="secondary"
                onPress={() => setStatus("won")}
              />
              <Button
                title="Mark lost"
                variant="danger"
                onPress={() => setStatus("lost")}
              />
            </>
          )}
        </View>

        {bid.share_token ? (
          <Row onPress={copyLink} style={styles.linkRow}>
            <View
              style={[
                styles.linkDot,
                {
                  backgroundColor:
                    bid.deposit_status === "paid" || bid.accepted_at
                      ? Colors.green
                      : bid.first_viewed_at
                        ? Colors.status.viewed
                        : Colors.status.sent,
                },
              ]}
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
          </Row>
        ) : null}

        {bid.proposal ? (
          <ProposalView proposal={bid.proposal} />
        ) : (
          <EmptyState message="No proposal was generated yet." />
        )}

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
            <Text style={text.title}>Email to client</Text>
            <Text style={styles.modalSub}>
              Send the {bid.client_name} proposal straight to their inbox.
              Replies come back to you.
            </Text>
            <Field
              label="Client email"
              placeholder="client@email.com"
              value={clientEmail}
              onChangeText={setClientEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoFocus
              editable={!sendingEmail}
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setEmailVisible(false)}
                disabled={sendingEmail}
              />
              <Button title="Send" onPress={sendEmail} loading={sendingEmail} />
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
            <Text style={text.title}>Follow-up draft</Text>
            {draftingFollowup ? (
              <View style={styles.followupLoading}>
                <ActivityIndicator color={Colors.textSecondary} />
                <Text style={styles.modalSub}>Writing a follow-up…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalSub}>
                  Edit the draft, then email it — replies come back to you.
                </Text>
                <Field
                  label="Message"
                  value={followupText}
                  onChangeText={setFollowupText}
                  multiline
                  editable={!sendingFollowup}
                  style={styles.followupInput}
                />
                <Field
                  label="Client email"
                  placeholder="client@email.com"
                  value={clientEmail}
                  onChangeText={setClientEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!sendingFollowup}
                />
              </>
            )}
            <View style={styles.modalActions}>
              <Button
                title="Close"
                variant="ghost"
                onPress={() => setFollowupVisible(false)}
                disabled={sendingFollowup}
              />
              <Button
                title="Copy"
                variant="secondary"
                onPress={copyFollowup}
                disabled={draftingFollowup || sendingFollowup || !followupText}
              />
              <Button
                title="Send"
                onPress={sendFollowup}
                loading={sendingFollowup}
                disabled={draftingFollowup || !followupText.trim()}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  errorBody: {
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textSecondary,
    textAlign: "center",
  },
  errorButtons: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 32,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  actionsSpacer: { flex: 1 },
  linkRow: { backgroundColor: Colors.surface },
  linkDot: { width: 8, height: 8, borderRadius: Radius.pill },
  linkText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textSecondary,
  },
  linkCopy: {
    fontFamily: Fonts.medium,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.overlay,
  },
  modalSub: {
    fontFamily: Fonts.regular,
    fontSize: Type.ui,
    lineHeight: Math.round(Type.ui * 1.4),
    color: Colors.textSecondary,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  followupLoading: { alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.lg },
  followupInput: {
    minHeight: 160,
    maxHeight: 260,
    lineHeight: Math.round(Type.body * 1.5),
  },
});
