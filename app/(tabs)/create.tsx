import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Alert } from "@/lib/dialog";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { generateProposal } from "@/lib/ai";
import { track } from "@/lib/analytics";
import { TEMPLATES } from "@/lib/templates";
import { FREE_PROPOSALS_PER_MONTH, Template } from "@/lib/types";
import { TemplateCard } from "@/components/TemplateCard";
import { Button, Field, PageHeader, Screen, text } from "@/components/ui";
import { Spacing } from "@/constants/Colors";

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
      router.push("/paywall?reason=template");
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
      router.push("/paywall?reason=limit");
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

      // The monthly count is claimed server-side by generate-proposal (0007);
      // refreshing the profile pulls the updated number for the quota banner.
      await refreshProfile();

      track("proposal_generated", {
        template: template.name,
        has_brief: !!brief.trim(),
        has_budget: !!budget.trim(),
      });

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
        <PageHeader title="New bid" />
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.intro}>
            <Text style={text.label}>Choose a template</Text>
            {isFree && (
              <Text style={text.muted}>
                Free plan: {Math.max(0, FREE_PROPOSALS_PER_MONTH - used)} of{" "}
                {FREE_PROPOSALS_PER_MONTH} proposals left this month
              </Text>
            )}
          </View>
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
      <PageHeader title="New bid" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.intro}>
            <Text style={text.title}>{template.name}</Text>
            <Text style={text.muted}>
              Give me the basics — I&apos;ll write the full proposal.
            </Text>
          </View>
          <Field
            label="Client name"
            value={clientName}
            onChangeText={setClientName}
            placeholder="Wright Choice Plumbing"
          />
          <View style={styles.field}>
            <Field
              label="Project brief"
              value={brief}
              onChangeText={setBrief}
              multiline
              placeholder="What does the client want? Goals, audience, key messages, locations..."
            />
            <Text style={text.muted}>
              The more you add — goals, audience, locations — the sharper the
              proposal.
            </Text>
          </View>
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
          <View style={styles.field}>
            <Button
              title={generating ? "Writing your proposal…" : "Generate Proposal"}
              onPress={handleGenerate}
              loading={generating}
            />
            {generating ? (
              <Text style={[text.muted, { textAlign: "center" }]}>
                Usually about 20 seconds. Keep this open.
              </Text>
            ) : null}
          </View>
          <Button
            title="Back to templates"
            variant="ghost"
            onPress={() => setTemplate(null)}
            disabled={generating}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  intro: { gap: Spacing.xs },
  field: { gap: Spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
});
