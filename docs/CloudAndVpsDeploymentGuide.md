# InstaSend Multi-Cloud & VPS Deployment Master Guide 🚀
### Production Deployment on GCP, AWS, Microsoft Azure, Vercel & Any Generic VPS

This guide provides end-to-end instructions for deploying **InstaSend** across all major cloud providers, serverless container platforms, and bare-metal/virtual private servers (VPS).

---

## 📋 Table of Contents
1. [Architecture & Runtime Requirements](#1-architecture--runtime-requirements)
2. [Automated Setup Scripts & Docker Quickstart](#2-automated-setup-scripts--docker-quickstart)
3. [Google Cloud Platform (GCP) Deployment](#3-google-cloud-platform-gcp-deployment)
   * [Option A: Google Cloud Run (Recommended Serverless Container)](#option-a-google-cloud-run)
   * [Option B: Google Compute Engine (Ubuntu 24.04 VM)](#option-b-google-compute-engine)
4. [Amazon Web Services (AWS) Deployment](#4-amazon-web-services-aws-deployment)
   * [Option A: AWS App Runner](#option-a-aws-app-runner)
   * [Option B: AWS EC2 (Ubuntu 24.04 LTS)](#option-b-aws-ec2)
   * [Option C: AWS Lightsail (Low-Cost VPS)](#option-c-aws-lightsail)
   * [Option D: AWS ECS / Fargate with ALB](#option-d-aws-ecs--fargate)
5. [Microsoft Azure Deployment](#5-microsoft-azure-deployment)
   * [Option A: Azure Container Apps (Recommended)](#option-a-azure-container-apps)
   * [Option B: Azure App Service (Linux Web App)](#option-b-azure-app-service)
   * [Option C: Azure Virtual Machines](#option-c-azure-virtual-machines)
6. [Vercel Deployment Guide & Architecture Analysis](#6-vercel-deployment-guide--architecture-analysis)
   * [Understanding Serverless Limitations (WebSockets)](#understanding-serverless-limitations)
   * [Recommended Hybrid Architecture (Vercel Frontend + Container Backend)](#recommended-hybrid-architecture)
7. [Generic Linux VPS Deployment (DigitalOcean, Hetzner, Linode, OVH, Vultr)](#7-generic-linux-vps-deployment)
   * [Step 1: System Dependencies & Node.js 22 LTS](#step-1-system-dependencies)
   * [Step 2: Automated Build via Setup Script](#step-2-automated-build)
   * [Step 3: PM2 Process Management](#step-3-pm2-process-management)
   * [Step 4: Systemd Service Unit](#step-4-systemd-service-unit)
   * [Step 5: Nginx Reverse Proxy with WebSocket Upgrades](#step-5-nginx-reverse-proxy)
   * [Step 6: Caddy Reverse Proxy (Automatic HTTPS)](#step-6-caddy-reverse-proxy)
   * [Step 7: UFW Firewall & Security Hardening](#step-7-ufw-firewall)
8. [Database Persistence & Backup Strategy (node:sqlite)](#8-database-persistence--backup-strategy)
9. [Environment Variables Reference](#9-environment-variables-reference)
10. [Enterprise STUN/TURN Server Setup (Coturn)](#10-enterprise-stunturn-server-setup)
11. [Monitoring, Health Checks & Troubleshooting](#11-monitoring-health-checks--troubleshooting)

---

## 1. Architecture & Runtime Requirements

InstaSend is engineered as a unified full-stack application:
* **Frontend**: React 19 SPA bundled into high-performance static assets (`/dist`) via Vite 6.
* **Backend**: Node.js HTTP/Express API server serving static assets and REST endpoints (`/api/*`).
* **Real-Time Signaling**: Built-in WebSocket server (`ws`) handling WebRTC SDP offer/answer exchanges and room management (`/ws`).
* **Database**: Native Node.js SQLite (`node:sqlite` DatabaseSync) utilizing Write-Ahead Logging (`WAL`) with zero external native C++ compilation dependencies.

### Hardware & Software Prerequisites
| Component | Minimum Spec | Recommended Production Spec |
| :--- | :--- | :--- |
| **Node.js** | v22.5.0+ (required for `node:sqlite`) | v22.14.0+ LTS |
| **npm** | v9.0.0+ | v10.0.0+ |
| **CPU** | 1 vCPU | 2 vCPU |
| **Memory** | 512 MB RAM (with 1 GB swap for build) | 1 GB - 2 GB RAM |
| **Disk** | 2 GB free disk space | 10 GB+ SSD |
| **Open Ports** | Port 3000 (or 80/443 via reverse proxy) | 80 (HTTP), 443 (HTTPS), 3478 (STUN/TURN) |

> ⚠️ **Important Node.js Version Check**: Always verify `node -v` outputs `v22.5.0` or higher. InstaSend uses Node's native `DatabaseSync` engine (`import { DatabaseSync } from 'node:sqlite'`), eliminating the need for `better-sqlite3` or python/make/gcc compilers.

---

## 2. Automated Setup Scripts & Docker Quickstart

InstaSend includes production-ready automated setup scripts and container configs for zero-friction installation.

### Option 1: Automated Shell Script (Linux / macOS / VPS)
```bash
# Clone the repository
git clone https://github.com/your-username/instasend.git
cd instasend

# Run the automated 8-step setup pipeline (checks Node 22, SQLite, installs deps, tests, builds)
chmod +x setup.sh
./setup.sh

# Or run with immediate production start:
./setup.sh --start

# Or skip test suite for rapid CI/CD container builds:
./setup.sh --skip-tests --start
```

### Option 2: Automated Windows Batch Script (Windows Server / Dev Machine)
```cmd
# Double click setup.bat or run in CMD / PowerShell:
setup.bat

# For rapid build without tests:
setup.bat --skip-tests --start
```

### Option 3: Docker & Docker Compose (1-Command Any Host)
InstaSend provides a multi-stage, production-hardened `Dockerfile` and `docker-compose.yml`:

```bash
# Start container in background with persistent volume
docker compose up -d --build

# Inspect container health
docker compose ps
docker compose logs -f

# Stop container
docker compose down
```

The container automatically:
- Mounts `/app/data` to a persistent Docker named volume (`instasend-data`).
- Listens on port `3000` (mapped to host `3000`).
- Performs automated healthchecks every 30s against `/api/db/status`.

---

## 3. Google Cloud Platform (GCP) Deployment

### Option A: Google Cloud Run (Recommended Serverless Container)
Google Cloud Run provides serverless container execution with automatic TLS, custom domain support, and built-in WebSocket support.

#### Step 1: Install Google Cloud SDK & Authenticate
```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
```

#### Step 2: Build & Push Container to Google Artifact Registry
```bash
# Create an Artifact Registry Docker repository
gcloud artifacts repositories create instasend-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="InstaSend Docker Repository"

# Build and submit the container image via Google Cloud Build
gcloud builds submit --tag us-central1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/instasend-repo/instasend:latest .
```

#### Step 3: Deploy to Cloud Run
```bash
gcloud run deploy instasend \
    --image us-central1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/instasend-repo/instasend:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --port 3000 \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 1 \
    --max-instances 10 \
    --session-affinity \
    --set-env-vars NODE_ENV=production,DATA_DIR=/tmp/instasend_data,JWT_SECRET=your_production_secret_key_here
```

> 🔑 **Key Cloud Run Settings Explained**:
> 1. `--session-affinity`: **CRITICAL**. Ensures WebSocket signaling clients remain connected to the same container instance during negotiation.
> 2. `--min-instances 1`: Prevents cold starts from interrupting ongoing WebSockets or dropping peer rooms.
> 3. `--port 3000`: Cloud Run automatically routes ingress traffic from port 443 to container port 3000.
> 4. `DATA_DIR=/tmp/instasend_data`: Uses in-memory `/tmp` for the ephemeral SQLite database. For multi-container persistent user databases, mount a Cloud Storage bucket via Cloud Run Volume Mounts (Cloud Storage FUSE) or point to Cloud SQL.

---

### Option B: Google Compute Engine (Ubuntu 24.04 VM)

#### Step 1: Create GCE Instance
```bash
gcloud compute instances create instasend-vm \
    --zone=us-central1-a \
    --machine-type=e2-small \
    --image-family=ubuntu-2404-lts \
    --image-project=ubuntu-os-cloud \
    --tags=http-server,https-server \
    --boot-disk-size=20GB
```

#### Step 2: Configure Firewall
```bash
gcloud compute firewall-rules create allow-http-https-instasend \
    --allow tcp:80,tcp:443,tcp:3000 \
    --target-tags=http-server,https-server
```

#### Step 3: SSH into VM & Deploy
```bash
gcloud compute ssh instasend-vm --zone=us-central1-a
```
Once inside the VM, proceed to [Section 7: Generic Linux VPS Deployment](#7-generic-linux-vps-deployment).

---

## 4. Amazon Web Services (AWS) Deployment

### Option A: AWS App Runner
AWS App Runner offers fully managed container deployment with automatic load balancing, TLS certificates, and WebSocket support.

1. **Push Container to AWS ECR**:
   ```bash
   aws ecr create-repository --repository-name instasend --region us-east-1
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
   docker tag instasend-app:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/instasend:latest
   docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/instasend:latest
   ```
2. **Create App Runner Service**:
   - Go to AWS Console > **App Runner** > **Create service**.
   - Source: **Container registry** > **Amazon ECR**.
   - Deployment settings: **Automatic**.
   - Port: `3000`.
   - Environment variables:
     - `NODE_ENV`: `production`
     - `PORT`: `3000`
     - `JWT_SECRET`: Generate a secure 64-char string.

---

### Option B: AWS EC2 (Ubuntu 24.04 LTS)

1. **Launch EC2 Instance**:
   - AMI: **Ubuntu Server 24.04 LTS (HVM)**, SSD Volume Type.
   - Instance Type: `t4g.small` (ARM64) or `t3.small` (x86_64).
   - Key Pair: Select or create your `.pem` key pair.
2. **Configure Security Group**:
   - Inbound Rules:
     - SSH (`tcp/22`) from your IP.
     - HTTP (`tcp/80`) from `0.0.0.0/0`.
     - HTTPS (`tcp/443`) from `0.0.0.0/0`.
     - Custom TCP (`tcp/3000`) optional for testing.
3. **Connect and Run Setup**:
   ```bash
   ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
   ```
   Follow [Section 7: Generic Linux VPS Deployment](#7-generic-linux-vps-deployment) to configure Node 22, PM2, and Nginx SSL.

---

### Option C: AWS Lightsail (Low-Cost VPS)
AWS Lightsail is the simplest and most cost-effective AWS hosting method ($3.50 – $5.00/month):

1. Go to AWS Lightsail Console > **Create instance**.
2. Select **Linux/Unix** platform > **OS Only** > **Ubuntu 24.04 LTS**.
3. Choose the $3.50 or $5.00 plan (1 GB RAM, 1 vCPU, 40 GB SSD).
4. In the **Networking** tab, create a **Static IP** and attach it to your instance.
5. In **IPv4 Firewall**, ensure ports **80**, **443**, and **22** are open.
6. Click **Connect using SSH** in the browser and run the quick installer in Section 7.

---

### Option D: AWS ECS / Fargate with ALB
For enterprise high-availability infrastructure:
1. **Task Definition**:
   - Container image: `YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/instasend:latest`
   - Port mappings: `3000` (TCP).
   - CPU: `256`, Memory: `512`.
2. **Application Load Balancer (ALB) Settings**:
   - Target Group: Protocol `HTTP`, Port `3000`.
   - Health check path: `/api/db/status`.
   - **Crucial**: In Target Group attributes, enable **Stickiness** (Duration-based cookie, e.g. 1 hour) so WebSockets reconnect to the same task.
   - Increase ALB **Idle Timeout** from 60s to `300s` or higher to prevent premature WebSocket signaling closures.

---

## 5. Microsoft Azure Deployment

### Option A: Azure Container Apps (Recommended)
Azure Container Apps provides a Kubernetes-powered serverless environment with out-of-the-box WebSocket support and session stickiness.

```bash
# 1. Log in to Azure
az login

# 2. Create resource group and container app environment
az group create --name instasend-rg --location eastus
az containerapp env create --name instasend-env --resource-group instasend-rg --location eastus

# 3. Deploy application from Dockerfile
az containerapp up \
    --name instasend-app \
    --resource-group instasend-rg \
    --environment instasend-env \
    --source . \
    --target-port 3000 \
    --ingress external

# 4. Enable Session Affinity for WebSockets
az containerapp ingress sticky-sessions set \
    --name instasend-app \
    --resource-group instasend-rg \
    --affinity sticky
```

---

### Option B: Azure App Service (Linux Web App)
1. Go to Azure Portal > **Create a resource** > **Web App**.
2. Settings:
   - OS: **Linux**
   - Runtime Stack: **Node 22 LTS** (or Docker Container)
   - Region: East US / West Europe
   - Pricing Plan: Basic B1 or higher (Free/Shared tiers do not support continuous WebSockets)
3. **Enable WebSockets**:
   - In Azure Portal, navigate to your Web App > **Configuration** > **General settings**.
   - Toggle **Web sockets**: **On**.
   - Save configuration.
4. Set Startup Command in Configuration > General Settings:
   ```bash
   node dist/server.js
   ```

---

## 6. Vercel Deployment Guide & Architecture Analysis

### Understanding Serverless Limitations
Vercel is built specifically for **stateless, serverless frontend workflows and edge functions**:
* **Serverless Execution Window**: Serverless functions have hard execution time limits (10s on Hobby, 60s on Pro).
* **No Persistent WebSockets**: Vercel Serverless Functions **cannot sustain long-lived bidirectional WebSocket connections**. Once a request completes, the lambda container freezes or terminates.
* **Ephemeral File System**: SQLite databases written to serverless `/tmp` are wiped whenever the lambda scales down or rotates.

### Recommended Hybrid Architecture
The industry-standard production setup for running InstaSend with Vercel is a **Decoupled Hybrid Architecture**:

```
 ┌─────────────────────────────────────────────────────────┐
 │               Vercel Edge Network (Global CDN)          │
 │         Static React 19 Frontend + PWA Service Worker   │
 └────────────────────────────┬────────────────────────────┘
                              │
                    WebSocket & API Calls
                              │
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │         Dedicated Signaling Server & SQLite DB          │
 │    (Google Cloud Run / Render / Railway / Fly.io / VPS) │
 │          Listens on /ws and serves /api/* endpoints      │
 └─────────────────────────────────────────────────────────┘
```

#### Step 1: Deploy Backend Signaling to Cloud Run / Railway / Fly.io
Deploy the backend using Docker or `./setup.sh` to any container host as documented in Sections 3, 4, 5, or 7.
Let's assume your backend URL is: `https://api.yourdomain.com` (or `https://instasend-backend.up.railway.app`).

#### Step 2: Configure `vercel.json` Rewrite Proxy
Create a `vercel.json` file in the root of the project to proxy WebSocket and API requests to your dedicated backend:

```json
{
  "framework": "vite",
  "buildCommand": "vite build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.yourdomain.com/api/:path*"
    },
    {
      "source": "/ws",
      "destination": "https://api.yourdomain.com/ws"
    }
  ]
}
```

#### Step 3: Deploy Frontend to Vercel
```bash
npm install -g vercel
vercel --prod
```
The client browser loads the UI instantly from Vercel's global CDN while WebRTC signaling connects seamlessly to your persistent container backend.

---

## 7. Generic Linux VPS Deployment
*(Compatible with DigitalOcean Droplet, Hetzner Cloud, Linode, OVHcloud, Vultr, Contabo, Scaleway, or Bare-Metal)*

### Step 1: System Dependencies & Node.js 22 LTS
Run the following commands on a fresh **Ubuntu 24.04 LTS / 22.04 LTS** server:

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl git build-essential ufw

# Install Node.js 22.x LTS from NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js v22 and native SQLite engine
node -v
node -e "const { DatabaseSync } = require('node:sqlite'); console.log('SQLite OK!');"
```

### Step 2: Automated Build via Setup Script
```bash
# Create application directory
sudo mkdir -p /var/www/instasend
sudo chown -R $USER:$USER /var/www/instasend
cd /var/www/instasend

# Clone project repository
git clone https://github.com/your-username/instasend.git .

# Run automated setup and production build
chmod +x setup.sh
./setup.sh --skip-tests
```

### Step 3: PM2 Process Management
PM2 ensures the server automatically restarts if it crashes and boots up automatically on system reboots:

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start InstaSend production server
pm2 start dist/server.js --name "instasend" --env NODE_ENV=production

# Configure PM2 to launch on system reboot
pm2 startup systemd
# Copy-paste the command printed by the command above, then save state:
pm2 save

# Useful PM2 commands:
pm2 status
pm2 logs instasend
pm2 restart instasend
```

### Step 4: Systemd Service Unit (Alternative to PM2)
If you prefer native Linux `systemd` instead of PM2:

```bash
sudo tee /etc/systemd/system/instasend.service > /dev/null << 'EOF'
[Unit]
Description=InstaSend WebRTC P2P Transfer & Signaling Server
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/instasend
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=BIND_HOST=127.0.0.1
Environment=DATA_DIR=/var/lib/instasend
Environment=SQLITE_PATH=/var/lib/instasend/instasend.db
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=instasend

# Security sandbox
ProtectSystem=full
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Create persistent database folder with proper permissions
sudo mkdir -p /var/lib/instasend
sudo chown -R www-data:www-data /var/lib/instasend
sudo chown -R www-data:www-data /var/www/instasend

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable instasend
sudo systemctl start instasend
sudo systemctl status instasend
```

### Step 5: Nginx Reverse Proxy with WebSocket Upgrades
Nginx terminates SSL and proxies both HTTP and persistent WebSocket traffic to port 3000.

1. **Install Nginx & Certbot**:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```
2. **Create Nginx Server Block** (`/etc/nginx/sites-available/instasend`):
   ```nginx
   map $http_upgrade $connection_upgrade {
       default upgrade;
       ''      close;
   }

   server {
       listen 80;
       server_name send.yourdomain.com;

       # Max body size for avatar uploads or note payloads
       client_max_body_size 50M;

       # Frontend & API Proxy
       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection $connection_upgrade;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           
           # WebSocket timeouts: keep connections alive
           proxy_read_timeout 86400s;
           proxy_send_timeout 86400s;
       }

       # Explicit WebSocket route
       location /ws {
           proxy_pass http://127.0.0.1:3000/ws;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection $connection_upgrade;
           proxy_set_header Host $host;
           proxy_read_timeout 86400s;
           proxy_send_timeout 86400s;
       }
   }
   ```
3. **Enable Site & Obtain SSL Certificate**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/instasend /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx

   # Obtain free automated SSL certificate via Let's Encrypt
   sudo certbot --nginx -d send.yourdomain.com
   ```

### Step 6: Caddy Reverse Proxy (Alternative: Automatic HTTPS in 3 Lines)
If you prefer **Caddy** (which automatically provisions and renews SSL certificates without Certbot):

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Edit /etc/caddy/Caddyfile:
sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
send.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}
EOF

# Restart Caddy
sudo systemctl reload caddy
```
Caddy handles HTTP-to-HTTPS redirect, Let's Encrypt certificates, and WebSocket upgrade proxying out of the box with zero additional configuration.

### Step 7: UFW Firewall & Security Hardening
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## 8. Database Persistence & Backup Strategy

InstaSend uses SQLite via Node.js native `DatabaseSync` (`node:sqlite`). SQLite operates in **WAL (Write-Ahead Logging)** mode.

### Database Location Configuration
By default, the server writes database files to:
- Production environment: `process.env.DATA_DIR || process.env.SQLITE_DIR`
- Fallback: `/app/data` (in Docker) or OS temporary directory (`os.tmpdir()/instasend_data`).

To persist data permanently across container or server updates, always specify:
```bash
export DATA_DIR="/var/lib/instasend"
export SQLITE_PATH="/var/lib/instasend/instasend.db"
```

### Automated Live Backups (Zero Locking)
SQLite WAL mode allows live hot backups while the server is running without locking write transactions:

```bash
# Create automated backup script: /usr/local/bin/backup-instasend.sh
sudo tee /usr/local/bin/backup-instasend.sh > /dev/null << 'EOF'
#!/usr/bin/env bash
BACKUP_DIR="/var/backups/instasend"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

# Perform live VACUUM INTO atomic backup
sqlite3 /var/lib/instasend/instasend.db "VACUUM INTO '$BACKUP_DIR/instasend_$TIMESTAMP.db';"

# Delete backups older than 14 days
find "$BACKUP_DIR" -type f -name "instasend_*.db" -mtime +14 -delete
EOF

sudo chmod +x /usr/local/bin/backup-instasend.sh

# Add to root crontab to run daily at 03:00 AM:
(crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/backup-instasend.sh") | crontab -
```

---

## 9. Environment Variables Reference

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | Set to `production` for production mode. |
| `PORT` | `3000` | Port for the Express API and WebSocket server. |
| `BIND_HOST` | `0.0.0.0` | IP interface to bind to (`0.0.0.0` for all interfaces). |
| `DATA_DIR` | `/app/data` or `tmp` | Directory where SQLite database and session files reside. |
| `SQLITE_PATH` | `$DATA_DIR/instasend.db` | Explicit filepath for the primary SQLite database file. |
| `JWT_SECRET` | (Auto-generated fallback) | Cryptographic secret for signing admin and user authentication JWTs. |
| `APP_URL` | `http://localhost:3000` | Fully qualified public URL (used for sharing links and QR codes). |
| `STUN_SERVERS` | Google / Cloudflare STUN | Comma-separated list of STUN servers for WebRTC NAT traversal. |
| `TURN_SERVER_URL` | (Optional) | `turn:turn.yourdomain.com:3478` for enterprise symmetric NAT relaying. |
| `TURN_USERNAME` | (Optional) | Authentication username for TURN relay. |
| `TURN_CREDENTIAL` | (Optional) | Authentication password/secret for TURN relay. |

---

## 10. Enterprise STUN/TURN Server Setup (Coturn)

WebRTC transfers connect peer-to-peer 90% of the time using public STUN servers (`stun:stun.l.google.com:19302`). However, when both peers are behind **symmetric NATs** or strict corporate/cellular firewalls, a TURN relay server is required.

To host your own open-source **Coturn** TURN server on Ubuntu:

```bash
# Install Coturn
sudo apt install -y coturn

# Edit /etc/turnserver.conf:
sudo tee /etc/turnserver.conf > /dev/null << 'EOF'
listening-port=3478
tls-listening-port=5349
listening-ip=YOUR_SERVER_PUBLIC_IP
external-ip=YOUR_SERVER_PUBLIC_IP
realm=turn.yourdomain.com
fingerprint
lt-cred-mech
user=instasenduser:SecureTurnPassword123
cert=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
EOF

# Enable and restart Coturn
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
sudo systemctl restart coturn
```

Add the TURN credentials to your InstaSend `.env` configuration:
```env
TURN_SERVER_URL="turn:turn.yourdomain.com:3478"
TURN_USERNAME="instasenduser"
TURN_CREDENTIAL="SecureTurnPassword123"
```

---

## 11. Monitoring, Health Checks & Troubleshooting

### Health & Telemetry Endpoints
InstaSend exposes JSON endpoints for load balancer health probes and uptime checkers:
* **Database & Server Status**: `GET /api/db/status`
  ```bash
  curl -i https://send.yourdomain.com/api/db/status
  ```
  Returns `200 OK` with `{ "success": true, "engine": "node:sqlite", "tables": [...] }`.
* **Admin Telemetry Portal**: `GET /admin`
  Protected by admin credentials. Pre-seeded default:
  - **Username**: `admin`
  - **Password**: `1@3$5^7*9`

### Common Issues & Quick Solutions

#### Issue 1: "node:sqlite DatabaseSync is not available"
* **Cause**: Node.js runtime is older than v22.5.0.
* **Fix**: Upgrade Node.js via NodeSource:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
  ```

#### Issue 2: WebSockets close immediately or room codes disconnect
* **Cause**: Reverse proxy or Cloud load balancer is missing WebSocket upgrade headers or has an aggressive 60-second idle timeout.
* **Fix**: 
  - Ensure Nginx contains `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`.
  - Set `proxy_read_timeout 86400s;` in Nginx.
  - On AWS ALB or GCP Cloud Run, enable **Session Stickiness / Affinity**.

#### Issue 3: Port 3000 already in use (`EADDRINUSE`)
* **Cause**: A background dev or test server is already running.
* **Fix**:
  ```bash
  # Check which process is holding port 3000:
  lsof -i :3000
  # Or kill the process:
  npx kill-port 3000
  ```

---

## 🏁 Summary Checklist for Production Launch
- [x] Node.js v22.5+ verified (`node -v`).
- [x] Native `node:sqlite` verified.
- [x] Persistent volume or directory created (`/app/data` or `/var/lib/instasend`).
- [x] Environment variables configured (`NODE_ENV=production`, `PORT=3000`, `JWT_SECRET`).
- [x] Reverse proxy (Nginx/Caddy) configured with WebSocket upgrade headers.
- [x] Valid SSL certificate installed via Let's Encrypt.
- [x] Default admin password changed in Admin Portal (`/admin`).
- [x] Automated daily SQLite backup cron scheduled.
