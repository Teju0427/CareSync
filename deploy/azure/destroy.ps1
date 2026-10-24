<#
.SYNOPSIS  Deletes the ENTIRE CareSync resource group (database included). Irreversible.
#>
[CmdletBinding()]
param([string]$ResourceGroup = "caresync-rg")
$ErrorActionPreference = "Stop"
$ans = Read-Host "Delete resource group '$ResourceGroup' and EVERYTHING in it? Type the name to confirm"
if ($ans -ne $ResourceGroup) { Write-Host "Cancelled."; exit 1 }
az group delete --name $ResourceGroup --yes --no-wait
if ($LASTEXITCODE -ne 0) { throw "az group delete failed" }
Remove-Item (Join-Path $PSScriptRoot ".state.json") -ErrorAction SilentlyContinue
Write-Host "Deletion started (runs in the background, takes a few minutes)."
