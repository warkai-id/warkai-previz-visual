#!/bin/zsh
set -e
cd "${0:A:h}"
WARKAI_NODE="$(command -v node || true)"
if [[ -z "$WARKAI_NODE" && -f .local/node-path ]]; then WARKAI_NODE="$(cat .local/node-path)"; fi
if [[ ! -x "$WARKAI_NODE" ]]; then
  echo 'Node.js 22.12+ belum tersedia. Instal Node.js dari https://nodejs.org lalu jalankan lagi.'
  read -r '?Tekan Enter untuk menutup…'
  exit 1
fi
if [[ ! -d node_modules/vite ]]; then
  echo 'Jalankan npm ci di folder proyek terlebih dahulu.'
  read -r '?Tekan Enter untuk menutup…'
  exit 1
fi
if /usr/bin/curl -fsS --max-time 2 http://127.0.0.1:4317/ >/dev/null 2>&1; then
  /usr/bin/open http://127.0.0.1:4317
  exit 0
fi
(sleep 2; /usr/bin/open http://127.0.0.1:4317) &
"$WARKAI_NODE" scripts/local-server.mjs
