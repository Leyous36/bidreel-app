import { Platform } from "react-native";

/**
 * Web-only global styles that react-native-web can't express per-component:
 * ease-out transitions on interactive elements, thin scrollbars, selection
 * color, and the system font stack. No-op on native.
 */
export function injectWebStyles(): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (document.getElementById("bidreel-web-styles")) return;

  const style = document.createElement("style");
  style.id = "bidreel-web-styles";
  style.textContent = `
    html, body { background-color: #0B0E13; }
    body, input, textarea, button {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica,
        Arial, sans-serif;
    }
    [role="button"], a, input, textarea, select {
      transition: background-color 150ms ease-out, border-color 150ms ease-out,
        color 150ms ease-out, opacity 150ms ease-out, outline-color 150ms ease-out;
    }
    ::selection { background: rgba(245, 184, 46, 0.35); }
    * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
    *::-webkit-scrollbar { width: 8px; height: 8px; }
    *::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.15);
      border-radius: 4px;
    }
    *::-webkit-scrollbar-track { background: transparent; }
  `;
  document.head.appendChild(style);
}

/** Fires the global command palette (sidebar search row, keyboard shortcut). */
export function openCommandPalette(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("bidreel:palette"));
}
