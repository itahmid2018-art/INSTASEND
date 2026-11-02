#!/usr/bin/env bash
# ==============================================================================
# InstaSend Clean Reinstall Script
# Resolves Rolldown/Vite cross-platform native binding linkage issues
# ==============================================================================

set -e

echo "==> Step 1: Removing node_modules, package-lock.json, and dist..."
rm -rf node_modules package-lock.json dist

echo "==> Step 2: Clearing npm cache..."
npm cache clean --force

echo "==> Step 3: Performing clean npm install to re-fetch native bindings..."
npm install

echo "==> Step 4: Starting dev server on 0.0.0.0:3000..."
npm run dev
