import React, { useState } from "react";
import { ActivityIndicator, Platform, Share } from "react-native";
import { Alert } from "@/lib/dialog";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Link, Share2 } from "lucide-react-native";
import { shareProposal } from "@/lib/ai";
import { Bid, BidStatus } from "@/lib/types";
import { IconButton } from "@/components/ui";
import { Colors } from "@/constants/Colors";

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
      Alert.alert("Nothing to share yet", "Generate this proposal first.");
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
      if (Platform.OS === "web") {
        Alert.alert("Link copied", "Paste it to your client to send the proposal.");
      } else {
        // A dismissed/absent native share sheet must not surface as an error —
        // the link is already created and copied to the clipboard.
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

  return (
    <IconButton
      label={shared ? "Share link again" : "Share proposal"}
      disabled={sharing}
      onPress={(e?: { stopPropagation?: () => void }) => {
        e?.stopPropagation?.();
        handleShare();
      }}
    >
      {sharing ? (
        <ActivityIndicator size="small" color={Colors.textSecondary} />
      ) : shared ? (
        // Icon shape (link vs share) carries the "already has a live link"
        // meaning — no color needed; the palette stays grayscale.
        <Link size={16} color={Colors.textSecondary} strokeWidth={1.75} />
      ) : (
        <Share2 size={16} color={Colors.textMuted} strokeWidth={1.75} />
      )}
    </IconButton>
  );
}
