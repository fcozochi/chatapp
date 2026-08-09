# ============================================================================
# ChatApp Pro - File Copy Script
# ============================================================================

$PROJECT_ROOT = "E:\ChatApp"
$SERVER_DIR = "$PROJECT_ROOT\server"
$CLIENT_DIR = "$PROJECT_ROOT\client"
$DATABASE_DIR = "$PROJECT_ROOT\database"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ChatApp Pro - File Copy Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# CREATE FOLDERS
# ============================================================================

Write-Host "[1] Creating folders..." -ForegroundColor Yellow

$folders = @(
    "$SERVER_DIR\src\config",
    "$SERVER_DIR\src\models",
    "$SERVER_DIR\src\services",
    "$SERVER_DIR\src\middleware",
    "$SERVER_DIR\src\routes",
    "$SERVER_DIR\src\websocket",
    "$SERVER_DIR\src\utils",
    "$CLIENT_DIR\src\components\auth",
    "$CLIENT_DIR\src\components\rooms",
    "$CLIENT_DIR\src\components\chat",
    "$CLIENT_DIR\src\components\dm",
    "$CLIENT_DIR\src\components\subscription",
    "$CLIENT_DIR\src\components\common",
    "$CLIENT_DIR\src\hooks",
    "$CLIENT_DIR\src\context",
    "$CLIENT_DIR\src\services",
    "$CLIENT_DIR\src\styles",
    "$CLIENT_DIR\src\utils",
    "$CLIENT_DIR\public\assets\flags",
    "$CLIENT_DIR\public\assets\icons",
    "$DATABASE_DIR\migrations",
    "$DATABASE_DIR\seeds"
)

foreach ($folder in $folders) {
    if (!(Test-Path $folder)) {
        New-Item -Path $folder -ItemType Directory -Force | Out-Null
        Write-Host "  Created: $folder" -ForegroundColor Green
    }
}

# ============================================================================
# ROOT FILES
# ============================================================================

Write-Host ""
Write-Host "[2] Creating root files..." -ForegroundColor Yellow

# package.json
@'
{
  "name": "chatapp-pro",
  "version": "3.0.0",
  "private": true,
  "scripts": {
    "install-all": "npm install; cd server; npm install; cd ../client; npm install",
    "start": "cd server; npm start"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
'@ | Set-Content -Path "$PROJECT_ROOT\package.json" -Encoding UTF8
Write-Host "  Created: package.json" -ForegroundColor Green

# run.bat
@'
@echo off
echo Starting ChatApp Pro...
echo.
echo Starting Server...
start "ChatApp Server" cmd /k "cd /d E:\ChatApp\server && npm run dev"
timeout /t 2 /nobreak >nul
echo Starting Client...
start "ChatApp Client" cmd /k "cd /d E:\ChatApp\client && npm run dev"
echo.
echo ChatApp Pro is starting!
echo Frontend: http://localhost:5173
echo Backend: http://localhost:3000
echo.
pause
'@ | Set-Content -Path "$PROJECT_ROOT\run.bat" -Encoding ASCII
Write-Host "  Created: run.bat" -ForegroundColor Green

# ============================================================================
# SERVER FILES
# ============================================================================

Write-Host ""
Write-Host "[3] Creating server files..." -ForegroundColor Yellow

# server/package.json
@'
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
'@ | Set-Content -Path "$SERVER_DIR\package.json" -Encoding UTF8
Write-Host "  Created: server/package.json" -ForegroundColor Green

# server/.env
@'
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatapp_pro
SESSION_SECRET=your-super-secret-key-change-this
JWT_SECRET=your-jwt-secret-change-this
CORS_ORIGIN=http://localhost:5173
CLIENT_URL=http://localhost:5173
'@ | Set-Content -Path "$SERVER_DIR\.env" -Encoding UTF8
Write-Host "  Created: server/.env" -ForegroundColor Green

# server/src/app.js
@'
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
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20
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

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '3.0.0'
    });
});

app.get('/api/status', (req, res) => {
    res.json({ status: 'online', message: 'ChatApp Pro API' });
});

const clientPath = path.join(__dirname, '../../client/dist');
const fs = require('fs');
if (fs.existsSync(clientPath)) {
    app.use(express.static(clientPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(clientPath, 'index.html'));
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('ChatApp Pro Server');
    console.log('='.repeat(50));
    console.log('HTTP: http://localhost:' + PORT);
    console.log('Health: http://localhost:' + PORT + '/health');
    console.log('='.repeat(50));
});

module.exports = { app, server, pool };
'@ | Set-Content -Path "$SERVER_DIR\src\app.js" -Encoding UTF8
Write-Host "  Created: server/src/app.js" -ForegroundColor Green

# ============================================================================
# CLIENT FILES
# ============================================================================

Write-Host ""
Write-Host "[4] Creating client files..." -ForegroundColor Yellow

# client/package.json
@'
{
  "name": "chatapp-pro-client",
  "version": "3.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  }
}
'@ | Set-Content -Path "$CLIENT_DIR\package.json" -Encoding UTF8
Write-Host "  Created: client/package.json" -ForegroundColor Green

# client/vite.config.js
@'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/ws': {
                target: 'ws://localhost:3000',
                ws: true
            }
        }
    },
    build: {
        outDir: 'dist',
        sourcemap: true
    }
});
'@ | Set-Content -Path "$CLIENT_DIR\vite.config.js" -Encoding UTF8
Write-Host "  Created: client/vite.config.js" -ForegroundColor Green

# client/index.html
@'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ChatApp Pro</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            text-align: center;
            padding: 50px;
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            max-width: 500px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .logo { font-size: 72px; }
        h1 { font-size: 42px; margin: 10px 0; }
        .subtitle { opacity: 0.9; font-size: 18px; margin-bottom: 30px; }
        .status {
            display: inline-block;
            padding: 12px 35px;
            background: rgba(255,255,255,0.15);
            border-radius: 30px;
            font-weight: 500;
        }
        .status .dot {
            display: inline-block;
            width: 10px; height: 10px;
            background: #4caf50;
            border-radius: 50%;
            margin-right: 10px;
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.9); }
        }
        .features {
            margin-top: 30px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }
        .feature {
            background: rgba(255,255,255,0.05);
            padding: 10px 15px;
            border-radius: 10px;
            font-size: 14px;
        }
        @media (max-width: 600px) {
            .container { padding: 30px 20px; margin: 20px; }
            .features { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
</body>
</html>
'@ | Set-Content -Path "$CLIENT_DIR\index.html" -Encoding UTF8
Write-Host "  Created: client/index.html" -ForegroundColor Green

# client/src/main.jsx
@'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
'@ | Set-Content -Path "$CLIENT_DIR\src\main.jsx" -Encoding UTF8
Write-Host "  Created: client/src/main.jsx" -ForegroundColor Green

# client/src/App.jsx
@'
import React, { useState, useEffect } from 'react';

function App() {
    const [status, setStatus] = useState('Checking...');
    const [serverTime, setServerTime] = useState('');

    useEffect(() => {
        fetch('/api/status')
            .then(res => res.json())
            .then(data => {
                setStatus('Online');
                setServerTime(data.timestamp || new Date().toISOString());
            })
            .catch(() => setStatus('Offline'));
    }, []);

    return (
        <div className="app">
            <header className="app-header">
                <div className="logo">💬</div>
                <h1>ChatApp Pro</h1>
                <p>Premium communication platform</p>
                <div className="status-badge">
                    <span className="dot"></span>
                    {status}
                </div>
            </header>

            <main className="app-main">
                <div className="welcome-card">
                    <h2>Ready to Connect</h2>
                    <p>Your premium chat experience awaits</p>
                    <div className="features-grid">
                        <div className="feature-item">🌍 5 Regions</div>
                        <div className="feature-item">💬 Direct Messaging</div>
                        <div className="feature-item">🔒 Secure</div>
                        <div className="feature-item">⚡ Real-time</div>
                    </div>
                    {serverTime && (
                        <div className="server-info">
                            Server: {new Date(serverTime).toLocaleString()}
                        </div>
                    )}
                </div>
            </main>

            <style>{`
                .app {
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    background: #f0f2f5;
                }
                .app-header {
                    text-align: center;
                    padding: 40px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .app-header .logo { font-size: 48px; }
                .app-header h1 { font-size: 36px; margin: 10px 0; }
                .app-header p { opacity: 0.9; font-size: 18px; }
                .status-badge {
                    display: inline-block;
                    margin-top: 15px;
                    padding: 8px 24px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 30px;
                    font-weight: 500;
                }
                .status-badge .dot {
                    display: inline-block;
                    width: 8px; height: 8px;
                    background: #4caf50;
                    border-radius: 50%;
                    margin-right: 8px;
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(0.8); }
                }
                .app-main {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                }
                .welcome-card {
                    background: white;
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
                    max-width: 500px;
                    width: 100%;
                    text-align: center;
                }
                .welcome-card h2 { color: #1a1a2e; margin-bottom: 8px; }
                .welcome-card p { color: #666; margin-bottom: 24px; }
                .features-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-bottom: 24px;
                }
                .feature-item {
                    background: #f8f9fa;
                    padding: 12px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    font-weight: 500;
                    color: #333;
                }
                .server-info {
                    padding: 12px;
                    background: #f8f9fa;
                    border-radius: 10px;
                    font-size: 13px;
                    color: #666;
                }
                @media (max-width: 600px) {
                    .features-grid { grid-template-columns: 1fr; }
                    .welcome-card { padding: 25px; }
                    .app-header h1 { font-size: 28px; }
                }
            `}</style>
        </div>
    );
}

export default App;
'@ | Set-Content -Path "$CLIENT_DIR\src\App.jsx" -Encoding UTF8
Write-Host "  Created: client/src/App.jsx" -ForegroundColor Green

# client/src/styles/globals.css
@'
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: #f0f2f5;
    color: #1a1a2e;
}

:root {
    --primary: #667eea;
    --secondary: #764ba2;
    --success: #10b981;
    --error: #ef4444;
}

::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 9999px;
}

::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
}
'@ | Set-Content -Path "$CLIENT_DIR\src\styles\globals.css" -Encoding UTF8
Write-Host "  Created: client/src/styles/globals.css" -ForegroundColor Green

# ============================================================================
# DATABASE FILES
# ============================================================================

Write-Host ""
Write-Host "[5] Creating database files..." -ForegroundColor Yellow

@'
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

CREATE INDEX IF NOT EXISTS idx_users_expires_at ON users(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_session ON users(session_token);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC);
'@ | Set-Content -Path "$DATABASE_DIR\migrations\001_initial_schema.sql" -Encoding UTF8
Write-Host "  Created: database/migrations/001_initial_schema.sql" -ForegroundColor Green

# ============================================================================
# FINAL SUMMARY
# ============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ALL FILES CREATED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Install dependencies:" -ForegroundColor Cyan
Write-Host "     npm run install-all" -ForegroundColor White
Write-Host ""
Write-Host "  2. Setup database (if using PostgreSQL):" -ForegroundColor Cyan
Write-Host "     psql -U postgres -c 'CREATE DATABASE chatapp_pro;'" -ForegroundColor White
Write-Host "     psql -U postgres -d chatapp_pro -f database\migrations\001_initial_schema.sql" -ForegroundColor White
Write-Host ""
Write-Host "  3. Start the app:" -ForegroundColor Cyan
Write-Host "     .\run.bat" -ForegroundColor White
Write-Host ""
Write-Host "  4. Access the app:" -ForegroundColor Cyan
Write-Host "     Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "     Backend:  http://localhost:3000" -ForegroundColor White
Write-Host "     Health:   http://localhost:3000/health" -ForegroundColor White
Write-Host ""
Write-Host "  5. Place your logo:" -ForegroundColor Cyan
Write-Host "     client\public\assets\logo.png" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Green