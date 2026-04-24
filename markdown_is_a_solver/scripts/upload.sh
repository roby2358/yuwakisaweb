#!/usr/bin/env bash
# One-time R2 setup + WASM upload for MIAS.
# Safe to re-run: bucket-create tolerates existing, object-put overwrites,
# cors-put overwrites, dev-url-enable is idempotent.
#
# Prereqs:
#   - wrangler authenticated (run: wrangler login)
#   - vendor/z3-built.wasm exists (run: node scripts/bundle.mjs)
#
# Usage (from project root):
#   bash scripts/upload.sh
#   BUCKET=my-bucket bash scripts/upload.sh

set -euo pipefail

BUCKET="${BUCKET:-mias-wasm}"
WASM_PATH="vendor/z3-built.wasm"
OBJECT_KEY="z3-built.wasm"

if [ ! -f "$WASM_PATH" ]; then
  echo "ERROR: $WASM_PATH not found. Run: node scripts/bundle.mjs" >&2
  exit 1
fi

echo "==> Creating R2 bucket '$BUCKET' (tolerating if exists)"
set +e
CREATE_OUT="$(npx wrangler r2 bucket create "$BUCKET" 2>&1)"
CREATE_RC=$?
set -e
echo "$CREATE_OUT"
if [ $CREATE_RC -ne 0 ] && ! echo "$CREATE_OUT" | grep -qi "already exists\|10004"; then
  echo "ERROR: bucket create failed with an unexpected error." >&2
  exit 1
fi

echo "==> Uploading WASM to '$BUCKET/$OBJECT_KEY'"
npx wrangler r2 object put "$BUCKET/$OBJECT_KEY" \
  --file "$WASM_PATH" \
  --content-type "application/wasm" \
  --cache-control "public, max-age=31536000, immutable" \
  --remote

echo "==> Setting CORS rule (GET/HEAD from any origin)"
CORS_FILE="$(mktemp)"
cat > "$CORS_FILE" <<'EOF'
{
  "rules": [
    {
      "allowed": {
        "origins": ["*"],
        "methods": ["GET", "HEAD"],
        "headers": ["*"]
      },
      "maxAgeSeconds": 86400
    }
  ]
}
EOF
npx wrangler r2 bucket cors set "$BUCKET" --file "$CORS_FILE" --force
rm -f "$CORS_FILE"

echo "==> Enabling public r2.dev URL"
npx wrangler r2 bucket dev-url enable "$BUCKET" --force

echo
echo "==> DONE."
echo "    Capture the r2.dev URL above and paste into config.js as:"
echo "      export const Z3_WASM_URL = 'https://<hash>.r2.dev/$OBJECT_KEY';"
