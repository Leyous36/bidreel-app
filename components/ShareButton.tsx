import React, { useState } from "react";
import {
  Pressable,
  ActivityIndicator,
  Share,
  StyleSheet,
} from "react-native";
import { Alert } from "@/lib/dialog";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { shareProposal } from "@/lib/ai";
import { Bid, BidStatus } from "@/lib/types";
import { Colors, Radius } from "@/constants/Colors";

/**
 * Compact "share this proposal" button for use inside a list row. Generates the
 * tracked client link, copies it, and opens the native share sheet — without
 * navigating into the bid. Calls `onShared` so the parent list can reflect the
 * new share_token / status immediately.
 */
export function ShareButton({
  bid,
  onShared,
}: {
  bid: Bid;
  onShared?: (patch: Partial<Bid>) => void;
}) {
  const [sharing, setSharing] = useState(false);
  const shared = !!bid.share_token;

  async function handleShare() {
    if (!bid.proposal) {
      Alert.alert("Nothing to share yet", "Generate a proposal for this bid first.");
      return;
    }
    setSharing(true);
    try {
      const { url, status } = await shareProposal(bid.id);
      const token = url.split("/").pop() ?? null;
      onShared?.({
        share_token: token,
        shared_at: new Date().toISOString(),
        status: status as BidStatus,
      });
      await Clipboard.setStringAsync(url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const tint = shared ? Colors.green : Colors.accent;
  return (
    <Pressable
      onPress={(e: any) => {
        e?.stopPropagation?.();
        handleShare();
      }}
      disabled={sharing}
      hitSlop={8}
      accessibilityLabel={shared ? "Share link again" : "Share proposal"}
      style={({ pressed }) => [
        styles.btn,
        { borderColor: tint + "55", backgroundColor: tint + "14" },
        pressed && { opacity: 0.65 },
      ]}
    >
      {sharing ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <Ionicons name={shared ? "link" : "share-outline"} size={18} color={tint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
