#!/usr/bin/env bash

set -euo pipefail

# Loads .env and exports FUSIONAUTH_* variables for the CLI
# shellcheck disable=SC1091
. ./env.sh

npx fusionauth theme:download "$THEME_ID" -o "$TMP_DIR"
