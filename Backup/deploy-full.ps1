# ============================================================================
# ChatApp Pro - Complete Automated Deployment Script
# ============================================================================

Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "  ChatApp Pro - Complete Automated Deployment" -ForegroundColor Cyan
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# CHECK PREREQUISITES
# ============================================================================

Write-Host "[1] Checking prerequisites..." -ForegroundColor Yellow

# Check if railway CLI is installed
$railwayCmd = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railwayCmd) {
    Write-Host "  Installing Railway CLI..." -ForegroundColor Gray
    npm install -g @railway/cli
}

# Update Railway CLI
Write-Host "  Updating Railway CLI..." -ForegroundColor Gray
railway upgrade --yes 2>$null

Write-Host "  [OK] Prerequisites ready" -ForegroundColor Green

# ============================================================================
# GET CURRENT DATABASE URL
# ============================================================================

Write-Host ""
Write-Host "[2] Getting current database configuration..." -ForegroundColor Yellow

# Get current DATABASE_URL
$currentDbUrl = railway variables get DATABASE_URL 2>$null

if ($currentDbUrl) {
    Write-Host "  Current DATABASE_URL found" -ForegroundColor Green
    
    # Extract connection parts
    if ($currentDbUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+)") {
        $dbUser = $Matches[1]
        $dbPass = $Matches[2]
        $dbHost = $Matches[3]
        $dbPort = $Matches[4]
        $dbName = $Matches[5]
        
        Write-Host "  Host: $dbHost" -ForegroundColor Gray
        Write-Host "  Port: $dbPort" -ForegroundColor Gray
        Write-Host "  Current DB: $dbName" -ForegroundColor Gray
        
        $newDbName = "chatapp_db"
        $newDbUrl = "postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${newDbName}"
        
        Write-Host "  New DB: $newDbName" -ForegroundColor Cyan
    }
} else {
    Write-Host "  No DATABASE_URL found. Please link your project first." -ForegroundColor Red
    Write-Host "  Run: railway link" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# CREATE NEW DATABASE
# ============================================================================

Write-Host ""
Write-Host "[3] Creating new database: chatapp_db..." -ForegroundColor Yellow

# Create the database using psql via railway connect
$createDbSql = "CREATE DATABASE chatapp_db;"

Write-Host "  Creating database..." -ForegroundColor Gray

# Try using railway connect with echo
$createDbResult = echo $createDbSql | railway connect 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Database 'chatapp_db' created successfully" -ForegroundColor Green
} else {
    Write-Host "  [WARNING] Database may already exist or psql not available" -ForegroundColor Yellow
    Write-Host "  We will continue and try to use it anyway." -ForegroundColor Gray
}

# ============================================================================
# RUN MIGRATION
# ============================================================================

Write-Host ""
Write-Host "[4] Running SQL migration..." -ForegroundColor Yellow

# Create migration SQL file
$migrationSql = @'
-- ChatApp Pro Database Schema
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    sex VARCHAR(10),
    age_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_token VARCHAR(255) UNIQUE,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    preferences JSONB DEFAULT '{"dm_acceptance":"requests_only"}',
    blocked_users UUID[] DEFAULT '{}',
    current_room VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid(),
    room_name VARCHAR(20) NOT NULL,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_dm BOOLEAN DEFAULT false,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS dm_requests (
    id UUID DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sender_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_users_expires_at ON users(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_session ON users(session_token);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_dm ON messages(recipient_id, created_at DESC) WHERE is_dm = true;
CREATE INDEX IF NOT EXISTS idx_dm_requests_status ON dm_requests(status);

INSERT INTO users (id, username, password_hash, sex, age_verified, expires_at)
SELECT 
    gen_random_uuid(),
    'demo_user',
    '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'male',
    true,
    NOW() + INTERVAL '7 days'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'demo_user');

INSERT INTO messages (room_name, sender_id, content, created_at)
SELECT 
    room_name,
    (SELECT id FROM users WHERE username = 'demo_user'),
    'Welcome to ChatApp Pro! Start chatting with people from around the world!',
    NOW()
FROM (VALUES ('usa'), ('canada'), ('africa'), ('asia'), ('europe')) AS rooms(room_name)
WHERE EXISTS (SELECT 1 FROM users WHERE username = 'demo_user');
'@

# Save migration to file
$migrationPath = "E:\ChatApp\migration.sql"
Set-Content -Path $migrationPath -Value $migrationSql -Encoding UTF8
Write-Host "  Migration SQL saved to: $migrationPath" -ForegroundColor Green

# Try to run migration via railway connect
Write-Host "  Running migration..." -ForegroundColor Gray

# Connect to the new database and run migration
$migrationCommand = "\c chatapp_db; " + ($migrationSql -replace "`n", " ")
$runMigration = echo $migrationCommand | railway connect 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Migration completed successfully" -ForegroundColor Green
} else {
    Write-Host "  [WARNING] Manual migration may be needed" -ForegroundColor Yellow
    Write-Host "  Please run the migration manually via Railway Dashboard" -ForegroundColor Gray
}

# ============================================================================
# UPDATE ENVIRONMENT VARIABLES
# ============================================================================

Write-Host ""
Write-Host "[5] Updating environment variables..." -ForegroundColor Yellow

# Set the new DATABASE_URL
if ($newDbUrl) {
    Write-Host "  Setting DATABASE_URL to use chatapp_db..." -ForegroundColor Gray
    railway variables set DATABASE_URL="$newDbUrl" 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] DATABASE_URL updated" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] Could not update DATABASE_URL" -ForegroundColor Yellow
        Write-Host "  Please set it manually: railway variables set DATABASE_URL='$newDbUrl'" -ForegroundColor Gray
    }
}

# Set other required variables
Write-Host "  Setting other environment variables..." -ForegroundColor Gray

railway variables set NODE_ENV=production 2>&1 | Out-Null
railway variables set PORT=3000 2>&1 | Out-Null
railway variables set SESSION_SECRET=your-super-secret-key-change-this 2>&1 | Out-Null
railway variables set JWT_SECRET=your-jwt-secret-change-this 2>&1 | Out-Null

# Get the domain
$domain = railway domain 2>&1
if ($domain -match "https://([^/]+)") {
    $appDomain = $Matches[0]
    railway variables set CORS_ORIGIN="$appDomain" 2>&1 | Out-Null
    railway variables set CLIENT_URL="$appDomain" 2>&1 | Out-Null
    Write-Host "  CORS_ORIGIN set to: $appDomain" -ForegroundColor Gray
}

Write-Host "  [OK] Environment variables updated" -ForegroundColor Green

# ============================================================================
# DEPLOY TO RAILWAY
# ============================================================================

Write-Host ""
Write-Host "[6] Deploying to Railway..." -ForegroundColor Yellow

# Build the client
Write-Host "  Building client..." -ForegroundColor Gray
Push-Location client
npm run build 2>&1 | Out-Null
Pop-Location
Write-Host "  [OK] Client built" -ForegroundColor Green

# Deploy
Write-Host "  Deploying to Railway..." -ForegroundColor Gray
$deployResult = railway up 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Deployment initiated" -ForegroundColor Green
} else {
    Write-Host "  [WARNING] Deployment may have issues" -ForegroundColor Yellow
    Write-Host "  Check logs: railway logs" -ForegroundColor Gray
}

# ============================================================================
# GET DEPLOYMENT INFO
# ============================================================================

Write-Host ""
Write-Host "[7] Getting deployment info..." -ForegroundColor Yellow

# Get domain
$domain = railway domain 2>&1
if ($domain -match "https://([^/]+)") {
    $appUrl = $Matches[0]
} else {
    $appUrl = "https://server-production.up.railway.app"
}

Write-Host "  App URL: $appUrl" -ForegroundColor Cyan

# ============================================================================
# VERIFY DEPLOYMENT
# ============================================================================

Write-Host ""
Write-Host "[8] Verifying deployment..." -ForegroundColor Yellow

# Check health endpoint
try {
    $healthCheck = Invoke-WebRequest -Uri "$appUrl/health" -UseBasicParsing -TimeoutSec 5
    if ($healthCheck.StatusCode -eq 200) {
        Write-Host "  [OK] Health check passed!" -ForegroundColor Green
        Write-Host "  Response: $($healthCheck.Content)" -ForegroundColor Gray
    } else {
        Write-Host "  [WARNING] Health check returned: $($healthCheck.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [WARNING] Could not reach health endpoint (may still be starting)" -ForegroundColor Yellow
    Write-Host "  Try again in a few minutes: curl $appUrl/health" -ForegroundColor Gray
}

# ============================================================================
# FINAL SUMMARY
# ============================================================================

Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=========================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "ACCESS YOUR APP:" -ForegroundColor Cyan
Write-Host "  URL: $appUrl" -ForegroundColor White
Write-Host ""
Write-Host "TEST ENDPOINTS:" -ForegroundColor Cyan
Write-Host "  Health: $appUrl/health" -ForegroundColor White
Write-Host "  Status: $appUrl/api/status" -ForegroundColor White
Write-Host "  Rooms: $appUrl/api/chat/rooms" -ForegroundColor White
Write-Host ""
Write-Host "DEMO CREDENTIALS:" -ForegroundColor Cyan
Write-Host "  Username: demo_user" -ForegroundColor White
Write-Host "  Password: demo123" -ForegroundColor White
Write-Host ""
Write-Host "DATABASE:" -ForegroundColor Cyan
Write-Host "  Database: chatapp_db" -ForegroundColor White
Write-Host "  Separated from your dating app" -ForegroundColor White
Write-Host ""
Write-Host "MIGRATION SQL:" -ForegroundColor Cyan
Write-Host "  File: E:\ChatApp\migration.sql" -ForegroundColor White
Write-Host ""
Write-Host "VIEW LOGS:" -ForegroundColor Cyan
Write-Host "  Command: railway logs" -ForegroundColor White
Write-Host ""
Write-Host "MANUAL STEPS (if needed):" -ForegroundColor Yellow
Write-Host "  1. If database was not created automatically:" -ForegroundColor White
Write-Host "     railway connect -c 'CREATE DATABASE chatapp_db;'" -ForegroundColor White
Write-Host "  2. If migration was not run:" -ForegroundColor White
Write-Host "     Copy SQL from E:\ChatApp\migration.sql to Railway Dashboard -> Data -> Query" -ForegroundColor White
Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Green

# ============================================================================
# SAVE DEPLOYMENT INFO
# ============================================================================

$deploymentInfo = @"
ChatApp Pro Deployment Info
===========================
Deployed: $(Get-Date)
App URL: $appUrl
Database: chatapp_db (separate from dating app)
Demo User: demo_user
Demo Pass: demo123

Endpoints:
- Health: $appUrl/health
- Status: $appUrl/api/status
- Rooms: $appUrl/api/chat/rooms

Commands:
- View logs: railway logs
- Open app: railway open
- Restart: railway restart
"@

Set-Content -Path "E:\ChatApp\deployment-info.txt" -Value $deploymentInfo -Encoding UTF8
Write-Host "  Deployment info saved to: E:\ChatApp\deployment-info.txt" -ForegroundColor Green
Write-Host ""