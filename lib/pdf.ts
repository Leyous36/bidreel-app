import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Profile, Proposal } from "./types";

/** Escape user/AI text so it can't break the PDF's HTML. */
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const GOLD = "#C7920F"; // accentDark — reads well on white/print
const INK = "#15202B";
const MUTED = "#5B6678";
const LINE = "#E3E8F0";

function paragraphs(text: string): string {
  return esc(text)
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join("");
}

function listItems(items: string[]): string {
  return (items ?? []).map((i) => `<li>${esc(i)}</li>`).join("");
}

function timelineRows(p: Proposal): string {
  return (p.timeline ?? [])
    .map(
      (t) => `
      <tr>
        <td class="tl-phase">${esc(t.phase)}</td>
        <td class="tl-dur">${esc(t.duration)}</td>
        <td class="tl-det">${esc(t.details)}</td>
      </tr>`,
    )
    .join("");
}

function investmentBlock(p: Proposal): string {
  if (p.tiers && p.tiers.length > 0) {
    const cards = p.tiers
      .map((tier) => {
        const rec = tier.recommended ? "tier rec" : "tier";
        const badge = tier.recommended
          ? `<div class="badge">RECOMMENDED</div>`
          : "";
        return `
        <div class="${rec}">
          ${badge}
          <div class="tier-name">${esc(tier.name)}</div>
          <div class="tier-total">$${Number(tier.total).toLocaleString()}</div>
          <div class="tier-tag">${esc(tier.tagline)}</div>
          <ul class="tier-inc">${listItems(tier.includes)}</ul>
        </div>`;
      })
      .join("");
    const terms = p.paymentTerms
      ? `<p class="terms">${esc(p.paymentTerms)}</p>`
      : "";
    return `<div class="tiers">${cards}</div>${terms}`;
  }
  // Legacy single-investment proposals
  if (p.investment) {
    const rows = (p.investment.breakdown ?? [])
      .map(
        (b) =>
          `<tr><td>${esc(b.item)}</td><td class="amt">$${Number(
            b.amount,
          ).toLocaleString()}</td></tr>`,
      )
      .join("");
    return `
      <table class="inv">
        ${rows}
        <tr class="inv-total"><td>Total</td><td class="amt">$${Number(
          p.investment.total,
        ).toLocaleString()}</td></tr>
      </table>
      <p class="terms">${esc(p.investment.paymentTerms)}</p>`;
  }
  return "";
}

function buildHtml(
  proposal: Proposal,
  clientName: string,
  profile?: Profile | null,
): string {
  const company = esc(profile?.company_name || "AmeriFilms");
  const producer = esc(profile?.producer_name || "");
  const contactBits = [profile?.email, profile?.phone]
    .filter(Boolean)
    .map((x) => esc(x))
    .join("  ·  ");
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    color: ${INK}; margin: 0; padding: 40px 44px; font-size: 12px; line-height: 1.55;
  }
  .top { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid ${GOLD}; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: .3px; }
  .brand .producer { display:block; font-size: 12px; font-weight: 600; color: ${MUTED}; margin-top: 3px; }
  .brand .contact { display:block; font-size: 11px; color: ${MUTED}; margin-top: 2px; }
  .doc-meta { text-align: right; }
  .doc-meta .label { font-size: 11px; letter-spacing: 2px; color: ${GOLD}; font-weight: 800; }
  .doc-meta .date { font-size: 11px; color: ${MUTED}; margin-top: 2px; }
  h1 { font-size: 20px; font-weight: 800; margin: 0 0 4px; line-height: 1.25; }
  .prepared { color: ${MUTED}; font-size: 12px; margin: 0 0 22px; }
  h2 { font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: ${GOLD};
    font-weight: 800; margin: 22px 0 8px; }
  p { margin: 0 0 8px; }
  ul { margin: 0 0 8px; padding-left: 18px; }
  li { margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  .tl-phase { font-weight: 700; width: 26%; padding: 5px 8px 5px 0; vertical-align: top; }
  .tl-dur { color: ${MUTED}; width: 16%; padding: 5px 8px; vertical-align: top; white-space: nowrap; }
  .tl-det { padding: 5px 0; vertical-align: top; }
  tr { border-bottom: 1px solid ${LINE}; }
  .tiers { display: flex; gap: 10px; margin-top: 6px; }
  .tier, .rec { flex: 1; border: 1px solid ${LINE}; border-radius: 10px; padding: 14px;
    position: relative; }
  .rec { border: 2px solid ${GOLD}; background: #FFFBF0; }
  .badge { position: absolute; top: -9px; left: 14px; background: ${GOLD}; color: #fff;
    font-size: 8px; font-weight: 800; letter-spacing: 1px; padding: 3px 8px; border-radius: 999px; }
  .tier-name { font-size: 14px; font-weight: 800; margin-top: 2px; }
  .tier-total { font-size: 22px; font-weight: 800; color: ${GOLD}; margin: 2px 0; }
  .tier-tag { font-size: 10px; color: ${MUTED}; font-style: italic; margin-bottom: 8px; }
  .tier-inc { padding-left: 16px; }
  .tier-inc li { font-size: 11px; margin-bottom: 4px; }
  .inv td { padding: 6px 0; }
  .inv .amt { text-align: right; font-weight: 600; white-space: nowrap; }
  .inv-total td { border-top: 2px solid ${INK}; font-weight: 800; padding-top: 8px; }
  .inv-total .amt { color: ${GOLD}; }
  .terms { color: ${MUTED}; font-style: italic; font-size: 11px; margin-top: 10px; }
  .footer { margin-top: 34px; padding-top: 12px; border-top: 1px solid ${LINE};
    color: ${MUTED}; font-size: 10px; display: flex; justify-content: space-between; }
</style></head>
<body>
  <div class="top">
    <div class="brand">${company}
      ${producer ? `<span class="producer">${producer}</span>` : ""}
      ${contactBits ? `<span class="contact">${contactBits}</span>` : ""}
    </div>
    <div class="doc-meta">
      <div class="label">PROPOSAL</div>
      <div class="date">${today}</div>
    </div>
  </div>

  <h1>${esc(proposal.subject)}</h1>
  <p class="prepared">Prepared for ${esc(clientName)}</p>

  <h2>Overview</h2>
  ${paragraphs(proposal.overview)}

  <h2>Scope of Work</h2>
  <ul>${listItems(proposal.scope)}</ul>

  <h2>Deliverables</h2>
  <ul>${listItems(proposal.deliverables)}</ul>

  <h2>Timeline</h2>
  <table>${timelineRows(proposal)}</table>

  <h2>Investment</h2>
  ${investmentBlock(proposal)}

  <h2>Why Us</h2>
  ${paragraphs(proposal.whyUs)}

  <div class="footer">
    <span>${company}${producer ? ` — ${producer}` : ""}</span>
    <span>${contactBits}</span>
  </div>
</body></html>`;
}

/**
 * Render a proposal to a branded PDF and open the native share sheet
 * (save to Files, attach to email, AirDrop, etc.).
 */
export async function exportProposalPdf(
  proposal: Proposal,
  clientName: string,
  profile?: Profile | null,
  dialogTitle?: string,
): Promise<void> {
  const html = buildHtml(proposal, clientName, profile);

  // On web there's no native share sheet — open the proposal in a new tab and
  // let the browser save or print it as a PDF.
  if (Platform.OS === "web") {
    const win = typeof window !== "undefined" ? window.open("", "_blank") : null;
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
    return;
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: dialogTitle ?? `${clientName} — Proposal`,
      UTI: "com.adobe.pdf",
    });
  }
}
