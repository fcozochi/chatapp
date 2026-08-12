const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OpenAI } = require('openai');

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
            console.log(`📡 API URL: http://localhost:${PORT}/api`);
            console.log(`🤖 AI Chat: POST /api/ai/chat`);
            console.log(`💡 Reply Suggestions: POST /api/ai/suggest-reply`);
            console.log(`🔐 Auth endpoints: /api/auth/register, /api/auth/login`);
            console.log(`💬 Messages: /api/messages`);
        });
    } catch (error) {
        console.error('❌ Server startup error:', error.message);
        process.exit(1);
    }
}

startServer();