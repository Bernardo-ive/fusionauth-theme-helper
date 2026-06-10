#!/usr/bin/env bash

# Export variables from .env so the FusionAuth CLI can read them.
# Also supports legacy variable names used by older scripts.

set -euo pipefail

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

# Legacy -> current variable mapping
if [[ -z "${FUSIONAUTH_API_KEY:-}" && -n "${API_KEY:-}" ]]; then
  export FUSIONAUTH_API_KEY="$API_KEY"
fi

if [[ -z "${FUSIONAUTH_HOST:-}" && -n "${FUSIONAUTH_URL:-}" ]]; then
  export FUSIONAUTH_HOST="$FUSIONAUTH_URL"
fi

# Canonical local working directory for downloaded/edited theme files.
if [[ -z "${TMP_DIR:-}" ]]; then
  export TMP_DIR="tpl"
fi
