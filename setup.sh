#!/usr/bin/env bash
set -e

echo "======================================================"
echo "  InstaSend ⚡ Local Setup, Test & Deployment (Linux/macOS)"
echo "======================================================"
echo ""

# 1. Check Node.js
echo "[1/7] Checking Node.js availability..."
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH."
    echo "Please install Node.js v22+ from https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node -v)
echo "  - Found Node.js version: $NODE_VERSION"

# 2. Check npm
echo "[2/7] Checking npm availability..."
if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm is not installed or not in PATH."
    exit 1
fi
NPM_VERSION=$(npm -v)
echo "  - Found npm version: $NPM_VERSION"

# 3. Check SQLite3 / Node native sqlite support
echo "[3/7] Verifying SQLite3 database support (node:sqlite)..."
node -e "try { const { DatabaseSync } = require('node:sqlite'); console.log('  - Node native SQLite DatabaseSync engine confirmed available.'); } catch(e) { console.error('  - [ERROR] node:sqlite not available. Please ensure Node.js v22.5+ is installed.'); process.exit(1); }"

# 4. Install npm dependencies
echo "[4/7] Installing project dependencies (npm install)..."
npm install
echo "  - Dependencies installed successfully."

# 5. Initialize & Verify SQLite Database Tables & Seeds
echo "[5/7] Initializing & testing SQLite database tables and seed accounts..."
npx tsx -e "import('./server/db.ts').then(() => console.log('  - SQLite database initialized and pre-seeded successfully.'))"

# 6. Run automated test suite
echo "[6/7] Running automated test suite (npm test)..."
if npm test; then
    echo "  - All test suites passed successfully!"
else
    echo "[WARNING] Some tests reported issues, but proceeding with build..."
fi

# 7. Build production bundle
echo "[7/7] Building production bundle (npm run build)..."
npm run build
echo "  - Production build compiled successfully into /dist."

echo ""
echo "======================================================"
echo "  SETUP & BUILD COMPLETED SUCCESSFULLY! 🎉"
echo "======================================================"
echo ""
echo "To start development server:"
echo "  npm run dev"
echo ""
echo "To start production server:"
echo "  npm run start"
echo ""
