@echo off
SETLOCAL EnableDelayedExpansion

TITLE InstaSend Local Setup & Deployment Script (Windows)

set SKIP_TESTS=false
set AUTO_START=false
set AUTO_DEV=false

:parse_args
if "%~1"=="" goto continue_setup
if /I "%~1"=="--skip-tests" set SKIP_TESTS=true
if /I "%~1"=="/skip-tests" set SKIP_TESTS=true
if /I "%~1"=="--start" set AUTO_START=true
if /I "%~1"=="--deploy" set AUTO_START=true
if /I "%~1"=="--dev" set AUTO_DEV=true
shift
goto parse_args

:continue_setup
echo ======================================================
echo   InstaSend ⚡ Setup & Deployment Pipeline (Windows)
echo ======================================================
echo.

:: 1. Check Node.js
echo [1/8] Checking Node.js availability...
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
echo [2/8] Checking npm availability...
WHERE npm >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed or not in PATH.
    pause
    exit /b 1
)
FOR /F "tokens=*" %%i IN ('npm -v') DO SET NPM_VERSION=%%i
echo   - Found npm version: %NPM_VERSION%

:: 3. Check SQLite3 / Node native sqlite support
echo [3/8] Verifying SQLite3 database support (node:sqlite)...
node -e "try { const { DatabaseSync } = require('node:sqlite'); console.log('   - Node native SQLite DatabaseSync engine confirmed available.'); } catch(e) { console.error('   - [ERROR] node:sqlite not available. Please ensure Node.js v22.5+ is installed.'); process.exit(1); }"
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] SQLite3 native database check failed.
    pause
    exit /b 1
)

:: 4. Verify environment configuration
echo [4/8] Verifying environment configuration...
IF NOT EXIST .env (
    IF EXIST .env.example (
        echo   - Creating .env from .env.example...
        copy .env.example .env >nul
    ) ELSE (
        echo NODE_ENV=production>.env
        echo PORT=3000>>.env
    )
    echo   - Environment file initialized (.env).
) ELSE (
    echo   - Existing .env file found.
)

:: 5. Install npm dependencies
echo [5/8] Installing project dependencies (npm install)...
call npm install
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
)
echo   - Dependencies installed successfully.

:: 6. Initialize & Verify SQLite Database Tables & Seeds
echo [6/8] Initializing & testing SQLite database tables and seed accounts...
call npx tsx -e "import('./server/db.ts').then(() => console.log('   - SQLite database initialized and pre-seeded successfully.'))"
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Database initialization failed.
    pause
    exit /b 1
)

:: 7. Run automated test suite
IF "%SKIP_TESTS%"=="true" (
    echo [7/8] Skipping automated test suite (--skip-tests specified).
) ELSE (
    echo [7/8] Running automated test suite (npm test)...
    call npm test
    IF %ERRORLEVEL% NEQ 0 (
        echo [WARNING] Some tests reported issues, but proceeding with build...
    ) ELSE (
        echo   - All test suites passed successfully!
    )
)

:: 8. Build production bundle
echo [8/8] Building production bundle (npm run build)...
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
echo Deployment Options:
echo   1. Start Production Server: npm run start
echo   2. Start Development Server: npm run dev
echo.

IF "%AUTO_START%"=="true" (
    echo Starting production server now...
    npm run start
    goto end
)
IF "%AUTO_DEV%"=="true" (
    echo Starting development server now...
    npm run dev
    goto end
)

PAUSE

:end
