#!/usr/bin/env bash
# 自架主機上的部署與回滾，步驟見 docs/self-host-plan.md。
#   scripts/self-host-deploy.sh           拉最新 main、build、切到新版
#   scripts/self-host-deploy.sh rollback  切回上一版，不重新 build
# 每一版都是 ~/releases 底下獨立的資料夾，~/current 指向正在跑的那版；
# build 期間舊版照常服務，切換只有重啟那幾秒。
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
RELEASES="$HOME/releases"
KEEP=5
mkdir -p "$RELEASES"

if [[ "${1:-}" == rollback ]]; then
  current="$(readlink "$HOME/current" || true)"
  target="$(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d | sort | awk -v c="$current" '$0 < c' | tail -n 1)"
  [[ -n "$target" ]] || { echo '沒有更舊的版本可以切回去' >&2; exit 1; }
else
  cd "$REPO"
  git pull --ff-only
  npm ci
  NEXT_OUTPUT=standalone npm run build
  target="$RELEASES/$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
  cp -R .next/standalone "$target"
  cp -R .next/static "$target/.next/static"
  cp -R public/. "$target/public/"
  find "$RELEASES" -mindepth 1 -maxdepth 1 -type d | sort | head -n "-$KEEP" | xargs -r rm -rf
fi

ln -sfn "$target" "$HOME/current"
sudo systemctl restart johnlin
echo "現在跑的是 $(basename "$target")"
