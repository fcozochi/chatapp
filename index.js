const express = require('express');
const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const DATABASE_URL = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

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

// Root route
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'ChatApp is running!'
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Database status
app.get('/api/db-status', async (req, res) => {
    try {
        await pool.query('SELECT NOW()');
        res.json({ status: 'connected', database: 'ChatApp DB' });
    } catch (err) {
        res.status(500).json({ status: 'disconnected', error: err.message });
    }
});

// Get users
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users LIMIT 10');
        res.json({ success: true, users: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Subscription plans endpoint
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
                'Unlimited DMs'
            ],
            trialDays: 14
        }],
        trialDays: 14,
        currency: 'USD'
    });
});

// 404 handler - must be last
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
});