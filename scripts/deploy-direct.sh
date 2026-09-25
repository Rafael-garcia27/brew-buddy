#!/usr/bin/env bash
#
# Notfall-Deployment ohne GitHub Actions.
#
# Wann: Wenn Actions ausgefallen ist (githubstatus.com) und die App trotzdem
# live muss. Im Normalbetrieb macht das der Workflow — dann NICHT nötig.
#
# Was es tut: baut, pusht das Ergebnis auf den Branch gh-pages und stößt
# einen Pages-Build an. Danach steht Pages auf `legacy` und muss später
# zurückgestellt werden (siehe Ende der Ausgabe).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Konto und Repo kommen aus dem Remote, nicht aus einer Konstante.
# Sonst müsste dieses Skript bei jedem Umzug angefasst werden — und der
# eine Ort, den man dabei vergisst, pusht dann ins alte Repo.
REPO="$(git -C "$ROOT" remote get-url origin \
  | sed -E 's#^(https://github\.com/|git@github\.com:)##; s#\.git$##')"
ACCOUNT="${REPO%%/*}"

# ── Richtiges Konto sicherstellen ────────────────────────────────────
# Auf diesem Rechner hält der macOS-Schlüsselbund die CogniCore-Anmeldung
# (Rafael-278) und antwortet VOR dem gh-Helfer. Ein frisches Repo würde
# deshalb unter dem falschen Konto pushen. Wir umgehen den Schlüsselbund.
active="$(gh api user --jq .login)"
if [ "$active" != "$ACCOUNT" ]; then
  echo "gh ist auf '$active' — schalte auf '$ACCOUNT'"
  gh auth switch --user "$ACCOUNT"
fi

echo "▸ Prüfen und bauen"
cd "$ROOT"
npx tsc --noEmit
npx vitest run
rm -rf dist
npm run build

[ -f dist/asc-barista-cheatsheet.html ] || { echo "✗ Cheat Sheet fehlt im Build"; exit 1; }

echo "▸ Auf gh-pages pushen"
SHA="$(git rev-parse --short HEAD)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R dist/. "$TMP/"
touch "$TMP/.nojekyll"   # sonst ignoriert Pages Dateien mit Unterstrich

cd "$TMP"
git init -q -b gh-pages
git config user.name "$(git -C "$ROOT" config user.name || echo Rafael)"
git config user.email "$(git -C "$ROOT" config user.email || echo rafael.garozgarcia@gmail.com)"
git config --unset-all credential.helper 2>/dev/null || true
git config credential.helper '!gh auth git-credential'
git config "credential.https://github.com.username" "$ACCOUNT"
git add -A
git commit -q -m "Deploy $SHA (direkt, ohne Actions)"
git remote add origin "https://github.com/$REPO.git"
git push -f origin gh-pages

echo "▸ Pages auf gh-pages stellen und Build anstoßen"
gh api -X PUT "repos/$REPO/pages" --input - <<< '{"build_type":"legacy","source":{"branch":"gh-pages","path":"/"}}' >/dev/null 2>&1 || true
gh api -X POST "repos/$REPO/pages/builds" >/dev/null

echo "▸ Warten"
for _ in $(seq 1 24); do
  st="$(gh api "repos/$REPO/pages/builds/latest" --jq .status 2>/dev/null || echo '?')"
  [ "$st" = "built" ] && { echo "✓ live: https://brewbuddy.garciahub.de/"; break; }
  [ "$st" = "errored" ] && { gh api "repos/$REPO/pages/builds/latest" --jq '.error.message'; exit 1; }
  sleep 15
done

cat <<'NOTE'

────────────────────────────────────────────────────────────────
Pages steht jetzt auf `legacy` (Branch gh-pages).
Sobald Actions wieder läuft, zurückstellen:

  npm run deploy:restore
────────────────────────────────────────────────────────────────
NOTE
