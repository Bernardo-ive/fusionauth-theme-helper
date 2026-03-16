#!/usr/bin/env bash

set -euo pipefail

# Loads .env and exports FUSIONAUTH_* variables for the CLI
# shellcheck disable=SC1091
. ./env.sh

clean_flag=""
if [[ "${1:-}" == "--clean" ]]; then
  clean_flag="--clean"
  shift
fi

email_template_id="${1:-}"

emails_dir="${EMAILS_DIR:-./email-templates/emails}"

if [[ -n "$email_template_id" ]]; then
  npx fusionauth email:download $clean_flag -o "$emails_dir" "$email_template_id"
else
  npx fusionauth email:download $clean_flag -o "$emails_dir"
fi
