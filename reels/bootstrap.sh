#!/usr/bin/env bash
# One command for a scheduled run. Fresh containers start empty, so this brings
# the machine up to spec before doing any work; each step is skipped when the
# tool is already there, which keeps the common case fast.
set -euo pipefail
cd "$(dirname "$0")"

export TZ=Europe/Istanbul
export TZ_NAME=Europe/Istanbul

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg kuruluyor..."
  (apt-get update -qq && apt-get install -y -qq ffmpeg) >/dev/null 2>&1 \
    || (sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg) >/dev/null 2>&1
fi

if [ ! -d node_modules ]; then
  echo "bagimliliklar kuruluyor..."
  npm ci --no-audit --no-fund >/dev/null 2>&1
fi

# Chromium is preinstalled in this image; only fetch it when it is genuinely absent.
if [ -z "${CHROME_PATH:-}" ] && [ ! -x /opt/pw-browsers/chromium-1194/chrome-linux/chrome ]; then
  echo "chromium kuruluyor..."
  npx playwright install chromium >/dev/null 2>&1 || true
fi

echo "--- gunluk gonderiler ---"
node src/run.mjs "$@" || echo "gunluk calistirma hata verdi"

echo "--- gol / mac sonu kontrolu ---"
node src/live.mjs --once "$@" || echo "canli kontrol hata verdi"
