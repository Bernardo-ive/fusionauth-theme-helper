#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <current-theme-dir> <new-theme-dir>" >&2
  exit 1
fi

current_theme="$1"
new_theme="$2"

if [[ ! -d "$current_theme" ]]; then
  echo "Current theme directory not found: $current_theme" >&2
  exit 1
fi

if [[ ! -d "$new_theme" ]]; then
  echo "New theme directory not found: $new_theme" >&2
  exit 1
fi

while IFS= read -r -d '' original_file; do
  rel_path="${original_file#"$current_theme"/}"
  modified_file="$new_theme/$rel_path"

  if [[ ! -f "$modified_file" ]]; then
    echo "$rel_path missing in new theme"
    continue
  fi

  if ! diff --ignore-all-space \
    <(sed -e '$a\' "$original_file") \
    <(sed -e '$a\' "$modified_file") >/dev/null; then
    echo "$rel_path has differences"
  fi
done < <(find "$current_theme" -type f -print0)
