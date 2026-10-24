#!/usr/bin/env bash
# Deletes the ENTIRE CareSync resource group (database included). Irreversible.
set -euo pipefail
RG="${1:-caresync-rg}"
read -r -p "Delete resource group '$RG' and EVERYTHING in it? Type the name to confirm: " ans
[[ "$ans" == "$RG" ]] || { echo "Cancelled."; exit 1; }
az group delete --name "$RG" --yes --no-wait
rm -f "$(dirname "$0")/.state.json"
echo "Deletion started (runs in the background, takes a few minutes)."
