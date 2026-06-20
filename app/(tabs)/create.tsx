import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { generateProposal } from "@/lib/ai";
import { TEMPLATES } from "@/lib/templates";
import { FREE_PROPOSALS_PER_MONTH, Template } from "@/lib/types";
import { TemplateCard } from "@/components/TemplateCard";
import { Button, Field, Screen } from "@/components/ui";
import { Colors, Spacing } from "@/constants/Colors";

export default function CreateBidScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const router = useRouter();

  const [template, setTemplate] = useState<Template | null>(null);
  const [clientName, setClientName] = useState("");
  const [brief, setBrief] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [generating, setGenerating] = useState(false);

  const isFree = (profile?.subscription_tier ?? "free") === "free";
  const used = profile?.proposals_this_month ?? 0;

  function pickTemplate(t: Template) {
    if (isFree && !t.freeTier) {
      router.push("/paywall");
      return;
    }
    Haptics.selectionAsync();
    setTemplate(t);
  }

  async function handleGenerate() {
    if (!session || !template) return;
    if (!clientName.trim()) {
      Alert.alert("Missing info", "Client name is required.");
      return;
    }
    if (isFree && used >= FREE_PROPOSALS_PER_MONTH) {
      router.push("/paywall");
      return;
    }

    setGenerating(true);
    try {
      const proposal = await generateProposal({
        template: template.name,
        clientName: clientName.trim(),
        brief: brief.trim() || undefined,
        budget: budget.trim() || undefined,
        timeline: timeline.trim() || undefined,
        producerName: profile?.producer_name ?? undefined,
        companyName: profile?.company_name ?? undefined,
      });

      const { data, error } = await supabase
        .from("bids")
        .insert({
          user_id: session.user.id,
          client_name: clientName.trim(),
          template_id: template.id,
          project_brief: brief.trim() || null,
          budget: budget ? Number(budget.replace(/[^0-9.]/g, "")) : null,
          timeline: timeline.trim() || null,
          status: "draft",
          proposal,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.rpc("increment_proposal_count", {
        uid: session.user.id,
      });
      await refreshProfile();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Reset form and open the proposal
      setTemplate(null);
      setClientName("");
      setBrief("");
      setBudget("");
      setTimeline("");
      router.push(`/bid/${data.id}`);
    } catch (e: unknown) {
      Alert.alert(
        "Generation failed",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    } finally {
      setGenerating(false);
    }
  }

  if (!template) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>What are you bidding on?</Text>
          {isFree && (
            <Text style={styles.quota}>
              Free plan: {Math.max(0, FREE_PROPOSALS_PER_MONTH - used)} of{" "}
              {FREE_PROPOSALS_PER_MONTH} proposals left this month
            </Text>
          )}
          <View style={styles.grid}>
            {TEMPLATES.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                locked={isFree && !t.freeTier}
                onPress={() => pickTemplate(t)}
              />
            ))}
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>{template.name}</Text>
          <Text style={styles.subtitle}>
            Give me the basics — I'll write the full proposal.
          </Text>
          <Field
            label="Client name *"
            value={clientName}
            onChangeText={setClientName}
            placeholder="Wright Choice Plumbing"
          />
          <Field
            label="Project brief"
            value={brief}
            onChangeText={setBrief}
            multiline
            placeholder="What does the client want? Goals, audience, key messages, locations..."
          />
          <Field
            label="Budget (optional)"
            value={budget}
            onChangeText={setBudget}
            keyboardType="numeric"
            placeholder="8500"
          />
          <Field
            label="Timeline (optional)"
            value={timeline}
            onChangeText={setTimeline}
            placeholder="Needs delivery by end of July"
          />
          <Button
            title={generating ? "Generating..." : "Generate Proposal"}
            onPress={handleGenerate}
            loading={generating}
          />
          <Button
            title="Back to templates"
            variant="secondary"
            onPress={() => setTemplate(null)}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md },
  title: { color: Colors.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: Colors.textSecondary, fontSize: 14, marginTop: -8 },
  quota: { color: Colors.accent, fontSize: 13, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
});
