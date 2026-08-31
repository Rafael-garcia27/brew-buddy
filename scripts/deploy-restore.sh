#!/usr/bin/env bash
# Pages zurück auf den Actions-Workflow stellen, nachdem deploy-direct
# als Notlösung benutzt wurde.
set -euo pipefail
# Aus dem Remote statt fest verdrahtet — siehe deploy-direct.sh.
REPO="$(git -C "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" remote get-url origin \
  | sed -E 's#^(https://github\.com/|git@github\.com:)##; s#\.git$##')"

state="$(curl -s https://www.githubstatus.com/api/v2/components.json \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const a=j.components.find(c=>c.name==='Actions');console.log(a?a.status:'unknown')}catch(e){console.log('unknown')}})")"
echo "GitHub Actions: $state"
if [ "$state" != "operational" ]; then
  echo "✗ Actions ist noch nicht wieder in Ordnung — Umstellung würde die Seite einfrieren."
  echo "  Trotzdem umstellen? Dann das gh-Kommando unten von Hand ausführen."
  echo "  gh api -X PUT repos/$REPO/pages --input - <<< '{\"build_type\":\"workflow\"}'"
  exit 1
fi

gh api -X PUT "repos/$REPO/pages" --input - <<< '{"build_type":"workflow"}' >/dev/null
gh workflow run "Build & Deploy" --ref main
echo "✓ Pages wieder auf Workflow · Deployment angestoßen"
