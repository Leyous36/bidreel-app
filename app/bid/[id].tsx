import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { proposalToText } from "@/lib/ai";
import { Bid, BidStatus, STATUS_LABELS } from "@/lib/types";
import { ProposalView } from "@/components/ProposalView";
import { Screen } from "@/components/ui";
import { Colors, Radius, Spacing } from "@/constants/Colors";

const STATUS_OPTIONS: BidStatus[] = [
  "draft",
  "sent",
  "viewed",
  "pending",
  "won",
  "lost",
];

export default function BidDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [bid, setBid] = useState<Bid | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("bids")
      .select("*")
      .eq("id", id)
      .single();
    if (data) setBid(data as Bid);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function setStatus(status: BidStatus) {
    if (!bid) return;
    Haptics.selectionAsync();
    setBid({ ...bid, status });
    await supabase.from("bids").update({ status }).eq("id", bid.id);
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
    Alert.alert("Copied", "Proposal copied — paste it into an email or doc.");
  }

  async function deleteBid() {
    if (!bid) return;
    Alert.alert("Delete bid?", `This removes the ${bid.client_name} proposal.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await supabase.from("bids").delete().eq("id", bid.id);
          router.back();
        },
      },
    ]);
  }

  if (loading || !bid) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
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

        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={copyProposal}>
            <Ionicons name="copy" size={18} color="#1A1405" />
            <Text style={styles.actionButtonText}>Copy Proposal</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={deleteBid}>
            <Ionicons name="trash" size={18} color={Colors.red} />
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  actions: { flexDirection: "row", gap: Spacing.sm },
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
});
