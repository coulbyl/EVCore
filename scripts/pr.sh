#!/usr/bin/env bash
# Usage: ./scripts/pr.sh <bump> "<title>"
#   bump  : patch | minor | major
#   title : description de la PR (sans le préfixe type)
#
# Exemples:
#   ./scripts/pr.sh patch "fix healthcheck timeout"
#   ./scripts/pr.sh minor "add coupon multi-currency support"
#   ./scripts/pr.sh major "breaking: rename ModelRun fields"
#
# Le titre final suit la convention K-Phoen/semver-release-action :
#   patch → fix: <title>   → bump patch (v1.0.x)
#   minor → feat: <title>  → bump minor (v1.x.0)
#   major → feat!: <title> → bump major (vx.0.0)

set -euo pipefail

BUMP="${1:-}"
TITLE="${2:-}"

if [[ -z "$BUMP" || -z "$TITLE" ]]; then
  echo "Usage: $0 <patch|minor|major> \"<title>\""
  exit 1
fi

case "$BUMP" in
  patch) PREFIX="fix" ;;
  minor) PREFIX="feat" ;;
  major) PREFIX="feat!" ;;
  *)
    echo "bump must be: patch | minor | major"
    exit 1
    ;;
esac

FULL_TITLE="${PREFIX}: ${TITLE}"

# Body depuis pr-desc.md si présent, sinon vide
BODY_FLAG=()
if [[ -f "pr-desc.md" ]]; then
  BODY_FLAG=(--body-file pr-desc.md)
else
  BODY_FLAG=(--body "")
fi

echo "Creating PR: \"${FULL_TITLE}\""
gh pr create \
  --title "${FULL_TITLE}" \
  "${BODY_FLAG[@]}" \
  --base main

echo ""
echo "Done. On merge: release.yml créera le tag semver, deploy.yml buildera et déploiera."
