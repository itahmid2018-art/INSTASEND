# ==============================================================================
# InstaSend Clean Reinstall Script (Windows PowerShell)
# Resolves Rolldown/Vite cross-platform native binding linkage issues
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "==> Step 1: Removing node_modules, package-lock.json, and dist..." -ForegroundColor Cyan
Remove-Item -Recurse -Force node_modules, package-lock.json, dist -ErrorAction SilentlyContinue

Write-Host "==> Step 2: Clearing npm cache..." -ForegroundColor Cyan
npm cache clean --force

Write-Host "==> Step 3: Performing clean npm install to re-fetch native bindings..." -ForegroundColor Cyan
npm install

Write-Host "==> Step 4: Starting dev server on 0.0.0.0:3000..." -ForegroundColor Green
npm run dev
