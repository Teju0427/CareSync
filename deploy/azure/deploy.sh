#!/usr/bin/env bash
# Deploys CareSync to Azure Container Apps + Azure Database for PostgreSQL.
# Images are built in Azure (az acr build) — no local Docker needed.
# Works in Azure Cloud Shell, macOS, Linux and WSL. Safe to re-run (reuses resources + secrets).
#
#   az login && ./deploy/azure/deploy.sh [location] [prefix]
set -euo pipefail

LOCATION="${1:-centralindia}"
PREFIX="${2:-caresync}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@caresync.app}"
MIN_REPLICAS="${MIN_REPLICAS:-1}"
SEED="${SEED_DEMO_DATA:-true}"

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
STATE="$HERE/.state.json"   # shared with deploy.ps1 so either script can redeploy

step() { printf '\n\033[36m==> %s\033[0m\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }

command -v az >/dev/null || { echo "Azure CLI not found: https://learn.microsoft.com/cli/azure/install-azure-cli"; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required (used to read/write the state file)"; exit 1; }
SUB_ID="$(az account show --query id -o tsv 2>/dev/null)" || { echo "Not logged in. Run 'az login' first."; exit 1; }

step "Preparing Azure CLI"
az extension add --name containerapp --upgrade --only-show-errors
for ns in Microsoft.App Microsoft.OperationalInsights Microsoft.DBforPostgreSQL Microsoft.ContainerRegistry; do
  az provider register --namespace "$ns" --wait --only-show-errors
done

SUFFIX="$(echo "${SUB_ID//-/}" | cut -c1-6 | tr 'A-Z' 'a-z')"
RG="$PREFIX-rg"; ACR="$(echo "${PREFIX}acr${SUFFIX}" | tr -cd 'a-z0-9')"
PG="$PREFIX-pg-$SUFFIX"; CAENV="$PREFIX-env"; API="$PREFIX-api"; WEB="$PREFIX-web"
DB_NAME=caresync; DB_USER=caresyncadmin

if [[ -f "$STATE" ]]; then
  echo "Reusing secrets from $STATE"
else
  python3 - "$STATE" "$(openssl rand -hex 12)" "$(openssl rand -hex 24)" "$(openssl rand -hex 8)" "$(openssl rand -hex 7)" <<'PY'
import json, sys
path, db, jwt, admin, doc = sys.argv[1:]
json.dump({"dbPassword": db, "jwtSecret": jwt, "adminPassword": admin, "doctorPassword": doc}, open(path, "w"), indent=2)
PY
fi
getv() { python3 -c "import json,sys; print(json.load(open('$STATE'))['$1'])"; }
DB_PW="$(getv dbPassword)"; JWT="$(getv jwtSecret)"; ADMIN_PW="$(getv adminPassword)"; DOC_PW="$(getv doctorPassword)"

step "Resource group $RG ($LOCATION)"
az group create --name "$RG" --location "$LOCATION" --only-show-errors -o none

step "Container registry $ACR"
exists az acr show --name "$ACR" --resource-group "$RG" || \
  az acr create --name "$ACR" --resource-group "$RG" --sku Basic --admin-enabled true --only-show-errors -o none
ACR_SERVER="$ACR.azurecr.io"
ACR_USER="$(az acr credential show --name "$ACR" --query username -o tsv)"
ACR_PASS="$(az acr credential show --name "$ACR" --query 'passwords[0].value' -o tsv)"

step "PostgreSQL flexible server $PG (first run takes 5-10 minutes)"
exists az postgres flexible-server show --name "$PG" --resource-group "$RG" || \
  az postgres flexible-server create --name "$PG" --resource-group "$RG" --location "$LOCATION" \
    --admin-user "$DB_USER" --admin-password "$DB_PW" --sku-name Standard_B1ms --tier Burstable \
    --storage-size 32 --version 16 --database-name "$DB_NAME" --public-access 0.0.0.0 --yes --only-show-errors -o none
PG_HOST="$(az postgres flexible-server show --name "$PG" --resource-group "$RG" --query fullyQualifiedDomainName -o tsv)"
DB_URL="postgresql://${DB_USER}:${DB_PW}@${PG_HOST}:5432/${DB_NAME}?sslmode=require"

TAG="$(date +%Y%m%d%H%M%S)"
step "Building API image in Azure ($TAG)"
az acr build --registry "$ACR" --image "caresync-api:$TAG" --image "caresync-api:latest" "$ROOT/backend" --only-show-errors
step "Building web image in Azure"
az acr build --registry "$ACR" --image "caresync-web:$TAG" --image "caresync-web:latest" "$ROOT/frontend" --only-show-errors

step "Container Apps environment $CAENV"
exists az containerapp env show --name "$CAENV" --resource-group "$RG" || \
  az containerapp env create --name "$CAENV" --resource-group "$RG" --location "$LOCATION" --only-show-errors -o none

step "API container app $API"
if exists az containerapp show --name "$API" --resource-group "$RG"; then
  az containerapp update --name "$API" --resource-group "$RG" --image "$ACR_SERVER/caresync-api:$TAG" --only-show-errors -o none
else
  az containerapp create --name "$API" --resource-group "$RG" --environment "$CAENV" \
    --image "$ACR_SERVER/caresync-api:$TAG" --registry-server "$ACR_SERVER" --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
    --target-port 8000 --ingress external --cpu 0.5 --memory 1.0Gi --min-replicas "$MIN_REPLICAS" --max-replicas 2 \
    --secrets "db-url=$DB_URL" "jwt=$JWT" "admin-pw=$ADMIN_PW" "doctor-pw=$DOC_PW" \
    --env-vars ENV=production DATABASE_URL=secretref:db-url JWT_SECRET_KEY=secretref:jwt \
               SEED_DEMO_DATA="$SEED" SEED_ADMIN_EMAIL="$ADMIN_EMAIL" SEED_ADMIN_PASSWORD=secretref:admin-pw SEED_DOCTOR_PASSWORD=secretref:doctor-pw \
               ALLOWED_ORIGINS=http://localhost:3000 --only-show-errors -o none
fi
API_URL="https://$(az containerapp show --name "$API" --resource-group "$RG" --query properties.configuration.ingress.fqdn -o tsv)"

step "Web container app $WEB"
if exists az containerapp show --name "$WEB" --resource-group "$RG"; then
  az containerapp update --name "$WEB" --resource-group "$RG" --image "$ACR_SERVER/caresync-web:$TAG" --set-env-vars "API_URL=$API_URL" --only-show-errors -o none
else
  az containerapp create --name "$WEB" --resource-group "$RG" --environment "$CAENV" \
    --image "$ACR_SERVER/caresync-web:$TAG" --registry-server "$ACR_SERVER" --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
    --target-port 80 --ingress external --cpu 0.25 --memory 0.5Gi --min-replicas "$MIN_REPLICAS" --max-replicas 2 \
    --env-vars "API_URL=$API_URL" --only-show-errors -o none
fi
WEB_URL="https://$(az containerapp show --name "$WEB" --resource-group "$RG" --query properties.configuration.ingress.fqdn -o tsv)"

step "Allowing the web origin on the API (CORS)"
az containerapp update --name "$API" --resource-group "$RG" --set-env-vars "ALLOWED_ORIGINS=$WEB_URL" --only-show-errors -o none

step "Waiting for the API to become healthy"
ok=false
for _ in $(seq 1 30); do
  if curl -fsS --max-time 10 "$API_URL/health" >/dev/null 2>&1; then ok=true; break; fi
  sleep 6
done
$ok || echo "WARNING: API not healthy yet. Logs: az containerapp logs show -n $API -g $RG --follow"

printf '\n\033[32m=====================================================\n CareSync is deployed\n=====================================================\033[0m\n'
echo " Web app : $WEB_URL"
echo " API docs: $API_URL/docs"
if [[ "$SEED" == "true" ]]; then
  echo
  echo " Demo logins (created on first start):"
  echo "   Admin  : $ADMIN_EMAIL  /  $ADMIN_PW"
  echo "   Doctor : dr.sharma@gmail.com  /  $DOC_PW   (also dr.mehta, dr.nair, dr.rao, dr.kapoor @gmail.com)"
  echo "   Patient: register from the sign-up screen"
fi
echo; echo " Secrets are saved in $STATE (git-ignored). Keep it private."
echo " Re-run this script after code changes to roll out a new version."
echo " To delete everything and stop all charges:  ./deploy/azure/destroy.sh"
