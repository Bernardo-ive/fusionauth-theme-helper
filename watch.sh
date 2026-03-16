#!/usr/bin/env bash

set -euo pipefail

# Loads .env and exports FUSIONAUTH_* variables for the CLI
# shellcheck disable=SC1091
. ./env.sh

npx fusionauth theme:watch "$THEME_ID" -i "$TMP_DIR"
