@echo off
SETLOCAL EnableDelayedExpansion

TITLE InstaSend Local Setup & Deployment Script (Windows)

echo ======================================================
echo   InstaSend ⚡ Local Setup, Test & Deployment (Windows)
echo ======================================================
echo.

:: 1. Check Node.js
echo [1/7] Checking Node.js availability...
WHERE node >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please download and install Node.js v22+ from https://nodejs.org/
    pause
    exit /b 1
)
FOR /F "tokens=*" %%i IN ('node -v') DO SET NODE_VERSION=%%i
echo   - Found Node.js version: %NODE_VERSION%

:: 2. Check npm
echo [2/7] Checking npm availability...
WHERE npm >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed or not in PATH.
    pause
    exit /b 1
)
FOR /F "tokens=*" %%i IN ('npm -v') DO SET NPM_VERSION=%%i
echo   - Found npm version: %NPM_VERSION%

:: 3. Check SQLite3 / Node native sqlite support
echo [3/7] Verifying SQLite3 database support (node:sqlite)...
node -e "try { const { DatabaseSync } = require('node:sqlite'); console.log('   - Node native SQLite DatabaseSync engine confirmed available.'); } catch(e) { console.error('   - [ERROR] node:sqlite not available. Please ensure Node.js v22.5+ is installed.'); process.exit(1); }"
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] SQLite3 native database check failed.
    pause
    exit /b 1
)

:: 4. Install npm dependencies
echo [4/7] Installing project dependencies (npm install)...
call npm install
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
)
echo   - Dependencies installed successfully.

:: 5. Initialize & Verify SQLite Database Tables & Seeds
echo [5/7] Initializing & testing SQLite database tables and seed accounts...
call npx tsx -e "import('./server/db.ts').then(() => console.log('   - SQLite database initialized and pre-seeded successfully.'))"
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Database initialization failed.
    pause
    exit /b 1
)

:: 6. Run automated test suite
echo [6/7] Running automated test suite (npm test)...
call npm test
IF %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Some tests reported issues, but proceeding with build...
) ELSE (
    echo   - All test suites passed successfully!
)

:: 7. Build production bundle
echo [7/7] Building production bundle (npm run build)...
call npm run build
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Production build failed.
    pause
    exit /b 1
)
echo   - Production build compiled successfully into /dist.

echo.
echo ======================================================
echo   SETUP & BUILD COMPLETED SUCCESSFULLY! 🎉
echo ======================================================
echo.
echo To start development server:
echo   npm run dev
echo.
echo To start production server:
echo   npm run start
echo.
PAUSE
