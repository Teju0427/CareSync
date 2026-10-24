<#
.SYNOPSIS
  Deploys CareSync to Azure: Container Apps (API + web), Azure Database for PostgreSQL
  Flexible Server, and Azure Container Registry. Images are built IN Azure (az acr build),
  so you do NOT need Docker installed locally.

.DESCRIPTION
  Safe to re-run: it reuses existing resources and generated secrets (stored in
  deploy/azure/.state.json, which is git-ignored) and simply rolls out a new image.

.EXAMPLE
  az login
  ./deploy/azure/deploy.ps1 -Location centralindia

.PARAMETER Location
  Azure region. Student/free subscriptions are sometimes restricted to specific regions;
  if creation fails with a policy/quota error, retry with another (e.g. southeastasia, eastus2).
#>
[CmdletBinding()]
param(
  [string]$Prefix = "caresync",
  [string]$Location = "centralindia",
  [string]$AdminEmail = "admin@caresync.app",
  [ValidateRange(0, 3)][int]$MinReplicas = 1,
  [switch]$NoSeed
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$StateFile = Join-Path $PSScriptRoot ".state.json"

function Az {
  & az @args
  if ($LASTEXITCODE -ne 0) { throw "Azure CLI command failed: az $($args -join ' ')" }
}
function AzQuiet {   # returns $null instead of throwing (used for existence checks)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"   # Windows PowerShell 5.1 treats native stderr as fatal under "Stop"
  try {
    $out = & az @args 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return $out
  } finally { $ErrorActionPreference = $prev }
}
function New-Secret([int]$Length = 24) {
  $chars = [char[]]"abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  -join (1..$Length | ForEach-Object { $chars | Get-Random })
}
function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }

# ---------------------------------------------------------------- prerequisites
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  throw "Azure CLI not found. Install it from https://learn.microsoft.com/cli/azure/install-azure-cli and run 'az login'."
}
$subId = AzQuiet account show --query id -o tsv
if (-not $subId) { throw "You are not logged in. Run 'az login' first." }
Write-Host "Subscription: $(az account show --query name -o tsv)  ($subId)"

Step "Preparing Azure CLI (containerapp extension + resource providers)"
Az extension add --name containerapp --upgrade --only-show-errors
foreach ($ns in "Microsoft.App", "Microsoft.OperationalInsights", "Microsoft.DBforPostgreSQL", "Microsoft.ContainerRegistry") {
  Az provider register --namespace $ns --wait --only-show-errors
}

# ---------------------------------------------------------------- names + secrets
$suffix = ($subId -replace "-", "").Substring(0, 6).ToLower()   # stable per subscription => globally-unique, re-runnable
$rg   = "$Prefix-rg"
$acr  = "$($Prefix)acr$suffix" -replace "[^a-z0-9]", ""
$pg   = "$Prefix-pg-$suffix"
$caEnv = "$Prefix-env"
$api  = "$Prefix-api"
$web  = "$Prefix-web"
$dbName = "caresync"
$dbUser = "caresyncadmin"

if (Test-Path $StateFile) {
  $state = Get-Content $StateFile -Raw | ConvertFrom-Json
  Write-Host "Reusing secrets from $StateFile"
} else {
  $state = [pscustomobject]@{
    dbPassword = New-Secret 24; jwtSecret = New-Secret 48; adminPassword = New-Secret 16; doctorPassword = New-Secret 14
  }
  $state | ConvertTo-Json | Set-Content $StateFile
}

# ---------------------------------------------------------------- resource group + registry
Step "Resource group $rg ($Location)"
Az group create --name $rg --location $Location --only-show-errors -o none

Step "Container registry $acr"
if (-not (AzQuiet acr show --name $acr --resource-group $rg --query name -o tsv)) {
  Az acr create --name $acr --resource-group $rg --sku Basic --admin-enabled true --only-show-errors -o none
}
$acrServer = "$acr.azurecr.io"
$acrUser = az acr credential show --name $acr --query username -o tsv
$acrPass = az acr credential show --name $acr --query "passwords[0].value" -o tsv

# ---------------------------------------------------------------- database
Step "PostgreSQL flexible server $pg (this can take 5-10 minutes the first time)"
if (-not (AzQuiet postgres flexible-server show --name $pg --resource-group $rg --query name -o tsv)) {
  Az postgres flexible-server create --name $pg --resource-group $rg --location $Location `
    --admin-user $dbUser --admin-password $state.dbPassword `
    --sku-name Standard_B1ms --tier Burstable --storage-size 32 --version 16 `
    --database-name $dbName --public-access 0.0.0.0 --yes --only-show-errors -o none
}
$pgHost = az postgres flexible-server show --name $pg --resource-group $rg --query fullyQualifiedDomainName -o tsv
$dbUrl = "postgresql://${dbUser}:$($state.dbPassword)@${pgHost}:5432/${dbName}?sslmode=require"

# ---------------------------------------------------------------- build images in Azure
$tag = Get-Date -Format "yyyyMMddHHmmss"
Step "Building API image in Azure (tag $tag)"
Az acr build --registry $acr --image "caresync-api:$tag" --image "caresync-api:latest" (Join-Path $RepoRoot "backend") --only-show-errors
Step "Building web image in Azure"
Az acr build --registry $acr --image "caresync-web:$tag" --image "caresync-web:latest" (Join-Path $RepoRoot "frontend") --only-show-errors

# ---------------------------------------------------------------- container apps environment
Step "Container Apps environment $caEnv"
if (-not (AzQuiet containerapp env show --name $caEnv --resource-group $rg --query name -o tsv)) {
  Az containerapp env create --name $caEnv --resource-group $rg --location $Location --only-show-errors -o none
}

# ---------------------------------------------------------------- API
$seed = if ($NoSeed) { "false" } else { "true" }
Step "API container app $api"
if (-not (AzQuiet containerapp show --name $api --resource-group $rg --query name -o tsv)) {
  Az containerapp create --name $api --resource-group $rg --environment $caEnv `
    --image "$acrServer/caresync-api:$tag" --registry-server $acrServer --registry-username $acrUser --registry-password $acrPass `
    --target-port 8000 --ingress external --transport auto `
    --cpu 0.5 --memory 1.0Gi --min-replicas $MinReplicas --max-replicas 2 `
    --secrets "db-url=$dbUrl" "jwt=$($state.jwtSecret)" "admin-pw=$($state.adminPassword)" "doctor-pw=$($state.doctorPassword)" `
    --env-vars "ENV=production" "DATABASE_URL=secretref:db-url" "JWT_SECRET_KEY=secretref:jwt" `
               "SEED_DEMO_DATA=$seed" "SEED_ADMIN_EMAIL=$AdminEmail" "SEED_ADMIN_PASSWORD=secretref:admin-pw" "SEED_DOCTOR_PASSWORD=secretref:doctor-pw" `
               "ALLOWED_ORIGINS=http://localhost:3000" `
    --only-show-errors -o none
} else {
  Az containerapp update --name $api --resource-group $rg --image "$acrServer/caresync-api:$tag" --only-show-errors -o none
}
$apiFqdn = az containerapp show --name $api --resource-group $rg --query properties.configuration.ingress.fqdn -o tsv
$apiUrl = "https://$apiFqdn"

# ---------------------------------------------------------------- web
Step "Web container app $web"
if (-not (AzQuiet containerapp show --name $web --resource-group $rg --query name -o tsv)) {
  Az containerapp create --name $web --resource-group $rg --environment $caEnv `
    --image "$acrServer/caresync-web:$tag" --registry-server $acrServer --registry-username $acrUser --registry-password $acrPass `
    --target-port 80 --ingress external --transport auto `
    --cpu 0.25 --memory 0.5Gi --min-replicas $MinReplicas --max-replicas 2 `
    --env-vars "API_URL=$apiUrl" --only-show-errors -o none
} else {
  Az containerapp update --name $web --resource-group $rg --image "$acrServer/caresync-web:$tag" --set-env-vars "API_URL=$apiUrl" --only-show-errors -o none
}
$webFqdn = az containerapp show --name $web --resource-group $rg --query properties.configuration.ingress.fqdn -o tsv
$webUrl = "https://$webFqdn"

Step "Allowing the web origin on the API (CORS)"
Az containerapp update --name $api --resource-group $rg --set-env-vars "ALLOWED_ORIGINS=$webUrl" --only-show-errors -o none

# ---------------------------------------------------------------- verify
Step "Waiting for the API to become healthy"
$healthy = $false
foreach ($i in 1..30) {
  try { if ((Invoke-RestMethod "$apiUrl/health" -TimeoutSec 10).status -eq "ok") { $healthy = $true; break } } catch { Start-Sleep 6 }
}
if (-not $healthy) {
  Write-Warning "API did not report healthy in time. Check logs:  az containerapp logs show -n $api -g $rg --follow"
}

Write-Host "`n=====================================================" -ForegroundColor Green
Write-Host " CareSync is deployed" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Web app : $webUrl"
Write-Host " API docs: $apiUrl/docs"
if (-not $NoSeed) {
  Write-Host "`n Demo logins (created on first start):"
  Write-Host "   Admin  : $AdminEmail  /  $($state.adminPassword)"
  Write-Host "   Doctor : dr.sharma@gmail.com  /  $($state.doctorPassword)   (also dr.mehta, dr.nair, dr.rao, dr.kapoor @gmail.com)"
  Write-Host "   Patient: register from the sign-up screen"
}
Write-Host "`n Secrets are saved in $StateFile (git-ignored). Keep that file private."
Write-Host " Re-run this script after code changes to roll out a new version."
Write-Host " To delete everything and stop all charges:  ./deploy/azure/destroy.ps1"
