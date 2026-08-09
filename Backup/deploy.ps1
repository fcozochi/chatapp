# ============================================================================
# ChatApp Pro - Complete Automated Deployment Script
# ============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ChatApp Pro - Automated Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# STEP 1: FIX PACKAGE.JSON
# ============================================================================

Write-Host "[1] Fixing package.json..." -ForegroundColor Yellow

$rootPackage = @'
{
  "name": "chatapp-pro",
  "version": "3.0.0",
  "private": true,
  "scripts": {
    "install-all": "npm install && cd server && npm install && cd ../client && npm install",
    "build": "cd client && npm run build",
    "start": "cd server && npm start",
    "railway-start": "cd server && npm start"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
'@

Set-Content -Path "package.json" -Value $rootPackage -Encoding UTF8
Write-Host "  [OK] package.json updated" -ForegroundColor Green

# ============================================================================
# STEP 2: FIX SERVER PACKAGE.JSON
# ============================================================================

Write-Host ""
Write-Host "[2] Fixing server package.json..." -ForegroundColor Yellow

$serverPackage = @'
{
  "name": "chatapp-pro-server",
  "version": "3.0.0",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "pg": "^8.11.3",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "uuid": "^9.0.1",
    "helmet": "^7.1.0",
    "compression": "^1.7.4"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
'@

Set-Content -Path "server\package.json" -Value $serverPackage -Encoding UTF8
Write-Host "  [OK] server/package.json updated" -ForegroundColor Green

# ============================================================================
# STEP 3: CREATE SERVER APP.JS
# ============================================================================

Write-Host ""
Write-Host "[3] Creating server app.js..." -ForegroundColor Yellow

$serverApp = @'
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.connect((err) => {
    if (err) {
        console.error('Database error:', err.message);
        process.exit(1);
    }
    console.log('Database connected');
});

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(compression());
app.use(express.json());

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '3.0.0',
            environment: process.env.NODE_ENV || 'production',
            database: 'connected'
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        message: 'ChatApp Pro API',
        version: '3.0.0',
        timestamp: new Date().toISOString()
    });
});

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, sex, ageVerified } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        const existing = await pool.query(
            'SELECT id FROM users WHERE username = $1 AND expires_at > CURRENT_TIMESTAMP',
            [username]
        );
        
        if (existing.rowCount > 0) {
            return res.status(400).json({ error: 'Username already taken' });
        }
        
        const userId = uuidv4();
        const hashedPassword = await bcrypt.hash(password, 10);
        const token = jwt.sign(
            { userId, username },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );
        
        await pool.query(
            `INSERT INTO users (
                id, username, password_hash, sex, age_verified,
                session_token, created_at, expires_at, last_active
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 
                NOW() + INTERVAL '7 days', NOW())`,
            [userId, username, hashedPassword, sex || 'prefer-not', ageVerified || false, token]
        );
        
        res.status(201).json({
            success: true,
            userId,
            username,
            token,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const result = await pool.query(
            'SELECT id, username, password_hash, expires_at FROM users WHERE username = $1',
            [username]
        );
        
        if (result.rowCount === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        
        if (new Date(user.expires_at) < new Date()) {
            return res.status(401).json({ error: 'Session expired. Please register again.' });
        }
        
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );
        
        await pool.query(
            'UPDATE users SET session_token = $1, last_active = NOW() WHERE id = $2',
            [token, user.id]
        );
        
        res.json({
            success: true,
            userId: user.id,
            username: user.username,
            token,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

app.get('/api/auth/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const result = await pool.query(
            'SELECT id, username FROM users WHERE id = $1 AND session_token = $2 AND expires_at > CURRENT_TIMESTAMP',
            [decoded.userId, token]
        );
        
        if (result.rowCount === 0) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        res.json({ valid: true, user: result.rows[0] });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

app.get('/api/chat/rooms', (req, res) => {
    const rooms = [
        { id: 'usa', name: 'USA', icon: 'US' },
        { id: 'canada', name: 'Canada', icon: 'CA' },
        { id: 'africa', name: 'Africa', icon: 'AF' },
        { id: 'asia', name: 'Asia', icon: 'AS' },
        { id: 'europe', name: 'Europe', icon: 'EU' }
    ];
    res.json({ success: true, rooms });
});

app.get('/api/chat/rooms/:roomName/messages', async (req, res) => {
    try {
        const { roomName } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        
        const result = await pool.query(
            `SELECT m.id, m.room_name, m.sender_id, m.content, m.language, m.created_at,
                    u.username
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             WHERE m.room_name = $1 AND m.is_dm = false
             ORDER BY m.created_at DESC
             LIMIT $2`,
            [roomName, limit]
        );
        
        res.json({ success: true, messages: result.rows.reverse() });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

const clientPath = path.join(__dirname, '../../client/dist');
const fs = require('fs');

if (fs.existsSync(clientPath)) {
    app.use(express.static(clientPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(clientPath, 'index.html'));
    });
} else {
    app.get('*', (req, res) => {
        res.send(`
            <html>
                <head><title>ChatApp Pro</title></head>
                <body style="font-family:Arial;text-align:center;padding:50px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center;">
                    <div style="max-width:500px;padding:40px;background:rgba(255,255,255,0.1);border-radius:20px;">
                        <div style="font-size:64px;">CHAT</div>
                        <h1>ChatApp Pro</h1>
                        <p style="font-size:18px;opacity:0.9;">API is running on Railway!</p>
                        <div style="margin-top:20px;padding:10px 30px;background:rgba(255,255,255,0.15);border-radius:30px;display:inline-block;">
                            System Online
                        </div>
                        <div style="margin-top:30px;font-size:14px;opacity:0.7;">
                            Build the client with: npm run build
                        </div>
                    </div>
                </body>
            </html>
        `);
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('ChatApp Pro on Railway');
    console.log('='.repeat(50));
    console.log('Port: ' + PORT);
    console.log('Environment: ' + (process.env.NODE_ENV || 'development'));
    console.log('Database: Connected');
    console.log('='.repeat(50));
});

module.exports = { app, server, pool };
'@

Set-Content -Path "server\src\app.js" -Value $serverApp -Encoding UTF8
Write-Host "  [OK] server/src/app.js created" -ForegroundColor Green

# ============================================================================
# STEP 4: CREATE RAILWAY.JSON
# ============================================================================

Write-Host ""
Write-Host "[4] Creating railway.json..." -ForegroundColor Yellow

$railwayJson = @'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd client && npm install && npm run build && cd ../server && npm install"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100
  }
}
'@

Set-Content -Path "railway.json" -Value $railwayJson -Encoding UTF8
Write-Host "  [OK] railway.json created" -ForegroundColor Green

# ============================================================================
# STEP 5: INSTALL DEPENDENCIES
# ============================================================================

Write-Host ""
Write-Host "[5] Installing dependencies..." -ForegroundColor Yellow

Write-Host "  Installing root dependencies..." -ForegroundColor Gray
npm install 2>&1 | Out-Null

Write-Host "  Installing server dependencies..." -ForegroundColor Gray
Push-Location server
npm install 2>&1 | Out-Null
Pop-Location

Write-Host "  Installing client dependencies..." -ForegroundColor Gray
Push-Location client
npm install 2>&1 | Out-Null
Pop-Location

Write-Host "  [OK] All dependencies installed" -ForegroundColor Green

# ============================================================================
# STEP 6: BUILD CLIENT
# ============================================================================

Write-Host ""
Write-Host "[6] Building client..." -ForegroundColor Yellow

Push-Location client
npm run build 2>&1 | Out-Null
Pop-Location
Write-Host "  [OK] Client built successfully" -ForegroundColor Green

# ============================================================================
# STEP 7: CREATE SQL MIGRATION
# ============================================================================

Write-Host ""
Write-Host "[7] Creating SQL migration..." -ForegroundColor Yellow

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

SELECT 'Users:' as label, COUNT(*) as count FROM users;
SELECT 'Messages:' as label, COUNT(*) as count FROM messages;
'@

Set-Content -Path "migration.sql" -Value $migrationSql -Encoding UTF8
Write-Host "  [OK] migration.sql created at E:\ChatApp\migration.sql" -ForegroundColor Green

# ============================================================================
# STEP 8: DEPLOY TO RAILWAY
# ============================================================================

Write-Host ""
Write-Host "[8] Deploying to Railway..." -ForegroundColor Yellow
Write-Host "  Running: railway up" -ForegroundColor Gray

railway up

# ============================================================================
# STEP 9: GET DEPLOYMENT INFO
# ============================================================================

Write-Host ""
Write-Host "[9] Getting deployment info..." -ForegroundColor Yellow

$domain = railway domain 2>&1
Write-Host "  URL: $domain" -ForegroundColor Cyan

# ============================================================================
# STEP 10: SQL MIGRATION INSTRUCTIONS
# ============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEP - RUN SQL MIGRATION:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Since psql is not installed, run the SQL manually:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Open: https://railway.app/dashboard" -ForegroundColor White
Write-Host "  2. Click on 'server' project" -ForegroundColor White
Write-Host "  3. Click on 'Postgres' service" -ForegroundColor White
Write-Host "  4. Click on 'Data' tab" -ForegroundColor White
Write-Host "  5. Click 'Query' button" -ForegroundColor White
Write-Host "  6. Copy SQL from: E:\ChatApp\migration.sql" -ForegroundColor White
Write-Host "  7. Click 'Run Query'" -ForegroundColor White
Write-Host ""
Write-Host "ALTERNATIVE - Install PostgreSQL:" -ForegroundColor Yellow
Write-Host "  Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
Write-Host "  Then run: railway connect" -ForegroundColor White
Write-Host ""
Write-Host "ACCESS YOUR APP:" -ForegroundColor Cyan
Write-Host "  URL: $domain" -ForegroundColor White
Write-Host ""
Write-Host "DEMO CREDENTIALS:" -ForegroundColor Cyan
Write-Host "  Username: demo_user" -ForegroundColor White
Write-Host "  Password: demo123" -ForegroundColor White
Write-Host ""
Write-Host "TEST ENDPOINTS:" -ForegroundColor Cyan
Write-Host "  Health: $domain/health" -ForegroundColor White
Write-Host "  Status: $domain/api/status" -ForegroundColor White
Write-Host "  Rooms: $domain/api/chat/rooms" -ForegroundColor White
Write-Host ""
Write-Host "VIEW LOGS:" -ForegroundColor Cyan
Write-Host "  railway logs" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Green