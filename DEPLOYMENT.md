# Deployment Guide - Command Agent v3

This guide will help you deploy Command Agent v3 from the sandbox to your Windows development environment and then to production.

## 📋 Table of Contents

1. [Deploy to Windows Development](#deploy-to-windows-development)
2. [Deploy to Production (Coolify)](#deploy-to-production-coolify)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Testing Deployment](#testing-deployment)
6. [Troubleshooting](#troubleshooting)

---

## 🖥️ Deploy to Windows Development

### Step 1: Download the Application

From your Windows machine:

```powershell
# Navigate to your project directory
cd C:\Users\mani.padisetti\

# If you have the old version, rename it
if (Test-Path "command-agent-v3") {
    Rename-Item "command-agent-v3" "command-agent-v3-old-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}

# Create new directory
New-Item -ItemType Directory -Path "command-agent-v3"
cd command-agent-v3
```

**Option A: Download ZIP from this conversation**
1. I'll provide a ZIP file in the next message
2. Extract to `C:\Users\mani.padisetti\command-agent-v3\`

**Option B: Use Git (if you have a repository)**
```powershell
git clone <your-repo-url> .
```

### Step 2: Install Dependencies

```powershell
# Install Node.js packages
npm install

# This will install all dependencies including:
# - Express, PostgreSQL, Redis clients
# - Anthropic SDK
# - Security packages (Helmet, CORS)
# - File processing (Multer, Mammoth, PDF-parse)
# - Logging (Winston)
```

### Step 3: Configure Environment

Your `.env` file is already included with the correct credentials:

```powershell
# Verify .env exists
Test-Path .env
# Should return: True

# View contents (optional)
Get-Content .env
```

**Important**: The `.env` file contains your production database credentials. Keep it secure!

### Step 4: Verify Database Connection

```powershell
# Quick test - start server and check output
npm start

# You should see:
# ✅ Database pool connected
# ✅ Database tables initialized
# ✅ Database connection verified
# Server running on http://localhost:4004
```

If you see these messages, database connection is working!

### Step 5: Test the Application

1. **Keep the server running** from Step 4
2. **Open your browser**: `http://localhost:4004`
3. **You should see**: The Command Agent v3 interface
4. **Try uploading a file**: Create a simple `test.txt` with some requirements

### Step 6: Verify All Features

**Test Upload:**
```powershell
# Create a test requirements file
@"
Build a simple to-do list application.
Features:
- Add tasks
- Mark tasks complete
- Delete tasks
- Save to local storage
"@ | Out-File -FilePath "test-requirements.txt" -Encoding UTF8

# Upload this file through the web interface
# Navigate to http://localhost:4004
```

**Test Analysis:**
- After upload, analysis should start automatically
- You should see a summary and clarifying questions

**Test Generation:**
- Answer the questions (or skip them)
- Click "Generate Application"
- Watch the progress bar and log

**Test Download:**
- Once generation completes, click "Download ZIP"
- Extract and verify the generated code

---

## 🚀 Deploy to Production (Coolify)

### Option 1: Deploy via Git (Recommended)

#### Step 1: Create Git Repository

```powershell
cd C:\Users\mani.padisetti\command-agent-v3

# Initialize Git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Command Agent v3 - Production Ready"

# Add remote (GitHub, GitLab, or Bitbucket)
git remote add origin <your-repo-url>

# Push
git push -u origin main
```

#### Step 2: Deploy in Coolify

1. **Log into Coolify**: `http://170.64.228.171:8000/`

2. **Create New Service**:
   - Click "New Service"
   - Select "Git Repository"
   - Enter your repository URL
   - Select branch: `main`

3. **Configure Build**:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Port: `4004`

4. **Add Environment Variables**:
   Copy from your `.env` file:
   ```
   DB_HOST=170.64.228.171
   DB_PORT=3000
   DB_NAME=almostmagic
   DB_USER=postgres
   DB_PASSWORD=odvX0tijW0S6qJ1V0LIZtADhvXe7RK4ExowtkUs99n2z8k0efeDsQooZH2HdEWZb
   REDIS_HOST=170.64.228.171
   REDIS_PORT=3001
   REDIS_PASSWORD=KKLmd9clu3Wo3nKXptEtK823XnuPsBKfaqZKYhCjb2WHuuc1K4LA2rfjfDKZQRBC
   ANTHROPIC_API_KEY=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
   PORT=4004
   NODE_ENV=production
   SESSION_SECRET=<generate-new-secret>
   CORS_ORIGIN=*
   ```

5. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete
   - Check logs for success messages

6. **Access Application**:
   - Coolify will provide a URL
   - Or access via: `http://170.64.228.171:<assigned-port>`

### Option 2: Manual Deployment

If you prefer to deploy manually to your DigitalOcean droplet:

```bash
# SSH into your droplet
ssh root@170.64.228.171

# Navigate to deployment directory
cd /var/www/

# Clone or copy your code
git clone <your-repo-url> command-agent-v3
cd command-agent-v3

# Install dependencies
npm install --production

# Copy environment file
nano .env
# Paste your environment variables

# Install PM2 for process management
npm install -g pm2

# Start application
pm2 start server.js --name command-agent-v3

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

---

## ⚙️ Environment Configuration

### Required Variables

```env
# Database - REQUIRED
DB_HOST=170.64.228.171
DB_PORT=3000
DB_NAME=almostmagic
DB_USER=postgres
DB_PASSWORD=<your-password>

# Anthropic AI - REQUIRED
ANTHROPIC_API_KEY=<your-api-key>

# Server - REQUIRED
PORT=4004
NODE_ENV=production
```

### Optional Variables

```env
# Redis - Optional (caching)
REDIS_HOST=170.64.228.171
REDIS_PORT=3001
REDIS_PASSWORD=<your-password>

# Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800

# Security
SESSION_SECRET=<generate-strong-secret>
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/command-agent.log
```

### Generate Secure Session Secret

```powershell
# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

```bash
# Linux/Mac
openssl rand -base64 32
```

---

## 🗄️ Database Setup

### Verify Tables Exist

The application needs these tables:

1. **projects** - Stores project metadata
2. **documents** - Stores uploaded requirements
3. **generated_files** - Stores generated code
4. **chat_messages** - Stores chat history (auto-created)

### Check Tables

```sql
-- Connect to database
psql -h 170.64.228.171 -p 3000 -U postgres -d almostmagic

-- List tables
\dt

-- Check projects table
\d projects

-- Check documents table
\d documents

-- Check generated_files table
\d generated_files
```

### Auto-Created Table

The `chat_messages` table is automatically created on first startup:

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🧪 Testing Deployment

### 1. Health Check

```powershell
# Test health endpoint
curl http://localhost:4004/api/health

# Expected response:
# {
#   "status": "healthy",
#   "database": "connected",
#   "redis": "connected",
#   "version": "3.0.0"
# }
```

### 2. Upload Test

```powershell
# Create test file
@"
Test Requirements:
- Feature 1
- Feature 2
"@ | Out-File -FilePath "test.txt" -Encoding UTF8

# Upload via curl (or use web interface)
curl -X POST http://localhost:4004/api/upload `
  -F "projectName=Test Project" `
  -F "files=@test.txt"
```

### 3. Full Workflow Test

1. **Upload**: Upload a requirements file
2. **Analyze**: Wait for analysis to complete
3. **Generate**: Answer questions and generate code
4. **Download**: Download the ZIP file
5. **Verify**: Extract and check generated files

### 4. Load Test (Optional)

```powershell
# Install Apache Bench (if not installed)
# Or use any load testing tool

# Test with 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:4004/api/health
```

---

## 🐛 Troubleshooting

### Issue: Server Won't Start

**Symptoms**: `npm start` fails or crashes

**Solutions**:
```powershell
# Check Node.js version
node --version
# Should be 18+ (22.13.0 recommended)

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
Remove-Item -Recurse -Force node_modules
npm install

# Check for port conflicts
netstat -ano | findstr :4004
# If port is in use, kill the process or change PORT in .env
```

### Issue: Database Connection Failed

**Symptoms**: "Database connection failed" in logs

**Solutions**:
```powershell
# Test database connectivity
Test-NetConnection -ComputerName 170.64.228.171 -Port 3000

# Verify credentials in .env
Get-Content .env | Select-String "DB_"

# Test with psql (if installed)
# Or use a database client like DBeaver
```

### Issue: Redis Connection Failed

**Symptoms**: Redis errors in console

**Solutions**:
```powershell
# Redis is optional - app works without it
# To disable, comment out Redis variables in .env:
# REDIS_HOST=...
# REDIS_PORT=...
# REDIS_PASSWORD=...

# Or verify Redis is running
Test-NetConnection -ComputerName 170.64.228.171 -Port 3001
```

### Issue: File Upload Fails

**Symptoms**: "Upload failed" error

**Solutions**:
```powershell
# Check uploads directory exists and is writable
if (!(Test-Path "uploads")) {
    New-Item -ItemType Directory -Path "uploads"
}

# Check file size limits in .env
Get-Content .env | Select-String "MAX_FILE_SIZE"
# Default: 52428800 (50MB)

# Check file type is supported
# Supported: .txt, .md, .pdf, .docx, .doc
```

### Issue: Generation Hangs

**Symptoms**: Code generation never completes

**Solutions**:
```powershell
# Check Anthropic API key
Get-Content .env | Select-String "ANTHROPIC_API_KEY"

# Test API key manually
curl https://api.anthropic.com/v1/messages `
  -H "x-api-key: YOUR_API_KEY" `
  -H "anthropic-version: 2023-06-01" `
  -H "content-type: application/json" `
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":1024,"messages":[{"role":"user","content":"Hello"}]}'

# Check logs for errors
Get-Content logs/error.log -Tail 50
```

### Issue: Frontend Not Loading

**Symptoms**: Blank page or 404 errors

**Solutions**:
```powershell
# Verify public directory exists
Test-Path public/index.html
Test-Path public/styles.css
Test-Path public/app.js

# Check server is serving static files
curl http://localhost:4004/
# Should return HTML

# Clear browser cache
# Ctrl+Shift+Delete in most browsers
```

---

## 📊 Monitoring

### Log Files

```powershell
# View combined logs
Get-Content logs/combined.log -Tail 50 -Wait

# View error logs only
Get-Content logs/error.log -Tail 50 -Wait

# Search for specific errors
Select-String -Path logs/combined.log -Pattern "error" -Context 2
```

### Database Monitoring

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'almostmagic';

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check recent projects
SELECT id, name, status, created_at 
FROM projects 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 🔒 Security Checklist

Before going to production:

- [ ] Change `SESSION_SECRET` to a strong random value
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGIN` to your domain
- [ ] Enable HTTPS (use Coolify's automatic SSL)
- [ ] Review and adjust rate limits
- [ ] Set up database backups
- [ ] Configure firewall rules
- [ ] Enable monitoring/alerting
- [ ] Review and rotate API keys regularly
- [ ] Set up log rotation
- [ ] Test disaster recovery procedures

---

## 📞 Support

If you encounter issues:

1. **Check logs**: `logs/error.log` and `logs/combined.log`
2. **Review this guide**: Most issues are covered above
3. **Check database**: Verify tables and connections
4. **Test API key**: Ensure Anthropic API is working
5. **Contact support**: If all else fails

---

**Deployment completed! Your Command Agent v3 is ready to generate applications! 🚀**
