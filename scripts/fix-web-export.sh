#!/usr/bin/env bash
# fix-web-export.sh
# Post-processes a fresh Expo web export (dist/) so it deploys correctly on
# Vercel. Run this every time after `npx expo export --platform web`, before
# `npx vercel --prod`.
#
# It does three things a raw export doesn't:
#   1. Copies the client-facing proposal pages (proposal.html, connected.html)
#      from web/ into dist/ — the export doesn't include them.
#   2. Writes the correct vercel.json (the /p/ rewrite PLUS an SPA fallback that
#      excludes real files, so fonts/assets aren't hijacked).
#   3. Renames assets/node_modules -> assets/vendorfonts and rewrites the bundle
#      references. Vercel strips any folder named "node_modules" on a static
#      deploy, which otherwise 404s the icon fonts (icons render as empty boxes).
#
# Usage (from the project root):
#   npx expo export --platform web
#   bash scripts/fix-web-export.sh
#   cd dist && npx vercel --prod
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
WEB="$ROOT/web"

if [ ! -d "$DIST" ]; then
  echo "✗ No dist/ folder. Run: npx expo export --platform web" >&2
  exit 1
fi

echo "→ Copying proposal pages into dist/"
cp "$WEB/proposal.html" "$DIST/proposal.html"
cp "$WEB/connected.html" "$DIST/connected.html"

echo "→ Writing vercel.json (/p/ rewrite + SPA fallback)"
cat > "$DIST/vercel.json" <<'JSON'
{
  "rewrites": [
    { "source": "/p/(.*)", "destination": "/proposal.html" },
    { "source": "/((?!_expo/|assets/|.*\\.).*)", "destination": "/index.html" }
  ]
}
JSON

# Restore the Vercel project link so `vercel --prod` doesn't re-prompt every
# time (a fresh export wipes dist/.vercel). Save it once after your first link:
#   cp -r dist/.vercel .vercel
if [ -d "$ROOT/.vercel" ]; then
  echo "→ Restoring saved Vercel project link"
  rm -rf "$DIST/.vercel"
  cp -r "$ROOT/.vercel" "$DIST/.vercel"
fi

cd "$DIST"
if [ -d assets/node_modules ]; then
  echo "→ Renaming assets/node_modules -> assets/vendorfonts"
  mv assets/node_modules assets/vendorfonts
  echo "→ Rewriting bundle font references"
  sed -i '' 's#assets/node_modules#assets/vendorfonts#g' _expo/static/js/web/entry-*.js 2>/dev/null \
    || sed -i 's#assets/node_modules#assets/vendorfonts#g' _expo/static/js/web/entry-*.js
else
  echo "→ No assets/node_modules folder (already patched?)"
fi

echo "✓ dist/ is ready. Deploy with: cd dist && npx vercel --prod"
