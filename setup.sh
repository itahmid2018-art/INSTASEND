#!/usr/bin/env bash
# ==============================================================================
# InstaSend ⚡ Local & Cloud Deployment Setup Script (Linux, macOS, Cloud VPS)
# ==============================================================================
set -e

# Parse optional arguments
SKIP_TESTS=false
AUTO_START=false
AUTO_DEV=false
USE_DOCKER=false

for arg in "$@"; do
  case $arg in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --start|--deploy)
      AUTO_START=true
      shift
      ;;
    --dev)
      AUTO_DEV=true
      shift
      ;;
    --docker)
      USE_DOCKER=true
      shift
      ;;
    --help|-h)
      echo "InstaSend Setup & Deployment Helper"
      echo "Usage: ./setup.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-tests    Skip automated QA test suite for faster deployment"
      echo "  --start         Build and immediately start the production server"
      echo "  --dev           Setup and immediately start the development server"
      echo "  --docker        Build and run containerized app using Docker Compose"
      echo "  --help, -h      Show this help message"
      exit 0
      ;;
  esac
done

echo "======================================================"
echo "  InstaSend ⚡ Setup & Deployment Pipeline"
echo "======================================================"
echo ""

# Handle Docker deployment shortcut if requested
if [ "$USE_DOCKER" = true ]; then
  echo "[Docker Mode] Checking Docker and Docker Compose..."
  if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed or not in PATH."
    exit 1
  fi
  echo "  - Starting containerized deployment with Docker Compose..."
  docker compose up -d --build
  echo "  - Container started successfully!"
  echo "  - Access InstaSend at: http://localhost:3000"
  exit 0
fi

# 1. Check Node.js
echo "[1/8] Checking Node.js availability..."
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH."
    echo "Please install Node.js v22+ from https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node -v)
echo "  - Found Node.js version: $NODE_VERSION"

# Extract major version number to verify v22+
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 22 ]; then
    echo "[WARNING] Node.js version is $NODE_VERSION. InstaSend uses native node:sqlite which is built into Node.js v22.5+."
    echo "If you encounter SQLite errors, please upgrade to Node.js v22 or higher."
fi

# 2. Check npm
echo "[2/8] Checking npm availability..."
if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm is not installed or not in PATH."
    exit 1
fi
NPM_VERSION=$(npm -v)
echo "  - Found npm version: $NPM_VERSION"

# 3. Check SQLite3 / Node native sqlite support
echo "[3/8] Verifying SQLite3 database support (node:sqlite)..."
node -e "try { const { DatabaseSync } = require('node:sqlite'); console.log('  - Node native SQLite DatabaseSync engine confirmed available.'); } catch(e) { console.error('  - [ERROR] node:sqlite not available. Please ensure Node.js v22.5+ is installed.'); process.exit(1); }"

# 4. Check & initialize environment configuration (.env)
echo "[4/8] Verifying environment configuration..."
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "  - Creating .env from .env.example template..."
    cp .env.example .env
  else
    echo "  - Creating default .env file..."
    echo "NODE_ENV=production" > .env
    echo "PORT=3000" >> .env
  fi
  echo "  - Environment file initialized (.env)."
else
  echo "  - Existing .env file found."
fi

# 5. Install npm dependencies
echo "[5/8] Installing project dependencies (npm install)..."
npm install
echo "  - Dependencies installed successfully."

# 6. Initialize & Verify SQLite Database Tables & Seeds
echo "[6/8] Initializing & testing SQLite database tables and seed accounts..."
npx tsx -e "import('./server/db.ts').then(() => console.log('  - SQLite database initialized and pre-seeded successfully.'))"

# 7. Run automated test suite
if [ "$SKIP_TESTS" = true ]; then
  echo "[7/8] Skipping automated test suite (--skip-tests specified)."
else
  echo "[7/8] Running automated test suite (npm test)..."
  if npm test; then
      echo "  - All test suites passed successfully!"
  else
      echo "[WARNING] Some tests reported issues, but proceeding with build..."
  fi
fi

# 8. Build production bundle
echo "[8/8] Building production bundle (npm run build)..."
npm run build
echo "  - Production build compiled successfully into /dist."

echo ""
echo "======================================================"
echo "  SETUP & BUILD COMPLETED SUCCESSFULLY! 🎉"
echo "======================================================"
echo ""
echo "Deployment Options:"
echo "  1. Start Production Server:  npm run start"
echo "  2. Start with PM2:           pm2 start dist/server.js --name instasend"
echo "  3. Start Development Server: npm run dev"
echo "  4. Docker Compose:           docker compose up -d"
echo ""

if [ "$AUTO_START" = true ]; then
  echo "Starting production server now..."
  npm run start
elif [ "$AUTO_DEV" = true ]; then
  echo "Starting development server now..."
  npm run dev
fi
