#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <download|upload|watch> [args...]" >&2
  exit 1
fi

action="$1"
shift

# Loads .env and exports FUSIONAUTH_* variables for the CLI
# shellcheck disable=SC1091
. ./env.sh

case "$action" in
  download)
    exec npx fusionauth theme:download "$THEME_ID" -o "$TMP_DIR" "$@"
    ;;
  upload)
    exec npx fusionauth theme:upload "$THEME_ID" -i "$TMP_DIR" "$@"
    ;;
  watch)
    exec npx fusionauth theme:watch "$THEME_ID" -i "$TMP_DIR" "$@"
    ;;
  *)
    echo "Unknown action: $action" >&2
    echo "Usage: $0 <download|upload|watch> [args...]" >&2
    exit 1
    ;;
esac
