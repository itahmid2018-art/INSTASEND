# InstaSend Technical & Security Documentation Index

Welcome to the **InstaSend** Documentation Hub. This directory contains detailed guides covering system architecture, server deployment, security audit procedures, QA test suites, and native mobile build instructions.

---

## 📚 Documentation Index

### 1. 📋 [Deployment Guidelines & Testing Standard Operating Procedure (SOP) (`DeploymentAndTestingSOP.md`)](./DeploymentAndTestingSOP.md)
* **Audience**: DevOps Engineers, System Administrators, Security Auditors, QA Engineers, Release Managers
* **Topics Covered**:
  - **Dependencies Verification SOP**: Node.js 22.5+, native `node:sqlite`, memory, port checks, automated test suites
  - **Deployment Guidelines SOP**: Automated 1-command setup scripts (`setup.sh`, `setup.bat`), Docker Compose, Linux VPS (PM2 + Nginx SSL), and Cloud platforms (GCP Cloud Run, AWS App Runner, Azure Container Apps)
  - **Admin Testing SOP**: Admin portal authentication (`admin` / `1@3$5^7*9`), `/api/db/status` health, active LAN peer radar tracking, user account role management, password rotation
  - **User Acceptance Testing (UAT) SOP**: 10 comprehensive user test cases (6-char codes, QR mobile scan, sending queue, JSZip auto-archive, folder drop, text compression, secret passcodes, SHA-256 checks, offline Wi-Fi mode, user auth)
  - **Production Release Sign-Off Checklist**: 12-point release approval table

### 2. 🛡️ [Security Architecture, Testing & Verification Guide](./SecurityTestingAndVerification.md)
* **Audience**: Security Auditors, QA Engineers, Developers, Users
* **Topics Covered**:
  - Zero-Cloud Storage & Zero-Trust Architecture
  - WebRTC DTLS 1.2 End-to-End Encryption
  - Bit-for-Bit SHA-256 Web Crypto API Integrity Verification
  - `scrypt` Password Hashing with unique 16-byte hex salts & constant-time timing-safe comparison
  - Content Security Policy (CSP), XSS prevention & SQL injection mitigation
  - Step-by-Step Security Test Verification Procedures (Tests 1 through 7)
  - Security Audit Test Report Template

### 3. 🧪 [Complete Features & QA Verification Guide](./FeaturesAndQAVerification.md)
* **Audience**: QA Testers, Product Managers, Users
* **Topics Covered**:
  - Full Product Feature Matrix (P2P Transfer, Encrypted Notes, Folder Dropping, Text Deflate Compression, Recharts Speed Visualizer, Serverless Local Wi-Fi Mode, Local Radar, Admin Portal, Android Apps)
  - Step-by-Step QA Test Cases (TC-01 through TC-08)
  - End-to-End QA Release Verification Checklist

### 4. 🖥️ [Production Server & Database Setup Guide](./ServerSetup.md)
* **Audience**: System Administrators, DevOps Engineers, Backend Developers
* **Topics Covered**:
  - Node.js native SQLite database (`node:sqlite`) with Write-Ahead Logging (`WAL`)
  - Server architecture & WebSocket signaling
  - Pre-seeded admin (`admin` / `1@3$5^7*9`) & test user accounts
  - Admin Portal (`/admin`) telemetry, active LAN peer radar tracking, user management
  - REST API endpoint specifications (`/api/db/status`, `/api/auth/signin`, `/api/admin/*`)
  - Production deployment via PM2, systemd service, and Nginx reverse proxy

### 5. ☁️ [Multi-Cloud & VPS Deployment Guide (`CloudAndVpsDeploymentGuide.md`)](./CloudAndVpsDeploymentGuide.md)
* **Audience**: Cloud Architects, DevOps Engineers, System Administrators
* **Topics Covered**:
  - Production deployment on Google Cloud Platform (Cloud Run, Compute Engine VM, App Engine)
  - Production deployment on AWS (App Runner, EC2, Lightsail $3.50 VPS, ECS/Fargate + ALB)
  - Production deployment on Microsoft Azure (Azure Container Apps, Linux App Service, Azure VMs)
  - Vercel architectural analysis & decoupled hybrid deployment (Vercel Frontend + Dedicated Backend)
  - Generic Linux VPS deployment (DigitalOcean, Hetzner, Linode, OVH, Vultr)
  - Multi-stage Docker containerization & Docker Compose (`docker compose up -d`)
  - Automated 8-step setup pipelines (`setup.sh`, `setup.bat`)
  - SQLite WAL persistence, live zero-downtime hot backup crons, and Coturn STUN/TURN server setup

### 6. 📱 [Android Mobile & Android TV Build Guide](./AndroidBuildGuide.md)
* **Audience**: Mobile Developers, QA Testers, Release Engineers
* **Topics Covered**:
  - Capacitor hybrid architecture (`capacitor.config.json`)
  - Android Mobile (Phones & Tablets) and Android TV / Google TV Leanback dual-launchers
  - Step-by-step Gradle build commands (`assembleDebug`, `assembleRelease`, `bundleRelease`)
  - Keystore generation & APK / AAB cryptographic signing (`zipalign`, `apksigner`)
  - Wireless ADB debugging for Android TV devices & TV D-Pad focus indicators
  - Play Store Pre-flight Security Checklist & Serverless Offline Wi-Fi Mode

### 7. 🗄️ [Pre-seeded SQL Database File (`admin_and_test_users.sql`)](./admin_and_test_users.sql)
* **Audience**: Database Administrators, Testers
* **Topics Covered**:
  - Schema definitions for `users`, `managed_files`, and `transfer_history` tables
  - Pre-computed `scrypt` password hashes and salts for admin and demo accounts

### 8. 📜 [Prompt History, Errors & Issue Log Dump (`PromptsAndIssueLogDump.md`)](./PromptsAndIssueLogDump.md)
* **Audience**: Developers, DevOps, Auditors, Project Stakeholders
* **Topics Covered**:
  - Chronological log of all prompts, development milestones, and timestamps from inception to current date
  - In-depth technical breakdown of all errors encountered (esbuild transpile errors, `tsx watch` restart loops, Vite `optimizeDeps` pre-bundler overrides, JSON/HTML MIME parsing errors)
  - Complete issue and resolution matrix with 100% test verification status

---

## 🚀 Quick Reference Commands

```bash
# 1-Command Automated Setup & Production Build (Linux/macOS/VPS)
./setup.sh --start

# 1-Command Automated Setup (Windows)
setup.bat --start

# 1-Command Containerized Deployment with Docker Compose
docker compose up -d --build
# Start Development Environment (Express + Vite + WebSockets on port 3000)
npm run dev

# Run Production Build
npm run build && npm run start

# Build Native Android Project & Sync Capacitor
npm run build:android

# Import Pre-seeded Database via SQLite CLI
sqlite3 data/instasend.db < docs/admin_and_test_users.sql
```
