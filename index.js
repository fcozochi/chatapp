const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OpenAI } = require('openai');
const { Resend } = require('resend'); // ADD THIS

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chatapp-super-secure-key';

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// DATABASE CONNECTION
// ============================================================

const DATABASE_URL = process.env.DATABASE_URL;
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
});

// ============================================================
// OPENAI INITIALIZATION
// ============================================================

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================
// DATABASE INITIALIZATION
// ============================================================

async function initDatabase() {
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                display_name VARCHAR(100),
                bio TEXT,
                avatar_url TEXT,
                is_online BOOLEAN DEFAULT FALSE,
                last_active TIMESTAMPTZ DEFAULT NOW(),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log('✅ Users table ready');

        // Create messages table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log('✅ Messages table ready');

        // Create conversations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS conversations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                last_message_at TIMESTAMPTZ DEFAULT NOW(),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user1_id, user2_id)
            )
        `);
        console.log('✅ Conversations table ready');

        // Create ai_chat_history table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ai_chat_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role VARCHAR(20) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log('✅ AI Chat History table ready');

        // Create password_reset_tokens table (ADD THIS)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token VARCHAR(255) NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log('✅ Password reset tokens table ready');

        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
    }
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function auth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// ============================================================
// AUTH ROUTES
// ============================================================

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, display_name } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        if (!email.includes('@')) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Check if user exists
        const existing = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Username or email already taken' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, display_name)
             VALUES ($1, $2, $3, $4)
             RETURNING id, username, email, display_name, created_at`,
            [username, email, hashedPassword, display_name || username]
        );

        const user = result.rows[0];

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                display_name: user.display_name,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Find user
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update online status
        await pool.query(
            'UPDATE users SET is_online = TRUE, last_active = NOW() WHERE id = $1',
            [user.id]
        );

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                display_name: user.display_name,
                bio: user.bio,
                avatar_url: user.avatar_url,
                is_online: true
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
app.get('/api/auth/me', auth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, email, display_name, bio, avatar_url, is_online, created_at FROM users WHERE id = $1',
            [req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// ============================================================
// PASSWORD RESET ROUTES (ADD THESE)
// ============================================================

// Forgot password - sends reset email
app.post('/api/auth/forgot-password', async (req, res) => {
    console.log('🔥 FORGOT PASSWORD ROUTE HIT!');

    try {
        const { email } = req.body;

        console.log('Forgot password request for:', email);

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if user exists
        const userResult = await pool.query(
            'SELECT id, username, email FROM users WHERE email = $1',
            [normalizedEmail]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'No user found with this email' });
        }

        console.log('User found:', userResult.rows[0].username);

        // Generate reset token
        const resetToken = jwt.sign(
            { userId: userResult.rows[0].id },
            JWT_SECRET + '_reset',
            { expiresIn: '1h' }
        );

        // Save token to database
        await pool.query(
            `INSERT INTO password_reset_tokens (user_id, token, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
            [userResult.rows[0].id, resetToken]
        );

        // Build reset link - update with your actual domain
        const resetLink = `https://${req.get('host')}/reset-password?token=${resetToken}`;

        // Send email
        const emailSent = await sendResetEmail(normalizedEmail, resetToken);

        if (emailSent) {
            console.log('✅ Email sent to:', normalizedEmail);

            return res.json({
                success: true,
                message: 'Password reset link sent to your email'
            });
        }

        return res.status(500).json({
            error: 'Failed to send email. Please try again.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Reset password - updates password
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET + '_reset');
        const userId = decoded.userId;

        // Check if token exists and is not used
        const tokenResult = await pool.query(
            `SELECT id FROM password_reset_tokens 
             WHERE user_id = $1 AND token = $2 AND used = FALSE AND expires_at > NOW()`,
            [userId, token]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        // Mark token as used
        await pool.query(
            `UPDATE password_reset_tokens SET used = TRUE WHERE id = $1`,
            [tokenResult.rows[0].id]
        );

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user
        const result = await pool.query(
            `UPDATE users
             SET password_hash = $1
             WHERE id = $2
             RETURNING id, username`,
            [hashedPassword, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('✅ Password reset for user:', result.rows[0].username);

        res.json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ error: 'Token has expired. Please request a new reset link.' });
        }

        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// EMAIL SENDING FUNCTION (ADD THIS)
// ============================================================

async function sendResetEmail(email, resetToken) {
    try {
        const resetLink = `https://${process.env.HOST || 'your-domain.com'}/reset-password?token=${resetToken}`;

        console.log('========================================');
        console.log('PASSWORD RESET REQUEST');
        console.log('Email:', email);
        console.log('Reset Link:', resetLink);
        console.log('========================================');

        // Check if Resend API key is available
        if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'test_key_123') {
            try {
                const resend = new Resend(process.env.RESEND_API_KEY);

                const { data, error } = await resend.emails.send({
                    from: 'ChatApp <onboarding@resend.dev>',
                    to: [email],
                    subject: 'ChatApp - Password Reset',
                    html: `
                        <h1>Reset Your Password</h1>
                        <p>Click the link below to reset your password:</p>
                        <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#4CAF50;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
                        <p style="margin-top:16px;">Or copy and paste this link into your browser:</p>
                        <p><code>${resetLink}</code></p>
                        <p>This link expires in 1 hour.</p>
                        <p>If you didn't request this, please ignore this email.</p>
                    `
                });

                if (error) {
                    console.error('Resend error:', error);
                    return false;
                }

                console.log('✅ Email sent successfully to:', email);
                return true;
            } catch (err) {
                console.error('Resend send error:', err.message);
                return false;
            }
        }

        console.log('No valid RESEND_API_KEY - link logged above');
        return true;
    } catch (error) {
        console.error('Email error:', error.message);
        return false;
    }
}

// ============================================================
// RESET PASSWORD WEB PAGE (ADD THIS)
// ============================================================

app.get('/reset-password', (req, res) => {
    const token = req.query.token;

    if (!token) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Invalid Reset Link</title></head>
            <body style="font-family: Arial; max-width: 400px; margin: 50px auto; padding: 20px; text-align: center; background: #0A0A0A; color: #FFF;">
                <h1>Invalid Reset Link</h1>
                <p>The password reset link is missing a token. Please request a new reset link.</p>
            </body>
            </html>
        `);
    }

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reset Password - ChatApp</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                    background: #0A0A0A;
                    color: #FFF;
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                }
                .container {
                    background: #1A1A1A;
                    border-radius: 16px;
                    padding: 40px 30px;
                    max-width: 420px;
                    width: 100%;
                    border: 2px solid #4CAF50;
                    box-shadow: 0 0 40px rgba(76, 175, 80, 0.15);
                }
                h1 { 
                    font-size: 24px;
                    font-weight: 800;
                    text-align: center;
                    margin-bottom: 8px;
                    color: #FFF;
                    letter-spacing: 1px;
                }
                .subtitle {
                    text-align: center;
                    color: #888;
                    font-size: 14px;
                    margin-bottom: 28px;
                }
                label {
                    display: block;
                    color: #AAA;
                    font-size: 13px;
                    font-weight: 600;
                    margin-bottom: 6px;
                }
                .password-wrapper {
                    position: relative;
                    width: 100%;
                    margin-bottom: 4px;
                }
                .password-wrapper input {
                    width: 100%;
                    padding: 14px 50px 14px 16px;
                    background: #0A0A0A;
                    border: 2px solid #333;
                    border-radius: 12px;
                    color: #FFF;
                    font-size: 16px;
                    transition: border-color 0.3s;
                }
                .password-wrapper input:focus {
                    outline: none;
                    border-color: #4CAF50;
                }
                .eye-icon {
                    position: absolute;
                    right: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    color: #4CAF50;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 5px;
                    user-select: none;
                }
                button[type="submit"] {
                    width: 100%;
                    padding: 16px;
                    background: #4CAF50;
                    color: #FFF;
                    border: none;
                    border-radius: 12px;
                    font-size: 18px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: background 0.3s;
                    margin-top: 4px;
                }
                button[type="submit"]:hover { background: #43A047; }
                button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
                .cancel-btn {
                    display: block;
                    text-align: center;
                    margin-top: 14px;
                    color: #888;
                    text-decoration: none;
                    font-size: 14px;
                }
                .cancel-btn:hover { color: #FFF; }
                #message {
                    margin-top: 16px;
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 14px;
                    text-align: center;
                    display: none;
                }
                #message.success {
                    display: block;
                    background: rgba(76, 175, 80, 0.15);
                    color: #4CAF50;
                    border: 1px solid #4CAF50;
                }
                #message.error {
                    display: block;
                    background: rgba(244, 67, 54, 0.15);
                    color: #F44336;
                    border: 1px solid #F44336;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    color: #555;
                    font-size: 12px;
                }
                .requirements {
                    color: #666;
                    font-size: 12px;
                    margin: 4px 0 12px 0;
                    padding-left: 4px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🔐 Reset Password</h1>
                <p class="subtitle">Enter your new password below</p>

                <label for="password">New Password</label>
                <div class="password-wrapper">
                    <input type="password" id="password" placeholder="Enter new password" autocomplete="new-password">
                    <button class="eye-icon" id="togglePassword" type="button">👁️</button>
                </div>
                <div class="requirements">Minimum 6 characters</div>

                <label for="confirm">Confirm Password</label>
                <div class="password-wrapper">
                    <input type="password" id="confirm" placeholder="Confirm your new password" autocomplete="new-password">
                    <button class="eye-icon" id="toggleConfirm" type="button">👁️</button>
                </div>

                <button type="submit" id="resetBtn">Reset Password</button>
                <a href="/" class="cancel-btn">Cancel</a>

                <div id="message"></div>
                <div class="footer">ChatApp • Secure Password Reset</div>
            </div>

            <script>
                const token = '${token}';
                const messageEl = document.getElementById('message');
                const resetBtn = document.getElementById('resetBtn');
                const passwordInput = document.getElementById('password');
                const confirmInput = document.getElementById('confirm');

                const togglePassword = document.getElementById('togglePassword');
                const toggleConfirm = document.getElementById('toggleConfirm');

                togglePassword.addEventListener('click', function() {
                    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                    passwordInput.setAttribute('type', type);
                    this.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
                });

                toggleConfirm.addEventListener('click', function() {
                    const type = confirmInput.getAttribute('type') === 'password' ? 'text' : 'password';
                    confirmInput.setAttribute('type', type);
                    this.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
                });

                async function resetPassword() {
                    const password = passwordInput.value.trim();
                    const confirm = confirmInput.value.trim();

                    messageEl.className = '';
                    messageEl.textContent = '';
                    messageEl.style.display = 'none';

                    if (!password) {
                        showMessage('Please enter a new password.', 'error');
                        passwordInput.focus();
                        return;
                    }

                    if (password.length < 6) {
                        showMessage('Password must be at least 6 characters.', 'error');
                        passwordInput.focus();
                        return;
                    }

                    if (password !== confirm) {
                        showMessage('Passwords do not match.', 'error');
                        confirmInput.focus();
                        return;
                    }

                    resetBtn.disabled = true;
                    resetBtn.textContent = 'Resetting...';

                    try {
                        const response = await fetch('/api/auth/reset-password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token, password })
                        });

                        const result = await response.json();

                        if (response.ok) {
                            showMessage('✅ Password reset successfully! You can now login to the app.', 'success');
                            resetBtn.textContent = '✓ Done';
                            setTimeout(() => {
                                window.location.href = '/';
                            }, 3000);
                        } else {
                            showMessage('❌ ' + (result.error || 'Something went wrong. Please try again.'), 'error');
                            resetBtn.disabled = false;
                            resetBtn.textContent = 'Reset Password';
                        }
                    } catch (error) {
                        showMessage('❌ Network error. Please check your connection and try again.', 'error');
                        resetBtn.disabled = false;
                        resetBtn.textContent = 'Reset Password';
                    }
                }

                function showMessage(text, type) {
                    messageEl.textContent = text;
                    messageEl.className = type;
                    messageEl.style.display = 'block';
                }

                document.getElementById('resetBtn').addEventListener('click', resetPassword);
                document.getElementById('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') resetPassword(); });
                document.getElementById('confirm').addEventListener('keydown', (e) => { if (e.key === 'Enter') resetPassword(); });
            </script>
        </body>
        </html>
    `);
});

// ============================================================
// OPENAI CHAT COMPLETION ENDPOINT
// ============================================================

app.post('/api/ai/chat', auth, async (req, res) => {
    try {
        const { message, context } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Get user info for personalization
        const userResult = await pool.query(
            'SELECT username, display_name FROM users WHERE id = $1',
            [req.userId]
        );

        const user = userResult.rows[0] || {};

        // Build system prompt
        const systemPrompt = `You are a friendly AI assistant for a chat application called ChatApp.
The user's name is ${user.display_name || user.username || 'User'}.

Keep responses:
- Friendly and conversational
- Helpful and supportive
- Appropriate for a general chat app
- Keep responses under 150 words unless asked for more detail
- Be respectful and inclusive

If asked about the app, tell them about ChatApp features like:
- Direct messaging with translation
- Premium subscription with 14-day trial
- Secure and private messaging`;

        // Get recent AI chat history (last 5 messages)
        const historyResult = await pool.query(
            `SELECT role, content FROM ai_chat_history 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT 5`,
            [req.userId]
        );

        const historyMessages = historyResult.rows.reverse().map(row => ({
            role: row.role,
            content: row.content
        }));

        // Build messages array
        const messages = [
            { role: 'system', content: systemPrompt },
            ...historyMessages,
            ...(context ? [{ role: 'assistant', content: context }] : []),
            { role: 'user', content: message }
        ];

        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 300,
            temperature: 0.7,
        });

        const aiResponse = response.choices[0].message.content;

        // Save to history
        await pool.query(
            `INSERT INTO ai_chat_history (user_id, role, content) 
             VALUES ($1, $2, $3), ($1, $4, $5)`,
            [req.userId, 'user', message, 'assistant', aiResponse]
        );

        console.log(`AI Chat - User: ${user.username}, Message: "${message.substring(0, 50)}..."`);

        res.json({
            success: true,
            response: aiResponse,
            usage: response.usage
        });
    } catch (error) {
        console.error('OpenAI error:', error);

        if (error.code === 'insufficient_quota') {
            return res.status(429).json({
                error: 'AI service temporarily unavailable. Please try again later.'
            });
        }

        res.status(500).json({
            error: 'AI service error: ' + error.message
        });
    }
});

// ============================================================
// OPENAI MESSAGE SUGGESTIONS ENDPOINT
// ============================================================

app.post('/api/ai/suggest-reply', auth, async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const userResult = await pool.query(
            'SELECT username, display_name FROM users WHERE id = $1',
            [req.userId]
        );

        const user = userResult.rows[0] || {};

        const prompt = `Suggest 3 reply options for this message in a chat:
"${message}"

The replies should be:
1. Friendly and natural
2. Fit the tone of the message
3. Each under 30 words
4. Numbered 1, 2, 3

User: ${user.display_name || user.username || 'User'}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'You are a helpful chat reply suggester.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 150,
            temperature: 0.8,
        });

        const suggestions = response.choices[0].message.content
            .split('\n')
            .filter(line => line.trim() && line.match(/^\d\./))
            .map(line => line.replace(/^\d\.\s*/, '').trim());

        res.json({
            success: true,
            suggestions: suggestions.length > 0 ? suggestions : [
                "That's interesting! Tell me more.",
                "I agree with you on that.",
                "Let me think about that for a moment."
            ]
        });
    } catch (error) {
        console.error('Suggest reply error:', error);
        res.status(500).json({ error: 'Failed to generate suggestions' });
    }
});

// ============================================================
// USER ROUTES
// ============================================================

// Get all users (except current)
app.get('/api/users', auth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, display_name, bio, avatar_url, is_online, last_active
             FROM users 
             WHERE id != $1
             ORDER BY is_online DESC, last_active DESC
             LIMIT 50`,
            [req.userId]
        );

        res.json({ users: result.rows });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Get user by ID
app.get('/api/users/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT id, username, display_name, bio, avatar_url, is_online, last_active, created_at
             FROM users 
             WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Update user profile
app.put('/api/users/profile', auth, async (req, res) => {
    try {
        const { display_name, bio, avatar_url } = req.body;

        const result = await pool.query(
            `UPDATE users 
             SET display_name = COALESCE($1, display_name),
                 bio = COALESCE($2, bio),
                 avatar_url = COALESCE($3, avatar_url),
                 updated_at = NOW()
             WHERE id = $4
             RETURNING id, username, display_name, bio, avatar_url`,
            [display_name, bio, avatar_url, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// ============================================================
// MESSAGE ROUTES
// ============================================================

// Send message
app.post('/api/messages', auth, async (req, res) => {
    try {
        const { recipient_id, content } = req.body;

        if (!recipient_id || !content) {
            return res.status(400).json({ error: 'Recipient and content required' });
        }

        if (content.length > 5000) {
            return res.status(400).json({ error: 'Message too long (max 5000 characters)' });
        }

        // Check if recipient exists
        const recipientCheck = await pool.query(
            'SELECT id FROM users WHERE id = $1',
            [recipient_id]
        );
        if (recipientCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Recipient not found' });
        }

        // Create or update conversation
        await pool.query(
            `INSERT INTO conversations (user1_id, user2_id, last_message_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user1_id, user2_id) 
             DO UPDATE SET last_message_at = NOW()
             WHERE conversations.user1_id = $1 AND conversations.user2_id = $2`,
            [req.userId, recipient_id]
        );

        // Insert message
        const result = await pool.query(
            `INSERT INTO messages (sender_id, recipient_id, content)
             VALUES ($1, $2, $3)
             RETURNING id, sender_id, recipient_id, content, is_read, created_at`,
            [req.userId, recipient_id, content]
        );

        res.status(201).json({
            success: true,
            message: result.rows[0]
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Get conversations
app.get('/api/messages/conversations', auth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                c.id as conversation_id,
                c.user1_id,
                c.user2_id,
                c.last_message_at,
                CASE 
                    WHEN c.user1_id = $1 THEN u2.id
                    ELSE u1.id
                END as other_user_id,
                CASE 
                    WHEN c.user1_id = $1 THEN u2.display_name
                    ELSE u1.display_name
                END as other_user_display_name,
                CASE 
                    WHEN c.user1_id = $1 THEN u2.username
                    ELSE u1.username
                END as other_user_username,
                CASE 
                    WHEN c.user1_id = $1 THEN u2.avatar_url
                    ELSE u1.avatar_url
                END as other_user_avatar,
                CASE 
                    WHEN c.user1_id = $1 THEN u2.is_online
                    ELSE u1.is_online
                END as other_user_is_online,
                (
                    SELECT content FROM messages 
                    WHERE (sender_id = c.user1_id AND recipient_id = c.user2_id)
                       OR (sender_id = c.user2_id AND recipient_id = c.user1_id)
                    ORDER BY created_at DESC
                    LIMIT 1
                ) as last_message
             FROM conversations c
             JOIN users u1 ON c.user1_id = u1.id
             JOIN users u2 ON c.user2_id = u2.id
             WHERE c.user1_id = $1 OR c.user2_id = $1
             ORDER BY c.last_message_at DESC`,
            [req.userId]
        );

        res.json({ conversations: result.rows });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to get conversations' });
    }
});

// Get messages between two users
app.get('/api/messages/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, before } = req.query;

        let query = `
            SELECT id, sender_id, recipient_id, content, is_read, created_at
            FROM messages
            WHERE (sender_id = $1 AND recipient_id = $2)
               OR (sender_id = $2 AND recipient_id = $1)
        `;
        const params = [req.userId, userId];

        if (before) {
            query += ` AND created_at < $3`;
            params.push(new Date(parseInt(before)));
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));

        const result = await pool.query(query, params);

        // Mark messages as read
        await pool.query(
            `UPDATE messages 
             SET is_read = TRUE 
             WHERE sender_id = $1 AND recipient_id = $2 AND is_read = FALSE`,
            [userId, req.userId]
        );

        res.json({
            messages: result.rows.reverse()
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Mark messages as read
app.put('/api/messages/read/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await pool.query(
            `UPDATE messages 
             SET is_read = TRUE 
             WHERE sender_id = $1 AND recipient_id = $2 AND is_read = FALSE
             RETURNING id`,
            [userId, req.userId]
        );

        res.json({
            success: true,
            marked: result.rows.length
        });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
});

// Get unread count
app.get('/api/messages/unread/count', auth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT COUNT(*) as unread_count
             FROM messages
             WHERE recipient_id = $1 AND is_read = FALSE`,
            [req.userId]
        );

        res.json({ unread_count: parseInt(result.rows[0].unread_count) });
    } catch (error) {
        console.error('Unread count error:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});

// ============================================================
// SUBSCRIPTION PLANS
// ============================================================

app.get('/api/subscription/plans', (req, res) => {
    res.json({
        success: true,
        plans: [{
            id: 'premium',
            name: 'ChatApp Premium',
            monthlyPrice: 3.99,
            yearlyPrice: 25.00,
            features: [
                'Direct Messaging',
                'DM Translation (50+ languages)',
                '1-year data retention',
                'No ads',
                'Priority support',
                'Unlimited DMs',
                'AI Chat Assistant'
            ],
            trialDays: 14
        }],
        trialDays: 14,
        currency: 'USD'
    });
});

// ============================================================
// ROOT & HEALTH ROUTES
// ============================================================

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'ChatApp is running!',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            messages: '/api/messages',
            ai: '/api/ai',
            subscription: '/api/subscription'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/db-status', async (req, res) => {
    try {
        await pool.query('SELECT NOW()');
        res.json({ status: 'connected', database: 'ChatApp DB' });
    } catch (err) {
        res.status(500).json({ status: 'disconnected', error: err.message });
    }
});

// ============================================================
// AI HISTORY CLEANUP (Optional)
// ============================================================

// Clear AI chat history
app.delete('/api/ai/history', auth, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM ai_chat_history WHERE user_id = $1',
            [req.userId]
        );

        res.json({ success: true, message: 'AI chat history cleared' });
    } catch (error) {
        console.error('Clear AI history error:', error);
        res.status(500).json({ error: 'Failed to clear AI history' });
    }
});

// Get AI chat history
app.get('/api/ai/history', auth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT role, content, created_at 
             FROM ai_chat_history 
             WHERE user_id = $1 
             ORDER BY created_at ASC 
             LIMIT 50`,
            [req.userId]
        );

        res.json({ history: result.rows });
    } catch (error) {
        console.error('Get AI history error:', error);
        res.status(500).json({ error: 'Failed to get AI history' });
    }
});

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ============================================================
// START SERVER
// ============================================================

async function startServer() {
    try {
        await initDatabase();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`📡 API URL: https://${process.env.HOST || 'localhost'}:${PORT}`);
            console.log(`📧 Password Reset: POST /api/auth/forgot-password`);
            console.log(`🔐 Auth endpoints: /api/auth/register, /api/auth/login`);
            console.log(`🤖 AI Chat: POST /api/ai/chat`);
            console.log(`💬 Messages: /api/messages`);
        });
    } catch (error) {
        console.error('❌ Server startup error:', error.message);
        process.exit(1);
    }
}

startServer();